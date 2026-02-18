import { useEffect, useMemo, useState } from 'react'
import { Plus, Edit2, Trash2, Users } from 'lucide-react'
import { api } from '../services/api'
import { useI18n } from '../context/I18nContext'

interface RingGroup {
  id: number
  name: string
  extension: string
  inbound_trunk_id: number | null
  inbound_did: string | null
  strategy: string
  ring_time: number
  enabled: boolean
  members: string[]
  created_at: string
  updated_at: string
}

interface SIPPeer {
  id: number
  extension: string
  caller_id: string | null
  enabled: boolean
}

interface AvailableDidGroup {
  trunk_id: number
  trunk_name: string
  dids: string[]
}

export default function GroupsPage() {
  const { tr } = useI18n()
  const STRATEGIES = [
    { value: 'ringall', label: tr('Alle gleichzeitig', 'All at once') },
    { value: 'roundrobin', label: tr('Rundruf (Round Robin)', 'Round robin') },
    { value: 'leastrecent', label: tr('Am längsten frei', 'Least recently used') },
  ]
  const [groups, setGroups] = useState<RingGroup[]>([])
  const [peers, setPeers] = useState<SIPPeer[]>([])
  const [availableDids, setAvailableDids] = useState<AvailableDidGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RingGroup | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    extension: '',
    inbound_trunk_id: null as number | null,
    inbound_did: '',
    strategy: 'ringall',
    ring_time: 20,
    enabled: true,
    members: [] as string[],
  })

  const memberOptions = useMemo(() => {
    return [...peers]
      .filter(p => p.enabled)
      .sort((a, b) => a.extension.localeCompare(b.extension))
  }, [peers])

  const availableExtensions = useMemo(() => {
    const used = new Set<string>()
    peers.forEach(p => used.add(p.extension))
    groups.forEach(g => used.add(g.extension))

    const list: string[] = []
    for (let i = 1000; i <= 1999; i++) {
      const ext = String(i)
      if (!used.has(ext)) list.push(ext)
    }

    if (editing && editing.extension && !list.includes(editing.extension)) {
      list.unshift(editing.extension)
    }

    return list
  }, [peers, groups, editing])

  const fetchAll = async () => {
    try {
      const [groupData, peerData, didData] = await Promise.all([
        api.getRingGroups(),
        api.getSipPeers(),
        api.getAvailableDids(),
      ])
      setGroups(groupData)
      setPeers(peerData)
      setAvailableDids(didData)
    } catch (e: any) {
      setError(e.message || tr('Daten konnten nicht geladen werden', 'Data could not be loaded'))
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
      inbound_trunk_id: null,
      inbound_did: '',
      strategy: 'ringall',
      ring_time: 20,
      enabled: true,
      members: [],
    })
    setError('')
    setShowForm(true)
  }

  const openEdit = (group: RingGroup) => {
    setEditing(group)
    setForm({
      name: group.name,
      extension: group.extension,
      inbound_trunk_id: group.inbound_trunk_id || null,
      inbound_did: group.inbound_did || '',
      strategy: group.strategy,
      ring_time: group.ring_time || 20,
      enabled: group.enabled,
      members: group.members || [],
    })
    setError('')
    setShowForm(true)
  }

  const toggleMember = (ext: string) => {
    setForm(prev => {
      const exists = prev.members.includes(ext)
      return {
        ...prev,
        members: exists ? prev.members.filter(m => m !== ext) : [...prev.members, ext],
      }
    })
  }

  const trunkOptions = useMemo(() => {
    const options = [...availableDids]
    if (editing && editing.inbound_trunk_id) {
      const exists = options.find(t => t.trunk_id === editing.inbound_trunk_id)
      if (!exists) {
        options.unshift({
          trunk_id: editing.inbound_trunk_id,
          trunk_name: tr(`Leitung ${editing.inbound_trunk_id}`, `Trunk ${editing.inbound_trunk_id}`),
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        inbound_trunk_id: form.inbound_did ? form.inbound_trunk_id : null,
        inbound_did: form.inbound_did || null,
      }
      if (editing) {
        await api.updateRingGroup(editing.id, payload)
      } else {
        await api.createRingGroup(payload)
      }
      setShowForm(false)
      await fetchAll()
    } catch (err: any) {
      setError(err.message || tr('Fehler beim Speichern', 'Error while saving'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (group: RingGroup) => {
    if (!confirm(tr(`Gruppe ${group.name} wirklich löschen?`, `Really delete group ${group.name}?`))) return
    try {
      await api.deleteRingGroup(group.id)
      await fetchAll()
    } catch (err: any) {
      alert(err.message || tr('Fehler beim Löschen', 'Error while deleting'))
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-500">{tr('Lade Gruppen…', 'Loading groups...')}</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{tr('Gruppen (Sammelruf)', 'Ring groups')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr('Richten Sie Sammelrufe mit verschiedenen Klingelstrategien ein. Mitglieder werden aus bestehenden Nebenstellen gewählt.', 'Configure ring groups with different ringing strategies. Members are chosen from existing extensions.')}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {tr('Neue Gruppe', 'New group')}
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="mt-6 text-sm text-gray-500">{tr('Noch keine Gruppen angelegt.', 'No groups created yet.')}</div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4">{tr('Name', 'Name')}</th>
                  <th className="py-2 pr-4">{tr('Nummer', 'Number')}</th>
                  <th className="py-2 pr-4">{tr('Strategie', 'Strategy')}</th>
                  <th className="py-2 pr-4">{tr('Mitglieder', 'Members')}</th>
                  <th className="py-2 pr-4">{tr('Klingelzeit', 'Ring time')}</th>
                  <th className="py-2 pr-4">{tr('Status', 'Status')}</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.id} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-3 pr-4 font-medium text-gray-800 dark:text-gray-200">{g.name}</td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">{g.extension}</td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">
                      {STRATEGIES.find(s => s.value === g.strategy)?.label || g.strategy}
                    </td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">
                      {g.members?.length ? g.members.join(', ') : '—'}
                    </td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">{g.ring_time || 20}s</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${g.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {g.enabled ? tr('Aktiv', 'Active') : tr('Inaktiv', 'Inactive')}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openEdit(g)}
                          className="p-2 text-gray-500 hover:text-blue-600"
                          title={tr('Bearbeiten', 'Edit')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(g)}
                          className="p-2 text-gray-500 hover:text-red-600"
                          title={tr('Löschen', 'Delete')}
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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  {editing ? tr('Gruppe bearbeiten', 'Edit group') : tr('Gruppe anlegen', 'Create group')}
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Name', 'Name')}</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder={tr('z.B. Support', 'e.g. Support')}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Gruppen-Nummer', 'Group number')}</label>
                  <select
                    value={form.extension}
                    onChange={e => setForm({ ...form, extension: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  >
                    <option value="">{tr('Bitte wählen', 'Please select')}</option>
                    {availableExtensions.map(ext => (
                      <option key={ext} value={ext}>{ext}</option>
                    ))}
                  </select>
                  {availableExtensions.length === 0 && (
                    <div className="text-xs text-gray-500 mt-1">{tr('Keine freien Nummern im Bereich 1000–1999.', 'No free numbers in the 1000–1999 range.')}</div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Eingehende Rufnummer (optional)', 'Inbound number (optional)')}</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <select
                      value={form.inbound_trunk_id ?? ''}
                      onChange={e => {
                        const nextId = e.target.value ? Number(e.target.value) : null
                        setForm({ ...form, inbound_trunk_id: nextId, inbound_did: '' })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">{tr('Leitung wählen', 'Select trunk')}</option>
                      {trunkOptions.map(t => (
                        <option key={t.trunk_id} value={t.trunk_id}>{t.trunk_name}</option>
                      ))}
                    </select>
                    <select
                      value={form.inbound_did}
                      onChange={e => setForm({ ...form, inbound_did: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      disabled={!form.inbound_trunk_id}
                    >
                      <option value="">{tr('Rufnummer wählen', 'Select number')}</option>
                      {didOptions.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{tr('Wählt eine freie Nummer aus dem Nummernblock der Leitung und legt automatisch eine Inbound-Route an.', 'Selects a free number from the trunk block and creates an inbound route automatically.')}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Strategie', 'Strategy')}</label>
                  <select
                    value={form.strategy}
                    onChange={e => setForm({ ...form, strategy: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {STRATEGIES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Klingelzeit (Sek.)', 'Ring time (sec)')}</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={form.ring_time}
                    onChange={e => setForm({ ...form, ring_time: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{tr('Mitglieder (bestehende Nebenstellen)', 'Members (existing extensions)')}</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  {memberOptions.length === 0 && (
                    <div className="text-sm text-gray-500">{tr('Keine Nebenstellen verfügbar', 'No extensions available')}</div>
                  )}
                  {memberOptions.map(p => (
                    <label key={p.extension} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={form.members.includes(p.extension)}
                        onChange={() => toggleMember(p.extension)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{p.extension}{p.caller_id ? ` – ${p.caller_id}` : ''}</span>
                    </label>
                  ))}
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
                  {tr('Aktiv', 'Active')}
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                  >
                    {tr('Abbrechen', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
                  >
                    {saving ? tr('Speichern…', 'Saving...') : tr('Speichern', 'Save')}
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
