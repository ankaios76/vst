import { useState, useEffect, FormEvent } from 'react'
import { Save, Send, Eye, EyeOff, Mail } from 'lucide-react'
import { api } from '../services/api'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [formData, setFormData] = useState({
    smtp_host: '',
    smtp_port: '587',
    smtp_tls: 'true',
    smtp_user: '',
    smtp_password: '',
    smtp_from: '',
  })

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await api.getSettings()
        setFormData({
          smtp_host: data.smtp_host || '',
          smtp_port: data.smtp_port || '587',
          smtp_tls: data.smtp_tls || 'true',
          smtp_user: data.smtp_user || '',
          smtp_password: data.smtp_password || '',
          smtp_from: data.smtp_from || '',
        })
      } catch {
        setError('Einstellungen konnten nicht geladen werden')
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      await api.updateSettings(formData)
      setSuccess('Einstellungen gespeichert')
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const handleTestEmail = async () => {
    if (!testEmail) {
      setError('Bitte Empfänger-Adresse eingeben')
      return
    }
    setError('')
    setSuccess('')
    setTesting(true)
    try {
      await api.sendTestEmail(testEmail)
      setSuccess(`Test-E-Mail an ${testEmail} gesendet`)
    } catch (err: any) {
      setError(err.message || 'Test-E-Mail konnte nicht gesendet werden')
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Lade Einstellungen...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Einstellungen</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Mail className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-800">SMTP E-Mail-Konfiguration</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Konfigurieren Sie den SMTP-Server für den Versand von Voicemail-Benachrichtigungen per E-Mail.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP-Server</label>
              <input
                type="text"
                value={formData.smtp_host}
                onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="mail.example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
              <input
                type="text"
                value={formData.smtp_port}
                onChange={(e) => setFormData({ ...formData, smtp_port: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="587"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Benutzername</label>
              <input
                type="text"
                value={formData.smtp_user}
                onChange={(e) => setFormData({ ...formData, smtp_user: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.smtp_password}
                  onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Passwort"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Absender-Adresse</label>
              <input
                type="email"
                value={formData.smtp_from}
                onChange={(e) => setFormData({ ...formData, smtp_from: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="voicemail@example.com"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.smtp_tls === 'true'}
                  onChange={(e) => setFormData({ ...formData, smtp_tls: e.target.checked ? 'true' : 'false' })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">TLS verwenden</span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>

      {/* Test Email Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Test-E-Mail senden</h2>
        <p className="text-sm text-gray-500 mb-4">
          Senden Sie eine Test-E-Mail, um die SMTP-Konfiguration zu überprüfen.
        </p>
        <div className="flex gap-3">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-1 max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="empfaenger@example.com"
          />
          <button
            onClick={handleTestEmail}
            disabled={testing}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-2 rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
            {testing ? 'Sende...' : 'Senden'}
          </button>
        </div>
      </div>
    </div>
  )
}
