import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Upload, Save, Plus, X, Trash2 } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../context/I18nContext'

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
  const { tr } = useI18n()
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
      setError(e.message || tr('Kontakte konnten nicht geladen werden', 'Contacts could not be loaded'))
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
      setError(tr('Name ist erforderlich', 'Name is required'))
      return
    }
    if (scope === 'extension' && !selectedExtension) {
      setError(tr('Bitte eine Nebenstelle auswählen', 'Please select an extension'))
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (editingId) {
        await api.updateContact(editingId, form)
        setSuccess(tr('Kontakt aktualisiert', 'Contact updated'))
      } else {
        await api.createContact({
          scope,
          owner_extension: scope === 'extension' ? selectedExtension : undefined,
          ...form,
        })
        setSuccess(tr('Kontakt erstellt', 'Contact created'))
      }
      resetForm()
      await loadContacts()
    } catch (e: any) {
      setError(e.message || tr('Speichern fehlgeschlagen', 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(tr('Kontakt wirklich löschen?', 'Really delete contact?'))) return
    try {
      await api.deleteContact(id)
      await loadContacts()
    } catch (e: any) {
      setError(e.message || tr('Löschen fehlgeschlagen', 'Delete failed'))
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
      setError(e.message || tr('Export fehlgeschlagen', 'Export failed'))
    }
  }

  const handleImport = async (file: File) => {
    setError('')
    setSuccess('')
    try {
      await api.importContacts(scope, file, scope === 'extension' ? selectedExtension || undefined : undefined)
      setSuccess(tr('Import erfolgreich', 'Import successful'))
      await loadContacts()
    } catch (e: any) {
      setError(e.message || tr('Import fehlgeschlagen', 'Import failed'))
    }
  }

  const onPickFile = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-content">{tr('Telefonbuch', 'Contacts')}</h1>
          <p className="text-sm text-muted">{tr('Global und pro Nebenstelle verwaltete Kontakte', 'Contacts managed globally and per extension')}</p>
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
            className="inline-flex items-center gap-2 px-3 py-2 rounded-input bg-surface-subtle hover:bg-surface-subtle text-content"
          >
            <Upload className="w-4 h-4" />
            {tr('Import', 'Import')}
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-input bg-brand hover:bg-brand-hover text-on-primary"
          >
            <Download className="w-4 h-4" />
            {tr('Export', 'Export')}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-surface-subtle border border-red-500 text-danger px-4 py-2 rounded-input text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-surface-subtle border border-green-500 text-success px-4 py-2 rounded-input text-sm">
          {success}
        </div>
      )}

      <div className="bg-surface rounded-card shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin ? (
            <>
              <button
                onClick={() => setScope('global')}
                className={`px-3 py-2 rounded-input text-sm ${scope === 'global' ? 'bg-surface-accent text-link bg-surface-accent' : 'text-content hover:bg-surface-hover'}`}
              >
                {tr('Globales Telefonbuch', 'Global contacts')}
              </button>
              <button
                onClick={() => setScope('extension')}
                className={`px-3 py-2 rounded-input text-sm ${scope === 'extension' ? 'bg-surface-accent text-link bg-surface-accent' : 'text-content hover:bg-surface-hover'}`}
              >
                {tr('Nebenstellen-Telefonbuch', 'Extension contacts')}
              </button>
              {scope === 'extension' && (
                <select
                  value={selectedExtension || ''}
                  onChange={(e) => setExtension(e.target.value)}
                  className="px-3 py-2 border border-subtle rounded-input bg-surface text-content"
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
            <div className="text-sm text-content">
              {tr('Nebenstellen-Telefonbuch', 'Extension contacts')}{' '}
              {user?.extension ? `(${tr('Nebenstelle', 'Extension')} ${user.extension})` : ''}
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface rounded-card shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-content">
            {editingId ? tr('Kontakt bearbeiten', 'Edit contact') : tr('Kontakt anlegen', 'Create contact')}
          </h2>
          {editingId && (
            <button
              onClick={resetForm}
              className="inline-flex items-center gap-2 text-sm text-muted hover:text-content"
            >
              <X className="w-4 h-4" /> {tr('Abbrechen', 'Cancel')}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-content mb-1">{tr('Name', 'Name')} *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link outline-none bg-surface text-content"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content mb-1">{tr('Durchwahl', 'Extension')}</label>
            <input
              type="text"
              value={form.internal_extension}
              onChange={(e) => setForm({ ...form, internal_extension: e.target.value })}
              className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link outline-none bg-surface text-content"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content mb-1">{tr('Externe Nummer', 'External number')}</label>
            <input
              type="text"
              value={form.external_number}
              onChange={(e) => setForm({ ...form, external_number: e.target.value })}
              className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link outline-none bg-surface text-content"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content mb-1">{tr('Firma', 'Company')}</label>
            <input
              type="text"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link outline-none bg-surface text-content"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content mb-1">{tr('Tag/Gruppe', 'Tag/Group')}</label>
            <input
              type="text"
              value={form.tag}
              onChange={(e) => setForm({ ...form, tag: e.target.value })}
              className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link outline-none bg-surface text-content"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-content mb-1">{tr('Notiz', 'Note')}</label>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full px-3 py-2 border border-subtle rounded-input focus:ring-2 focus:ring-link outline-none bg-surface text-content"
              rows={3}
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-input bg-brand hover:bg-brand-hover text-on-primary disabled:bg-ink-400"
          >
            {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? tr('Speichern', 'Save') : tr('Anlegen', 'Create')}
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-card shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-subtle">
          <h2 className="text-lg font-semibold text-content">{tr('Kontakte', 'Contacts')}</h2>
        </div>
        {loading ? (
          <div className="p-6 text-muted">{tr('Lade...', 'Loading...')}</div>
        ) : contacts.length === 0 ? (
          <div className="p-6 text-muted">{tr('Noch keine Kontakte vorhanden.', 'No contacts yet.')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-subtle/50 text-left">
                  <th className="px-4 py-3 font-medium text-content">{tr('Name', 'Name')}</th>
                  <th className="px-4 py-3 font-medium text-content">{tr('Durchwahl', 'Extension')}</th>
                  <th className="px-4 py-3 font-medium text-content">{tr('Extern', 'External')}</th>
                  <th className="px-4 py-3 font-medium text-content">{tr('Firma', 'Company')}</th>
                  <th className="px-4 py-3 font-medium text-content">{tr('Tag', 'Tag')}</th>
                  <th className="px-4 py-3 font-medium text-content">{tr('Notiz', 'Note')}</th>
                  <th className="px-4 py-3 font-medium text-content w-28">{tr('Aktionen', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-t border-subtle">
                    <td className="px-4 py-3 text-content">{c.name}</td>
                    <td className="px-4 py-3 text-content">{c.internal_extension || '–'}</td>
                    <td className="px-4 py-3 text-content">{c.external_number || '–'}</td>
                    <td className="px-4 py-3 text-content">{c.company || '–'}</td>
                    <td className="px-4 py-3 text-content">{c.tag || '–'}</td>
                    <td className="px-4 py-3 text-content">{c.note || '–'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(c)}
                          className="text-link hover:text-link-hover text-sm"
                        >
                          {tr('Bearbeiten', 'Edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-danger hover:text-danger"
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
    </div>
  )
}
