import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Phone, PhoneOff, Server, RefreshCw } from 'lucide-react'
import { useI18n } from '../context/I18nContext'

interface ExtensionsPageProps {
  mode: 'peers' | 'trunks'
}
import { api } from '../services/api'

interface SIPPeer {
  id: number
  extension: string
  secret: string
  caller_id: string | null
  context: string
  pickup_group?: string | null
  enabled: boolean
  created_at: string
  updated_at: string
}

interface SIPTrunk {
  id: number
  name: string
  provider: string
  auth_mode: string
  sip_server: string
  username: string | null
  password: string | null
  caller_id: string | null
  number_block: string | null
  context: string
  codecs: string
  from_user: string | null
  enabled: boolean
  created_at: string
  updated_at: string
}

export default function ExtensionsPage({ mode }: ExtensionsPageProps) {
  const activeTab = mode
  const { tr } = useI18n()
  const PROVIDERS: Record<string, { label: string; supportsIp: boolean; requiresServerInput?: boolean; server?: string; serverRegistration?: string; serverIp?: string; hint?: string }> = {
    plusnet_basic: { label: 'Plusnet IPfonie Basic/Extended', server: 'sip.ipfonie.de', supportsIp: false },
    plusnet_connect: { label: 'Plusnet IPfonie Extended Connect', server: 'sipconnect.ipfonie.de', supportsIp: true },
    dusnet: { label: 'dus.net', server: 'proxy.dus.net', supportsIp: false },
    iliad_it: {
      label: tr('Iliad (Italien)', 'Iliad (Italy)'),
      supportsIp: false,
      server: 'voip.iliad.it',
      hint: tr(
        'Iliad: Registrar/Proxy voip.iliad.it. Benutzername/Passwort wie von Iliad vergeben. Rufnummer für Anmeldung im Feld "From-User".',
        'Iliad: registrar/proxy voip.iliad.it. Use the Iliad username/password. Put the login phone number in "From-User".'
      ),
    },
    telekom_deutschlandlan: {
      label: tr('Telekom DeutschlandLAN SIP-Trunk', 'Telekom DeutschlandLAN SIP Trunk'),
      supportsIp: true,
      serverRegistration: 'reg.sip-trunk.telekom.de',
      serverIp: 'stat.sip-trunk.telekom.de',
      hint: tr(
        'Telekom: SIP-Signalisierung nur TCP. Outbound-Proxy per DNS; keine IP fest hinterlegen.',
        'Telekom: SIP signaling via TCP only. Use DNS for outbound proxy; do not pin a fixed IP.'
      ),
    },
    telekom_companyflex: {
      label: tr('Telekom CompanyFlex SIP-Trunk', 'Telekom CompanyFlex SIP Trunk'),
      supportsIp: false,
      requiresServerInput: true,
      hint: tr(
        'Outbound-Proxy enthält die 12-stellige CompanyFlex-ID, z.B. <id>.primary.companyflex.de',
        'Outbound proxy contains the 12-digit CompanyFlex ID, e.g. <id>.primary.companyflex.de'
      ),
    },
    telekom_allip: {
      label: tr('Telekom All-IP (Privat)', 'Telekom All-IP (Residential)'),
      supportsIp: false,
      server: 'tel.t-online.de',
      hint: tr(
        'Telekom Privatkundenanschluss (MagentaZuhause). E-Mail-Adresse als Benutzername, Rufnummer als From-User im E.164-Format (+49...).',
        'Telekom residential (MagentaZuhause). Use email as username and the phone number as From-User in E.164 format (+49...).'
      ),
    },
    custom: { label: tr('Anderer Provider', 'Other provider'), supportsIp: true },
  }

  // --- Peers state ---
  const [peers, setPeers] = useState<SIPPeer[]>([])
  const [loadingPeers, setLoadingPeers] = useState(true)
  const [showPeerForm, setShowPeerForm] = useState(false)
  const [editingPeer, setEditingPeer] = useState<SIPPeer | null>(null)
  const [peerForm, setPeerForm] = useState({
    extension: '',
    secret: '',
    caller_id: '',
    context: 'internal',
    enabled: true
  })

  // --- Trunks state ---
  const [trunks, setTrunks] = useState<SIPTrunk[]>([])
  const [loadingTrunks, setLoadingTrunks] = useState(true)
  const [showTrunkForm, setShowTrunkForm] = useState(false)
  const [editingTrunk, setEditingTrunk] = useState<SIPTrunk | null>(null)
  const [trunkForm, setTrunkForm] = useState({
    name: '',
    provider: 'plusnet_basic',
    auth_mode: 'registration',
    sip_server: '',
    username: '',
    password: '',
    caller_id: '',
    number_block: '',
    from_user: '',
    enabled: true,
  })

  useEffect(() => {
    fetchPeers()
    fetchTrunks()
  }, [])

  // ==================== PEERS ====================
  const fetchPeers = async () => {
    try {
      const data = await api.getSipPeers()
      setPeers(data)
    } catch (error) {
      console.error(tr('Fehler beim Laden der Nebenstellen:', 'Error fetching extensions:'), error)
    } finally {
      setLoadingPeers(false)
    }
  }

  const handlePeerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingPeer) {
        await api.updateSipPeer(editingPeer.id, peerForm)
      } else {
        await api.createSipPeer(peerForm)
      }
      setPeerForm({ extension: '', secret: '', caller_id: '', context: 'internal', enabled: true })
      setShowPeerForm(false)
      setEditingPeer(null)
      fetchPeers()
    } catch (error: any) {
      alert(error.message || tr('Fehler beim Speichern', 'Error while saving'))
    }
  }

  const handlePeerEdit = (peer: SIPPeer) => {
    setEditingPeer(peer)
    setPeerForm({
      extension: peer.extension,
      secret: peer.secret,
      caller_id: peer.caller_id || '',
      context: peer.context,
      enabled: peer.enabled
    })
    setShowPeerForm(true)
  }

  const handlePeerDelete = async (peer: SIPPeer) => {
    if (!confirm(tr(`Wirklich Nebenstelle ${peer.extension} löschen?`, `Really delete extension ${peer.extension}?`))) return
    try {
      await api.deleteSipPeer(peer.id)
      fetchPeers()
    } catch (error: any) {
      alert(error.message || tr('Fehler beim Löschen', 'Error while deleting'))
    }
  }

  const handlePeerCancel = () => {
    setShowPeerForm(false)
    setEditingPeer(null)
    setPeerForm({ extension: '', secret: '', caller_id: '', context: 'internal', enabled: true })
  }

  // ==================== TRUNKS ====================
  const fetchTrunks = async () => {
    try {
      const data = await api.getTrunks()
      setTrunks(data)
    } catch (error) {
      console.error(tr('Fehler beim Laden der Leitungen:', 'Error fetching trunks:'), error)
    } finally {
      setLoadingTrunks(false)
    }
  }

  const handleTrunkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const requiresServerInput = trunkForm.provider === 'custom' || PROVIDERS[trunkForm.provider]?.requiresServerInput
      const payload = {
        ...trunkForm,
        sip_server: requiresServerInput ? trunkForm.sip_server : null,
        username: trunkForm.auth_mode === 'registration' ? trunkForm.username : null,
        password: trunkForm.auth_mode === 'registration' ? trunkForm.password : null,
        from_user: trunkForm.from_user || null,
      }
      if (editingTrunk) {
        await api.updateTrunk(editingTrunk.id, payload)
      } else {
        await api.createTrunk(payload)
      }
      resetTrunkForm()
      setShowTrunkForm(false)
      setEditingTrunk(null)
      fetchTrunks()
    } catch (error: any) {
      alert(error.message || tr('Fehler beim Speichern', 'Error while saving'))
    }
  }

  const handleTrunkEdit = (trunk: SIPTrunk) => {
    setEditingTrunk(trunk)
    setTrunkForm({
      name: trunk.name,
      provider: trunk.provider,
      auth_mode: trunk.auth_mode,
      sip_server: trunk.sip_server || '',
      username: trunk.username || '',
      password: trunk.password || '',
      caller_id: trunk.caller_id || '',
      number_block: trunk.number_block || '',
      from_user: trunk.from_user || '',
      enabled: trunk.enabled,
    })
    setShowTrunkForm(true)
  }

  const handleTrunkDelete = async (trunk: SIPTrunk) => {
    if (!confirm(tr(`Wirklich Trunk "${trunk.name}" löschen?`, `Really delete trunk "${trunk.name}"?`))) return
    try {
      await api.deleteTrunk(trunk.id)
      fetchTrunks()
    } catch (error: any) {
      alert(error.message || tr('Fehler beim Löschen', 'Error while deleting'))
    }
  }

  const resetTrunkForm = () => {
    setTrunkForm({ name: '', provider: 'plusnet_basic', auth_mode: 'registration', sip_server: '', username: '', password: '', caller_id: '', number_block: '', from_user: '', enabled: true })
  }

  const handleTrunkCancel = () => {
    setShowTrunkForm(false)
    setEditingTrunk(null)
    resetTrunkForm()
  }

  const providerLabel = (key: string, server?: string) => {
    if (key === 'custom') return server || tr('Benutzerdefiniert', 'Custom')
    return PROVIDERS[key]?.label || key
  }

  const getProviderServer = (provider: string, authMode: string, customServer?: string) => {
    if (provider === 'custom') return customServer || ''
    const p = PROVIDERS[provider]
    if (!p) return ''
    if (p.requiresServerInput) return customServer || ''
    if (p.server) return p.server
    if (authMode === 'registration') return p.serverRegistration || ''
    return p.serverIp || ''
  }

  const loading = activeTab === 'peers' ? loadingPeers : loadingTrunks

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {activeTab === 'peers' ? tr('Nebenstellen', 'Extensions') : tr('Leitungen', 'Trunks')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {activeTab === 'peers'
              ? tr('SIP-Nebenstellen anlegen und bearbeiten', 'Create and manage SIP extensions')
              : tr('SIP-Trunks anlegen und bearbeiten', 'Create and manage SIP trunks')}
          </p>
        </div>

        {activeTab === 'peers' && !showPeerForm && (
          <button
            onClick={() => setShowPeerForm(true)}
            className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition"
          >
            <Plus className="w-5 h-5" />
            {tr('Neue Nebenstelle', 'New extension')}
          </button>
        )}
        {activeTab === 'trunks' && !showTrunkForm && (
          <button
            onClick={() => setShowTrunkForm(true)}
            className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition"
          >
            <Plus className="w-5 h-5" />
            {tr('Neue Leitung', 'New trunk')}
          </button>
        )}
      </div>

      {/* ==================== PEERS TAB ==================== */}
      {activeTab === 'peers' && (
        <>
          {showPeerForm && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {editingPeer ? tr('Nebenstelle bearbeiten', 'Edit extension') : tr('Neue Nebenstelle anlegen', 'Create new extension')}
              </h2>
              <form onSubmit={handlePeerSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Nebenstelle (Rufnummer) *', 'Extension (number) *')}</label>
                    <input
                      type="text"
                      value={peerForm.extension}
                      onChange={(e) => setPeerForm({...peerForm, extension: e.target.value})}
                      placeholder={tr('z.B. 1002', 'e.g. 1002')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      required
                      disabled={!!editingPeer}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Passwort *', 'Password *')}</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={peerForm.secret}
                        onChange={(e) => setPeerForm({...peerForm, secret: e.target.value})}
                        placeholder={tr('Sicheres Passwort', 'Strong password')}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        required
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await api.generatePassword()
                            setPeerForm({...peerForm, secret: res.password})
                          } catch {}
                        }}
                        className="flex items-center gap-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm whitespace-nowrap"
                        title={tr('Passwort generieren', 'Generate password')}
                      >
                        <RefreshCw className="w-4 h-4" />
                        {tr('Generieren', 'Generate')}
                      </button>
                    </div>
                    {peerForm.secret && (() => {
                      const pw = peerForm.secret
                      const ext = peerForm.extension
                      let score = 0
                      const warnings: string[] = []
                      if (pw.length >= 16) score += 30
                      else if (pw.length >= 12) score += 20
                      else if (pw.length >= 8) { score += 10; warnings.push(tr('Mindestens 12 Zeichen empfohlen', 'At least 12 characters recommended')) }
                      else warnings.push(tr('Zu kurz', 'Too short'))
                      if (/[a-z]/.test(pw)) score += 15; else warnings.push(tr('Kleinbuchstaben fehlen', 'Missing lowercase letters'))
                      if (/[A-Z]/.test(pw)) score += 15; else warnings.push(tr('Großbuchstaben fehlen', 'Missing uppercase letters'))
                      if (/\d/.test(pw)) score += 15; else warnings.push(tr('Ziffern fehlen', 'Missing digits'))
                      if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]/.test(pw)) score += 15; else warnings.push(tr('Sonderzeichen fehlen', 'Missing special characters'))
                      if (ext && pw.includes(ext)) { score = Math.max(0, score - 20); warnings.push(tr('Enthält Nebenstelle', 'Contains extension')) }
                      if (pw.length >= 20) score = Math.min(100, score + 10)
                      const level = score >= 70 ? 'strong' : score >= 40 ? 'medium' : 'weak'
                      const color = level === 'strong' ? 'bg-green-500' : level === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                      const label = level === 'strong' ? tr('Stark', 'Strong') : level === 'medium' ? tr('Mittel', 'Medium') : tr('Schwach', 'Weak')
                      return (
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className={`h-full ${color} transition-all`} style={{ width: `${score}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${level === 'strong' ? 'text-green-600 dark:text-green-400' : level === 'medium' ? 'text-yellow-600' : 'text-red-600 dark:text-red-400'}`}>
                              {label}
                            </span>
                          </div>
                          {warnings.length > 0 && level !== 'strong' && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{warnings.join(', ')}</p>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Caller ID', 'Caller ID')}</label>
                    <input
                      type="text"
                      value={peerForm.caller_id}
                      onChange={(e) => setPeerForm({...peerForm, caller_id: e.target.value})}
                      placeholder={tr('Max Mustermann', 'John Doe')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Context</label>
                    <select
                      value={peerForm.context}
                      onChange={(e) => setPeerForm({...peerForm, context: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="internal">internal</option>
                      <option value="default">default</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="peer-enabled"
                    checked={peerForm.enabled}
                    onChange={(e) => setPeerForm({...peerForm, enabled: e.target.checked})}
                    className="w-4 h-4 text-primary-500 rounded"
                  />
                  <label htmlFor="peer-enabled" className="text-sm text-gray-700 dark:text-gray-300">{tr('Nebenstelle aktiviert', 'Extension enabled')}</label>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">
                    {editingPeer ? tr('Speichern', 'Save') : tr('Anlegen', 'Create')}
                  </button>
                  <button type="button" onClick={handlePeerCancel} className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
                    {tr('Abbrechen', 'Cancel')}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tr('Aktive Nebenstellen', 'Active extensions')} ({peers.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{tr('Nebenstelle', 'Extension')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{tr('Caller ID', 'Caller ID')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{tr('Context', 'Context')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{tr('Status', 'Status')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{tr('Aktionen', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {peers.map((peer) => (
                    <tr key={peer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          <span className="font-medium text-gray-900 dark:text-gray-100">{peer.extension}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900 dark:text-gray-100">{peer.caller_id || '-'}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm">{peer.context}</span>
                      </td>
                      <td className="px-6 py-4">
                        {peer.enabled ? (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <Phone className="w-4 h-4" /> {tr('Aktiv', 'Active')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
                            <PhoneOff className="w-4 h-4" /> {tr('Deaktiviert', 'Disabled')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => handlePeerEdit(peer)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handlePeerDelete(peer)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ==================== TRUNKS TAB ==================== */}
      {activeTab === 'trunks' && (
        <>
          {showTrunkForm && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {editingTrunk ? tr('Leitung bearbeiten', 'Edit trunk') : tr('Neue Leitung anlegen', 'Create new trunk')}
              </h2>
              <form onSubmit={handleTrunkSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Provider *', 'Provider *')}</label>
                    <select
                      value={trunkForm.provider}
                      onChange={(e) => {
                        const provider = e.target.value
                        setTrunkForm({
                          ...trunkForm,
                          provider,
                          sip_server: (provider === 'custom' || PROVIDERS[provider]?.requiresServerInput) ? trunkForm.sip_server : '',
                          auth_mode: PROVIDERS[provider]?.supportsIp ? trunkForm.auth_mode : 'registration',
                        })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      {Object.entries(PROVIDERS).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    {trunkForm.provider !== 'custom' && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {tr('Server', 'Server')}: {getProviderServer(trunkForm.provider, trunkForm.auth_mode, trunkForm.sip_server)}
                      </p>
                    )}
                    {PROVIDERS[trunkForm.provider]?.hint && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {PROVIDERS[trunkForm.provider]?.hint}
                      </p>
                    )}
                    {trunkForm.provider === 'telekom_deutschlandlan' && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                        <div>{tr('SIP-Domain', 'SIP domain')}: <span className="font-mono">sip-trunk.telekom.de</span></div>
                        <div>{tr('Outbound-Proxy (Reg)', 'Outbound proxy (Reg)')}: <span className="font-mono">reg.sip-trunk.telekom.de</span></div>
                        <div>{tr('Outbound-Proxy (IP)', 'Outbound proxy (IP)')}: <span className="font-mono">stat.sip-trunk.telekom.de</span></div>
                        <div>{tr('Transport', 'Transport')}: <span className="font-medium">TCP</span> (SIP), {tr('RTP über UDP', 'RTP over UDP')}</div>
                        <div>{tr('Codecs', 'Codecs')}: <span className="font-mono">g722, alaw</span></div>
                      </div>
                    )}
                    {trunkForm.provider === 'telekom_companyflex' && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                        <div>{tr('SIP-Domain', 'SIP domain')}: <span className="font-mono">tel.t-online.de</span></div>
                        <div>{tr('Outbound-Proxy', 'Outbound proxy')}: <span className="font-mono">&lt;companyflex-id&gt;.primary.companyflex.de</span></div>
                        <div>{tr('Benutzername', 'Username')}: <span className="font-mono">{tr('Registrierungsrufnummer', 'Registration number')}</span></div>
                        <div>{tr('Auth-User', 'Auth user')}: <span className="font-mono">+49...@tel.t-online.de</span></div>
                        <div>{tr('Transport', 'Transport')}: <span className="font-medium">TCP</span> {tr('empfohlen', 'recommended')}</div>
                      </div>
                    )}
                    {trunkForm.provider === 'telekom_allip' && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                        <div>{tr('Registrar', 'Registrar')}: <span className="font-mono">tel.t-online.de</span></div>
                        <div>{tr('Benutzername', 'Username')}: <span className="font-mono">{tr('E-Mail-Adresse (z.B. name@t-online.de)', 'Email address (e.g. name@t-online.de)')}</span></div>
                        <div>{tr('Passwort', 'Password')}: <span className="font-mono">{tr('E-Mail-/Kundencenter-Passwort', 'Email/customer center password')}</span></div>
                        <div>{tr('From-User', 'From-User')}: <span className="font-mono">{tr('Rufnummer E.164 (+49VorwahlRufnummer)', 'E.164 number (+49...number)')}</span></div>
                        <div>{tr('Transport', 'Transport')}: <span className="font-medium">TCP</span></div>
                        <div>{tr('Codecs', 'Codecs')}: <span className="font-mono">g722, alaw</span></div>
                      </div>
                    )}
                  </div>

                  {(trunkForm.provider === 'custom' || PROVIDERS[trunkForm.provider]?.requiresServerInput) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {trunkForm.provider === 'telekom_companyflex' ? tr('Outbound-Proxy *', 'Outbound proxy *') : tr('SIP-Server *', 'SIP server *')}
                      </label>
                      <input
                        type="text"
                        value={trunkForm.sip_server}
                        onChange={(e) => setTrunkForm({...trunkForm, sip_server: e.target.value})}
                        placeholder={trunkForm.provider === 'telekom_companyflex' ? tr('z.B. 55XXXXXXXXXX.primary.companyflex.de', 'e.g. 55XXXXXXXXXX.primary.companyflex.de') : tr('z.B. sip.provider.de', 'e.g. sip.provider.com')}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        required
                      />
                    </div>
                  )}

                  {PROVIDERS[trunkForm.provider]?.supportsIp && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Auth-Modus *', 'Auth mode *')}</label>
                      <select
                        value={trunkForm.auth_mode}
                        onChange={(e) => setTrunkForm({...trunkForm, auth_mode: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="registration">{tr('Registrierung (Username/Passwort)', 'Registration (username/password)')}</option>
                        <option value="ip">{tr('Fix-IP Authentifizierung', 'Fixed IP authentication')}</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Name *', 'Name *')}</label>
                    <input
                      type="text"
                      value={trunkForm.name}
                      onChange={(e) => setTrunkForm({...trunkForm, name: e.target.value})}
                      placeholder={tr('z.B. Plusnet Hauptanschluss', 'e.g. Plusnet main line')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>

                  {trunkForm.auth_mode === 'registration' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Username *', 'Username *')}</label>
                        <input
                          type="text"
                          value={trunkForm.username}
                          onChange={(e) => setTrunkForm({...trunkForm, username: e.target.value})}
                          placeholder={tr('SIP-Username', 'SIP username')}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Passwort *', 'Password *')}</label>
                        <input
                          type="password"
                          value={trunkForm.password}
                          onChange={(e) => setTrunkForm({...trunkForm, password: e.target.value})}
                          placeholder={tr('SIP-Passwort', 'SIP password')}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          required
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Rufnummernblock', 'Number block')}</label>
                    <input
                      type="text"
                      value={trunkForm.number_block}
                      onChange={(e) => setTrunkForm({...trunkForm, number_block: e.target.value})}
                      placeholder={tr('z.B. +4922112345', 'e.g. +4922112345')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Caller-ID', 'Caller ID')}</label>
                    <input
                      type="text"
                      value={trunkForm.caller_id}
                      onChange={(e) => setTrunkForm({...trunkForm, caller_id: e.target.value})}
                      placeholder={tr('Ausgehende Rufnummer', 'Outbound caller ID')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  {(trunkForm.provider === 'telekom_allip' || trunkForm.provider === 'iliad_it') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {trunkForm.provider === 'iliad_it'
                          ? tr('From-User / Rufnummer für Anmeldung *', 'From-User / login number *')
                          : tr('From-User / Anschlussnummer *', 'From-User / access number *')}
                      </label>
                      <input
                        type="text"
                        value={trunkForm.from_user}
                        onChange={(e) => setTrunkForm({...trunkForm, from_user: e.target.value})}
                        placeholder={trunkForm.provider === 'iliad_it' ? 'z.B. +39XXXXXXXXXX' : 'z.B. +492211234567'}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        required
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {trunkForm.provider === 'iliad_it'
                          ? tr('Ihre Iliad-Telefonnummer inkl. Vorwahl im E.164-Format. Wird als From-User und Contact-User verwendet.', 'Your Iliad phone number incl. area code in E.164 format. Used as From-User and Contact-User.')
                          : tr('Ihre Anschlussnummer im E.164-Format. Wird als From-User und P-Preferred-Identity verwendet.', 'Your access number in E.164 format. Used as From-User and P-Preferred-Identity.')}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="trunk-enabled"
                    checked={trunkForm.enabled}
                    onChange={(e) => setTrunkForm({...trunkForm, enabled: e.target.checked})}
                    className="w-4 h-4 text-primary-500 rounded"
                  />
                  <label htmlFor="trunk-enabled" className="text-sm text-gray-700 dark:text-gray-300">{tr('Leitung aktiviert', 'Trunk enabled')}</label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="submit" className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">
                    {editingTrunk ? tr('Speichern', 'Save') : tr('Anlegen', 'Create')}
                  </button>
                  <button type="button" onClick={handleTrunkCancel} className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
                    {tr('Abbrechen', 'Cancel')}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tr('Leitungen', 'Trunks')} ({trunks.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{tr('Name', 'Name')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{tr('Provider', 'Provider')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{tr('Server', 'Server')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{tr('Auth-Modus', 'Auth mode')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{tr('Status', 'Status')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{tr('Aktionen', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {trunks.map((trunk) => (
                    <tr key={trunk.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Server className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          <span className="font-medium text-gray-900 dark:text-gray-100">{trunk.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900 dark:text-gray-100">{providerLabel(trunk.provider, trunk.sip_server)}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm">{trunk.sip_server}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-sm ${trunk.auth_mode === 'registration' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400'}`}>
                          {trunk.auth_mode === 'registration' ? tr('Registrierung', 'Registration') : tr('Fix-IP', 'Fixed IP')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {trunk.enabled ? (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <Phone className="w-4 h-4" /> {tr('Aktiv', 'Active')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
                            <PhoneOff className="w-4 h-4" /> {tr('Deaktiviert', 'Disabled')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => handleTrunkEdit(trunk)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleTrunkDelete(trunk)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {trunks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        {tr('Keine Leitungen konfiguriert. Klicken Sie auf "Neue Leitung" um eine anzulegen.', 'No trunks configured. Click "New trunk" to create one.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
