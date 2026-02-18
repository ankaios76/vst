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
    plusnet_basic: { label: 'Plusnet IPfonie Basic/Extended', logo: '/logos/plusnet.svg' },
    plusnet_connect: { label: 'Plusnet IPfonie Extended Connect', logo: '/logos/plusnet.svg' },
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4">
          <ArrowLeft className="w-5 h-5" />
          {tr('Zurück', 'Back')}
        </button>
        <div className="bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center text-red-700 dark:text-red-400">
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
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
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
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Server className="w-8 h-8 text-gray-500 dark:text-gray-400" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{trunk.name}</h1>
            <p className="text-gray-500 dark:text-gray-400">
              {provider?.label || trunk.provider} &mdash; {trunk.sip_server}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Registrierung */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center gap-2">
            {isRegistered
              ? <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              : <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
            }
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tr('Registrierung', 'Registration')}</h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{tr('Status', 'Status')}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                    isRegistered
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${isRegistered ? 'bg-green-500' : 'bg-red-500'}`} />
                    {isRegistered ? tr('Registriert', 'Registered') : registration.status || tr('Nicht registriert', 'Not registered')}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{tr('Auth-Modus', 'Auth mode')}</div>
                <div className="font-medium mt-1">
                  {trunk.auth_mode === 'registration' ? tr('Registrierung', 'Registration') : tr('IP-Authentifizierung', 'IP authentication')}
                </div>
              </div>
              {registration.expires && (
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{tr('Nächste Registrierung', 'Next registration')}</div>
                  <div className="font-medium mt-1 flex items-center gap-1">
                    <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    {registration.expires}
                  </div>
                </div>
              )}
            </div>

            {registration.last_response && (
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{tr('Letzte SIP-Nachricht', 'Last SIP message')}</div>
                <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-x-auto font-mono">
                  {registration.last_response}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Verbindung */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center gap-2">
            <Wifi className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tr('Verbindung', 'Connection')}</h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{tr('Server', 'Server')}</div>
                <div className="font-medium mt-1 font-mono text-sm">{trunk.sip_server}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{tr('Endpoint-Status', 'Endpoint status')}</div>
                <div className="font-medium mt-1">
                  {endpoint.state === 'Not in use' ? tr('Online (Idle)', 'Online (Idle)') : endpoint.state}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{tr('RTT / Latenz', 'RTT / latency')}</div>
                <div className="font-medium mt-1">
                  {endpoint.rtt != null && endpoint.rtt > 0
                    ? `${endpoint.rtt} ms`
                    : 'N/A'
                  }
                </div>
              </div>
              {endpoint.contact_uri && (
                <div className="md:col-span-3">
                  <div className="text-sm text-gray-500 dark:text-gray-400">{tr('Contact URI', 'Contact URI')}</div>
                  <div className="font-mono text-sm mt-1 text-gray-700 dark:text-gray-300 break-all">{endpoint.contact_uri}</div>
                </div>
              )}
              {trunk.username && (
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{tr('Benutzername', 'Username')}</div>
                  <div className="font-medium mt-1 font-mono text-sm">{trunk.username}</div>
                </div>
              )}
              {trunk.codecs && (
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{tr('Codecs', 'Codecs')}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {trunk.codecs.split(',').map((c: string) => (
                      <span key={c} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">{c.trim()}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rufnummern */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center gap-2">
            <Phone className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tr('Zugeordnete Rufnummern', 'Assigned numbers')}</h2>
            {routes.length > 0 && (
              <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs px-2 py-0.5 rounded-full">{routes.length}</span>
            )}
          </div>
          <div className="divide-y dark:divide-gray-700">
            {routes.length > 0 ? (
              routes.map((route: any) => (
                <div key={route.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-green-500" />
                    <div>
                      <span className="font-medium font-mono">{route.did}</span>
                      {route.description && (
                        <span className="text-sm text-gray-400 dark:text-gray-500 ml-2">{route.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {tr('Ziel', 'Target')}: <span className="font-medium">{route.destination_extension}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-6 text-center text-gray-500 dark:text-gray-400">
                {tr('Keine Rufnummern zugeordnet', 'No numbers assigned')}
              </div>
            )}
          </div>
          {trunk.number_block && (
            <div className="px-6 py-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-sm text-gray-600 dark:text-gray-400">
              {tr('Nummernblock', 'Number block')}: <span className="font-mono font-medium">{trunk.number_block}</span>
            </div>
          )}
        </div>

        {/* Statistik */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{tr('Statistik', 'Statistics')}</h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.calls_today}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{tr('Anrufe heute', 'Calls today')}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.calls_week}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{tr('Diese Woche', 'This week')}</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <ArrowDownLeft className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.inbound_today}</span>
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">{tr('Eingehend heute', 'Inbound today')}</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <ArrowUpRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.outbound_today}</span>
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400">{tr('Ausgehend heute', 'Outbound today')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
