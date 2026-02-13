import { useEffect, useMemo, useState } from 'react'
import { Plus, Edit2, Trash2, Phone, Save } from 'lucide-react'
import { api } from '../services/api'

interface IVROption {
  digit: string
  destination: string
}

interface IVRMenu {
  id: number
  name: string
  extension: string
  prompt: string | null
  timeout_seconds: number
  timeout_destination: string | null
  retries: number
  inbound_trunk_id: number | null
  inbound_did: string | null
  enabled: boolean
  options: IVROption[]
  created_at: string
  updated_at: string
}

interface SIPPeer {
  id: number
  extension: string
  caller_id: string | null
  enabled: boolean
}

interface RingGroup {
  id: number
  name: string
  extension: string
  enabled: boolean
}

interface AvailableDidGroup {
  trunk_id: number
  trunk_name: string
  dids: string[]
}

const DIGITS = ['0','1','2','3','4','5','6','7','8','9','*','#']

export default function IvrPage() {
  const [menus, setMenus] = useState<IVRMenu[]>([])
  const [peers, setPeers] = useState<SIPPeer[]>([])
  const [groups, setGroups] = useState<RingGroup[]>([])
  const [availableDids, setAvailableDids] = useState<AvailableDidGroup[]>([])
  const [prompts, setPrompts] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<IVRMenu | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [testExtension, setTestExtension] = useState('')
  const [testingCall, setTestingCall] = useState(false)

  const [form, setForm] = useState({
    name: '',
    extension: '',
    prompt: '',
    timeout_seconds: 5,
    timeout_destination: '',
    retries: 2,
    inbound_trunk_id: null as number | null,
    inbound_did: '',
    enabled: true,
    options: [] as IVROption[],
  })

  const fetchAll = async () => {
    try {
      const [ivrData, peerData, groupData, didData, promptData] = await Promise.all([
        api.getIvrMenus(),
        api.getSipPeers(),
        api.getRingGroups(),
        api.getAvailableDids(),
        api.getIvrPrompts(),
      ])
      setMenus(ivrData)
      setPeers(peerData)
      setGroups(groupData)
      setAvailableDids(didData)
      setPrompts(promptData)
      if (!testExtension) {
        const first = peerData.find((p: SIPPeer) => p.enabled)
        if (first) setTestExtension(first.extension)
      }
    } catch (e: any) {
      setError(e.message || 'Daten konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({
      name: '',
      extension: '',
      prompt: '',
      timeout_seconds: 5,
      timeout_destination: '',
      retries: 2,
      inbound_trunk_id: null,
      inbound_did: '',
      enabled: true,
      options: [],
    })
    setError('')
    setShowForm(true)
  }

  const openEdit = (menu: IVRMenu) => {
    setEditing(menu)
    setForm({
      name: menu.name,
      extension: menu.extension,
      prompt: menu.prompt || '',
      timeout_seconds: menu.timeout_seconds || 5,
      timeout_destination: menu.timeout_destination || '',
      retries: menu.retries ?? 2,
      inbound_trunk_id: menu.inbound_trunk_id || null,
      inbound_did: menu.inbound_did || '',
      enabled: menu.enabled,
      options: menu.options || [],
    })
    setError('')
    setShowForm(true)
  }

  const destinationOptions = useMemo(() => {
    const opts = [] as { value: string; label: string }[]
    peers.filter(p => p.enabled).forEach(p => {
      opts.push({ value: p.extension, label: `${p.extension}${p.caller_id ? ` – ${p.caller_id}` : ''}` })
    })
    groups.filter(g => g.enabled).forEach(g => {
      opts.push({ value: g.extension, label: `${g.extension} – Gruppe ${g.name}` })
    })
    menus.forEach(m => {
      if (!editing || editing.id !== m.id) {
        opts.push({ value: m.extension, label: `${m.extension} – IVR ${m.name}` })
      }
    })
    return opts.sort((a, b) => a.value.localeCompare(b.value))
  }, [peers, groups, menus, editing])

  const trunkOptions = useMemo(() => {
    const options = [...availableDids]
    if (editing && editing.inbound_trunk_id) {
      const exists = options.find(t => t.trunk_id === editing.inbound_trunk_id)
      if (!exists) {
        options.unshift({
          trunk_id: editing.inbound_trunk_id,
          trunk_name: `Leitung ${editing.inbound_trunk_id}`,
          dids: editing.inbound_did ? [editing.inbound_did] : [],
        })
      }
    }
    return options
  }, [availableDids, editing])

  const didOptions = useMemo(() => {
    if (!form.inbound_trunk_id) return []
    const trunk = trunkOptions.find(t => t.trunk_id === form.inbound_trunk_id)
    const dids = trunk ? [...trunk.dids] : []
    if (editing && editing.inbound_did && !dids.includes(editing.inbound_did)) {
      dids.unshift(editing.inbound_did)
    }
    return dids
  }, [form.inbound_trunk_id, trunkOptions, editing])

  const addOption = () => {
    setForm(prev => ({
      ...prev,
      options: [...prev.options, { digit: '1', destination: '' }],
    }))
  }

  const updateOption = (idx: number, patch: Partial<IVROption>) => {
    setForm(prev => {
      const next = [...prev.options]
      next[idx] = { ...next[idx], ...patch }
      return { ...prev, options: next }
    })
  }

  const removeOption = (idx: number) => {
    setForm(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== idx),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        prompt: form.prompt || null,
        timeout_destination: form.timeout_destination || null,
        inbound_trunk_id: form.inbound_did ? form.inbound_trunk_id : null,
        inbound_did: form.inbound_did || null,
      }
      if (editing) {
        await api.updateIvrMenu(editing.id, payload)
      } else {
        await api.createIvrMenu(payload)
      }
      setShowForm(false)
      await fetchAll()
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (menu: IVRMenu) => {
    if (!confirm(`IVR ${menu.name} wirklich löschen?`)) return
    try {
      await api.deleteIvrMenu(menu.id)
      await fetchAll()
    } catch (err: any) {
      alert(err.message || 'Fehler beim Löschen')
    }
  }

  const handlePromptUpload = async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const res = await api.uploadIvrPrompt(file)
      if (res?.prompt) {
        setForm(prev => ({ ...prev, prompt: res.prompt }))
      }
      await fetchAll()
    } catch (err: any) {
      setError(err.message || 'Upload fehlgeschlagen')
    } finally {
      setUploading(false)
    }
  }

  const handleTestCall = async () => {
    if (!testExtension || !form.extension) return
    setTestingCall(true)
    try {
      await api.originateCall(testExtension, form.extension)
    } catch (err: any) {
      setError(err.message || 'Testanruf fehlgeschlagen')
    } finally {
      setTestingCall(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-500">Lade IVR…</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">IVR (Sprachmenü)</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Erstellen Sie Menüs mit Tastendruck‑Optionen. Das Audio muss als Datei im Asterisk‑Sounds‑Pfad vorhanden sein.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Neues IVR
          </button>
        </div>

        {menus.length === 0 ? (
          <div className="mt-6 text-sm text-gray-500">Noch keine IVR-Menüs angelegt.</div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Nummer</th>
                  <th className="py-2 pr-4">Prompt</th>
                  <th className="py-2 pr-4">Optionen</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {menus.map(m => (
                  <tr key={m.id} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-3 pr-4 font-medium text-gray-800 dark:text-gray-200">{m.name}</td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">{m.extension}</td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">{m.prompt || '—'}</td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">{m.options?.length || 0}</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${m.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {m.enabled ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openEdit(m)}
                          className="p-2 text-gray-500 hover:text-blue-600"
                          title="Bearbeiten"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          className="p-2 text-gray-500 hover:text-red-600"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-3xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  {editing ? 'IVR bearbeiten' : 'IVR anlegen'}
                </h3>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="z.B. Hauptmenü"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IVR‑Nummer</label>
                  <input
                    type="text"
                    value={form.extension}
                    onChange={e => setForm({ ...form, extension: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="z.B. 600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prompt (Audio-Datei)</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={form.prompt}
                      onChange={e => setForm({ ...form, prompt: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">— kein Prompt —</option>
                      {prompts.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <label className="inline-flex items-center px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 cursor-pointer">
                      <input
                        type="file"
                        accept=".wav,.gsm,.ulaw,.alaw,.mp3,.ogg,.flac"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) handlePromptUpload(f)
                        }}
                      />
                      {uploading ? 'Upload…' : 'Upload'}
                    </label>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Dateien werden in WAV (8kHz, mono) konvertiert und als `custom/…` verfügbar.</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timeout (Sek.)</label>
                  <input
                    type="number"
                    min={2}
                    max={30}
                    value={form.timeout_seconds}
                    onChange={e => setForm({ ...form, timeout_seconds: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timeout‑Ziel (optional)</label>
                  <select
                    value={form.timeout_destination}
                    onChange={e => setForm({ ...form, timeout_destination: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">— kein Ziel —</option>
                    {destinationOptions.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Wiederholungen</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={form.retries}
                    onChange={e => setForm({ ...form, retries: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Eingehende Rufnummer (optional)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <select
                      value={form.inbound_trunk_id ?? ''}
                      onChange={e => {
                        const nextId = e.target.value ? Number(e.target.value) : null
                        setForm({ ...form, inbound_trunk_id: nextId, inbound_did: '' })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Leitung wählen</option>
                      {trunkOptions.map(t => (
                        <option key={t.trunk_id} value={t.trunk_id}>{t.trunk_name}</option>
                      ))}
                    </select>
                    <select
                      value={form.inbound_did}
                      onChange={e => setForm({ ...form, inbound_did: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      disabled={!form.inbound_trunk_id}
                    >
                      <option value="">Rufnummer wählen</option>
                      {didOptions.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Legt automatisch eine Inbound‑Route auf dieses IVR an.</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Wiederholungen</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={form.retries}
                    onChange={e => setForm({ ...form, retries: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Eingehende Rufnummer (optional)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <select
                      value={form.inbound_trunk_id ?? ''}
                      onChange={e => {
                        const nextId = e.target.value ? Number(e.target.value) : null
                        setForm({ ...form, inbound_trunk_id: nextId, inbound_did: '' })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Leitung wählen</option>
                      {trunkOptions.map(t => (
                        <option key={t.trunk_id} value={t.trunk_id}>{t.trunk_name}</option>
                      ))}
                    </select>
                    <select
                      value={form.inbound_did}
                      onChange={e => setForm({ ...form, inbound_did: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      disabled={!form.inbound_trunk_id}
                    >
                      <option value="">Rufnummer wählen</option>
                      {didOptions.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Legt automatisch eine Inbound‑Route auf dieses IVR an.</div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tasten‑Optionen</label>
                  <button
                    type="button"
                    onClick={addOption}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg"
                  >
                    <Plus className="w-4 h-4" />
                    Option hinzufügen
                  </button>
                </div>
                <div className="space-y-2">
                  {form.options.length === 0 && (
                    <div className="text-sm text-gray-500">Noch keine Optionen.</div>
                  )}
                  {form.options.map((opt, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                      <select
                        value={opt.digit}
                        onChange={e => updateOption(idx, { digit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        {DIGITS.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <select
                        value={opt.destination}
                        onChange={e => updateOption(idx, { destination: e.target.value })}
                        className="md:col-span-3 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="">Ziel wählen</option>
                        {destinationOptions.map(d => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                      >
                        Entfernen
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Testanruf</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Ruft das IVR von einer Nebenstelle an.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={testExtension}
                      onChange={e => setTestExtension(e.target.value)}
                      className="w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    >
                      {peers.filter(p => p.enabled).map(p => (
                        <option key={p.extension} value={p.extension}>{p.extension}{p.caller_id ? ` – ${p.caller_id}` : ''}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleTestCall}
                      disabled={testingCall || !form.extension}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-60"
                    >
                      {testingCall ? 'Rufe…' : 'Testanruf'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={e => setForm({ ...form, enabled: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Aktiv
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Speichern…' : 'Speichern'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
