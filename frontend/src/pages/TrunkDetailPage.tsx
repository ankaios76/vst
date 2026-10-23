import { useState, useEffect } from 'react'
import { ArrowLeft, Server, CheckCircle, XCircle, Wifi, Phone, BarChart3, Clock, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { api } from '../services/api'
import { useI18n } from '../context/I18nContext'

interface Props {
  trunkId: number
  onBack: () => void
}

export default function TrunkDetailPage({ trunkId, onBack }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { tr } = useI18n()
  const PROVIDER_INFO: Record<string, { label: string; logo?: string }> = {
    plusnet_basic: { label: 'Plusnet IPfonie Basic/Extended' },
    plusnet_connect: { label: 'Plusnet IPfonie Extended Connect' },
    telekom_deutschlandlan: { label: tr('Telekom DeutschlandLAN SIP-Trunk', 'Telekom DeutschlandLAN SIP Trunk'), logo: '/logos/telekom.jpg' },
    telekom_companyflex: { label: tr('Telekom CompanyFlex SIP-Trunk', 'Telekom CompanyFlex SIP Trunk'), logo: '/logos/telekom.jpg' },
    telekom_allip: { label: tr('Telekom All-IP (Privat)', 'Telekom All-IP (Residential)'), logo: '/logos/telekom.jpg' },
    iliad_it: { label: tr('Iliad (Italien)', 'Iliad (Italy)') },
  }

  const fetchStatus = async () => {
    try {
      const result = await api.getTrunkStatus(trunkId)
      setData(result)
      setError(null)
    } catch (err: any) {
      setError(err.message || tr('Fehler beim Laden', 'Error loading data'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [trunkId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={onBack} className="flex items-center gap-2 text-muted hover:text-content mb-4">
          <ArrowLeft className="w-5 h-5" />
          {tr('Zurück', 'Back')}
        </button>
        <div className="bg-surface-subtle border border-red-500 rounded-input p-6 text-center text-danger">
          {error || tr('Trunk nicht gefunden', 'Trunk not found')}
        </div>
      </div>
    )
  }

  const { trunk, registration, endpoint, routes, stats } = data
  const provider = PROVIDER_INFO[trunk.provider]
  const isRegistered = registration.status === 'registered'

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-input hover:bg-surface-hover transition"
        >
          <ArrowLeft className="w-5 h-5 text-muted" />
        </button>
        <div className="flex items-center gap-3">
          {provider?.logo ? (
            <img
              src={provider.logo}
              alt={provider.label}
              className="w-12 h-12 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div className="p-2 bg-surface-subtle rounded-input">
              <Server className="w-8 h-8 text-muted" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-content">{trunk.name}</h1>
            <p className="text-muted">
              {provider?.label || trunk.provider} &mdash; {trunk.sip_server}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Registrierung */}
        <div className="bg-surface rounded-input shadow">
          <div className="px-6 py-4 border-b border-subtle flex items-center gap-2">
            {isRegistered
              ? <CheckCircle className="w-5 h-5 text-success" />
              : <XCircle className="w-5 h-5 text-danger" />
            }
            <h2 className="text-lg font-semibold text-content">{tr('Registrierung', 'Registration')}</h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-sm text-muted">{tr('Status', 'Status')}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                    isRegistered
                      ? 'bg-surface-subtle text-success'
                      : 'bg-surface-subtle text-danger'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${isRegistered ? 'bg-success' : 'bg-danger'}`} />
                    {isRegistered ? tr('Registriert', 'Registered') : registration.status || tr('Nicht registriert', 'Not registered')}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted">{tr('Auth-Modus', 'Auth mode')}</div>
                <div className="font-medium mt-1">
                  {trunk.auth_mode === 'registration' ? tr('Registrierung', 'Registration') : tr('IP-Authentifizierung', 'IP authentication')}
                </div>
              </div>
              {registration.expires && (
                <div>
                  <div className="text-sm text-muted">{tr('Nächste Registrierung', 'Next registration')}</div>
                  <div className="font-medium mt-1 flex items-center gap-1">
                    <Clock className="w-4 h-4 text-muted" />
                    {registration.expires}
                  </div>
                </div>
              )}
            </div>

            {registration.last_response && (
              <div>
                <div className="text-sm text-muted mb-1">{tr('Letzte SIP-Nachricht', 'Last SIP message')}</div>
                <pre className="bg-surface text-success text-xs p-4 rounded-input overflow-x-auto font-mono">
                  {registration.last_response}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Verbindung */}
        <div className="bg-surface rounded-input shadow">
          <div className="px-6 py-4 border-b border-subtle flex items-center gap-2">
            <Wifi className="w-5 h-5 text-muted" />
            <h2 className="text-lg font-semibold text-content">{tr('Verbindung', 'Connection')}</h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted">{tr('Server', 'Server')}</div>
                <div className="font-medium mt-1 font-mono text-sm">{trunk.sip_server}</div>
              </div>
              <div>
                <div className="text-sm text-muted">{tr('Endpoint-Status', 'Endpoint status')}</div>
                <div className="font-medium mt-1">
                  {endpoint.state === 'Not in use' ? tr('Online (Idle)', 'Online (Idle)') : endpoint.state}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted">{tr('RTT / Latenz', 'RTT / latency')}</div>
                <div className="font-medium mt-1">
                  {endpoint.rtt != null && endpoint.rtt > 0
                    ? `${endpoint.rtt} ms`
                    : 'N/A'
                  }
                </div>
              </div>
              {endpoint.contact_uri && (
                <div className="md:col-span-3">
                  <div className="text-sm text-muted">{tr('Contact URI', 'Contact URI')}</div>
                  <div className="font-mono text-sm mt-1 text-content break-all">{endpoint.contact_uri}</div>
                </div>
              )}
              {trunk.username && (
                <div>
                  <div className="text-sm text-muted">{tr('Benutzername', 'Username')}</div>
                  <div className="font-medium mt-1 font-mono text-sm">{trunk.username}</div>
                </div>
              )}
              {trunk.codecs && (
                <div>
                  <div className="text-sm text-muted">{tr('Codecs', 'Codecs')}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {trunk.codecs.split(',').map((c: string) => (
                      <span key={c} className="text-xs bg-surface-subtle text-content px-2 py-0.5 rounded">{c.trim()}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rufnummern */}
        <div className="bg-surface rounded-input shadow">
          <div className="px-6 py-4 border-b border-subtle flex items-center gap-2">
            <Phone className="w-5 h-5 text-muted" />
            <h2 className="text-lg font-semibold text-content">{tr('Zugeordnete Rufnummern', 'Assigned numbers')}</h2>
            {routes.length > 0 && (
              <span className="bg-surface-subtle text-success text-xs px-2 py-0.5 rounded-full">{routes.length}</span>
            )}
          </div>
          <div className="divide-y">
            {routes.length > 0 ? (
              routes.map((route: any) => (
                <div key={route.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-success" />
                    <div>
                      <span className="font-medium font-mono">{route.did}</span>
                      {route.description && (
                        <span className="text-sm text-muted ml-2">{route.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted">
                    {tr('Ziel', 'Target')}: <span className="font-medium">{route.destination_extension}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-6 text-center text-muted">
                {tr('Keine Rufnummern zugeordnet', 'No numbers assigned')}
              </div>
            )}
          </div>
          {trunk.number_block && (
            <div className="px-6 py-3 border-t border-subtle bg-surface-subtle text-sm text-muted">
              {tr('Nummernblock', 'Number block')}: <span className="font-mono font-medium">{trunk.number_block}</span>
            </div>
          )}
        </div>

        {/* Statistik */}
        <div className="bg-surface rounded-input shadow">
          <div className="px-6 py-4 border-b border-subtle flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-muted" />
            <h2 className="text-lg font-semibold text-content">{tr('Statistik', 'Statistics')}</h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface-subtle rounded-input p-4 text-center">
                <div className="text-2xl font-bold text-content">{stats.calls_today}</div>
                <div className="text-sm text-muted">{tr('Anrufe heute', 'Calls today')}</div>
              </div>
              <div className="bg-surface-subtle rounded-input p-4 text-center">
                <div className="text-2xl font-bold text-content">{stats.calls_week}</div>
                <div className="text-sm text-muted">{tr('Diese Woche', 'This week')}</div>
              </div>
              <div className="bg-surface-subtle rounded-input p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <ArrowDownLeft className="w-4 h-4 text-success" />
                  <span className="text-2xl font-bold text-success">{stats.inbound_today}</span>
                </div>
                <div className="text-sm text-success">{tr('Eingehend heute', 'Inbound today')}</div>
              </div>
              <div className="bg-surface-accent rounded-input p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <ArrowUpRight className="w-4 h-4 text-link" />
                  <span className="text-2xl font-bold text-link">{stats.outbound_today}</span>
                </div>
                <div className="text-sm text-link">{tr('Ausgehend heute', 'Outbound today')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
