import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Upload, Save, Plus, X, Trash2 } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

interface Contact {
  id: number
  owner_extension?: string | null
  name: string
  internal_extension?: string | null
  external_number?: string | null
  company?: string | null
  tag?: string | null
  note?: string | null
}

interface SIPPeer {
  id: number
  extension: string
  caller_id?: string
  enabled?: boolean
}

const emptyForm = {
  name: '',
  internal_extension: '',
  external_number: '',
  company: '',
  tag: '',
  note: '',
}

export default function ContactsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [scope, setScope] = useState<'global' | 'extension'>(isAdmin ? 'global' : 'extension')
  const [extension, setExtension] = useState<string | null>(user?.extension || null)
  const [extensions, setExtensions] = useState<SIPPeer[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ ...emptyForm })
  const [editingId, setEditingId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const selectedExtension = useMemo(() => {
    if (scope === 'global') return null
    if (extension) return extension
    if (user?.extension) return user.extension
    return null
  }, [scope, extension, user?.extension])

  const loadExtensions = async () => {
    try {
      const peers = await api.getSipPeers()
      const enabledPeers = peers.filter((p: SIPPeer) => p.enabled !== false)
      setExtensions(enabledPeers)
      if (!extension && enabledPeers.length > 0 && !user?.extension) {
        setExtension(enabledPeers[0].extension)
      }
    } catch {
      // ignore
    }
  }

  const loadContacts = async () => {
    setLoading(true)
    setError('')
    try {
      if (scope === 'global') {
        const data = await api.getContacts('global')
        setContacts(data)
      } else {
        if (!selectedExtension) {
          setContacts([])
          setLoading(false)
          return
        }
        const data = await api.getContacts('extension', selectedExtension)
        setContacts(data)
      }
    } catch (e: any) {
      setError(e.message || 'Kontakte konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadExtensions()
  }, [])

  useEffect(() => {
    loadContacts()
  }, [scope, selectedExtension])

  const startEdit = (c: Contact) => {
    setEditingId(c.id)
    setForm({
      name: c.name || '',
      internal_extension: c.internal_extension || '',
      external_number: c.external_number || '',
      company: c.company || '',
      tag: c.tag || '',
      note: c.note || '',
    })
  }

  const resetForm = () => {
    setEditingId(null)
    setForm({ ...emptyForm })
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Name ist erforderlich')
      return
    }
    if (scope === 'extension' && !selectedExtension) {
      setError('Bitte eine Nebenstelle auswählen')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (editingId) {
        await api.updateContact(editingId, form)
        setSuccess('Kontakt aktualisiert')
      } else {
        await api.createContact({
          scope,
          owner_extension: scope === 'extension' ? selectedExtension : undefined,
          ...form,
        })
        setSuccess('Kontakt erstellt')
      }
      resetForm()
      await loadContacts()
    } catch (e: any) {
      setError(e.message || 'Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Kontakt wirklich löschen?')) return
    try {
      await api.deleteContact(id)
      await loadContacts()
    } catch (e: any) {
      setError(e.message || 'Löschen fehlgeschlagen')
    }
  }

  const handleExport = async () => {
    try {
      const blob = await api.exportContacts(scope, scope === 'extension' ? selectedExtension || undefined : undefined)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = scope === 'global' ? 'contacts-global.csv' : `contacts-${selectedExtension || 'extension'}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e.message || 'Export fehlgeschlagen')
    }
  }

  const handleImport = async (file: File) => {
    setError('')
    setSuccess('')
    try {
      await api.importContacts(scope, file, scope === 'extension' ? selectedExtension || undefined : undefined)
      setSuccess('Import erfolgreich')
      await loadContacts()
    } catch (e: any) {
      setError(e.message || 'Import fehlgeschlagen')
    }
  }

  const onPickFile = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Telefonbuch</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Global und pro Nebenstelle verwaltete Kontakte</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImport(file)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
          />
          <button
            onClick={onPickFile}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-2 rounded-lg text-sm">
          {success}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin ? (
            <>
              <button
                onClick={() => setScope('global')}
                className={`px-3 py-2 rounded-lg text-sm ${scope === 'global' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                Globales Telefonbuch
              </button>
              <button
                onClick={() => setScope('extension')}
                className={`px-3 py-2 rounded-lg text-sm ${scope === 'extension' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                Nebenstellen-Telefonbuch
              </button>
              {scope === 'extension' && (
                <select
                  value={selectedExtension || ''}
                  onChange={(e) => setExtension(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {extensions.map((p) => (
                    <option key={p.extension} value={p.extension}>
                      {p.extension} {p.caller_id ? `– ${p.caller_id}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Nebenstellen-Telefonbuch {user?.extension ? `(Nebenstelle ${user.extension})` : ''}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Kontakt {editingId ? 'bearbeiten' : 'anlegen'}</h2>
          {editingId && (
            <button
              onClick={resetForm}
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" /> Abbrechen
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Durchwahl</label>
            <input
              type="text"
              value={form.internal_extension}
              onChange={(e) => setForm({ ...form, internal_extension: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Externe Nummer</label>
            <input
              type="text"
              value={form.external_number}
              onChange={(e) => setForm({ ...form, external_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Firma</label>
            <input
              type="text"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tag/Gruppe</label>
            <input
              type="text"
              value={form.tag}
              onChange={(e) => setForm({ ...form, tag: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notiz</label>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              rows={3}
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-300"
          >
            {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Speichern' : 'Anlegen'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Kontakte</h2>
        </div>
        {loading ? (
          <div className="p-6 text-gray-500 dark:text-gray-400">Lade...</div>
        ) : contacts.length === 0 ? (
          <div className="p-6 text-gray-500 dark:text-gray-400">Noch keine Kontakte vorhanden.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Name</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Durchwahl</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Extern</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Firma</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Tag</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Notiz</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300 w-28">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.internal_extension || '–'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.external_number || '–'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.company || '–'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.tag || '–'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.note || '–'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(c)}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-red-600 hover:text-red-700"
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
    </div>
  )
}
