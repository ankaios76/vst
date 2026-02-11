import { useState, useEffect } from 'react'
import { ArrowLeft, Server, CheckCircle, XCircle, Wifi, Phone, BarChart3, Clock, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { api } from '../services/api'

interface Props {
  trunkId: number
  onBack: () => void
}

const PROVIDER_INFO: Record<string, { label: string; logo?: string }> = {
  plusnet_basic: { label: 'Plusnet IPfonie Basic/Extended', logo: '/logos/plusnet.svg' },
  plusnet_connect: { label: 'Plusnet IPfonie Extended Connect', logo: '/logos/plusnet.svg' },
}

export default function TrunkDetailPage({ trunkId, onBack }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      const result = await api.getTrunkStatus(trunkId)
      setData(result)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden')
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
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-5 h-5" />
          Zurück
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-700">
          {error || 'Trunk nicht gefunden'}
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
          className="p-2 rounded-lg hover:bg-gray-100 transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
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
            <div className="p-2 bg-gray-100 rounded-lg">
              <Server className="w-8 h-8 text-gray-500" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{trunk.name}</h1>
            <p className="text-gray-500">
              {provider?.label || trunk.provider} &mdash; {trunk.sip_server}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Registrierung */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b flex items-center gap-2">
            {isRegistered
              ? <CheckCircle className="w-5 h-5 text-green-600" />
              : <XCircle className="w-5 h-5 text-red-500" />
            }
            <h2 className="text-lg font-semibold text-gray-900">Registrierung</h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-sm text-gray-500">Status</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
                    isRegistered
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${isRegistered ? 'bg-green-500' : 'bg-red-500'}`} />
                    {isRegistered ? 'Registriert' : registration.status || 'Nicht registriert'}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Auth-Modus</div>
                <div className="font-medium mt-1">
                  {trunk.auth_mode === 'registration' ? 'Registrierung' : 'IP-Authentifizierung'}
                </div>
              </div>
              {registration.expires && (
                <div>
                  <div className="text-sm text-gray-500">Nächste Registrierung</div>
                  <div className="font-medium mt-1 flex items-center gap-1">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {registration.expires}
                  </div>
                </div>
              )}
            </div>

            {registration.last_response && (
              <div>
                <div className="text-sm text-gray-500 mb-1">Letzte SIP-Nachricht</div>
                <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-x-auto font-mono">
                  {registration.last_response}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Verbindung */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b flex items-center gap-2">
            <Wifi className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Verbindung</h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-500">Server</div>
                <div className="font-medium mt-1 font-mono text-sm">{trunk.sip_server}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Endpoint-Status</div>
                <div className="font-medium mt-1">
                  {endpoint.state === 'Not in use' ? 'Online (Idle)' : endpoint.state}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">RTT / Latenz</div>
                <div className="font-medium mt-1">
                  {endpoint.rtt != null && endpoint.rtt > 0
                    ? `${endpoint.rtt} ms`
                    : 'N/A'
                  }
                </div>
              </div>
              {endpoint.contact_uri && (
                <div className="md:col-span-3">
                  <div className="text-sm text-gray-500">Contact URI</div>
                  <div className="font-mono text-sm mt-1 text-gray-700 break-all">{endpoint.contact_uri}</div>
                </div>
              )}
              {trunk.username && (
                <div>
                  <div className="text-sm text-gray-500">Benutzername</div>
                  <div className="font-medium mt-1 font-mono text-sm">{trunk.username}</div>
                </div>
              )}
              {trunk.codecs && (
                <div>
                  <div className="text-sm text-gray-500">Codecs</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {trunk.codecs.split(',').map((c: string) => (
                      <span key={c} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{c.trim()}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rufnummern */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b flex items-center gap-2">
            <Phone className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Zugeordnete Rufnummern</h2>
            {routes.length > 0 && (
              <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">{routes.length}</span>
            )}
          </div>
          <div className="divide-y">
            {routes.length > 0 ? (
              routes.map((route: any) => (
                <div key={route.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-green-500" />
                    <div>
                      <span className="font-medium font-mono">{route.did}</span>
                      {route.description && (
                        <span className="text-sm text-gray-400 ml-2">{route.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    Ziel: <span className="font-medium">{route.destination_extension}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-6 text-center text-gray-500">
                Keine Rufnummern zugeordnet
              </div>
            )}
          </div>
          {trunk.number_block && (
            <div className="px-6 py-3 border-t bg-gray-50 text-sm text-gray-600">
              Nummernblock: <span className="font-mono font-medium">{trunk.number_block}</span>
            </div>
          )}
        </div>

        {/* Statistik */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Statistik</h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{stats.calls_today}</div>
                <div className="text-sm text-gray-500">Anrufe heute</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{stats.calls_week}</div>
                <div className="text-sm text-gray-500">Diese Woche</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <ArrowDownLeft className="w-4 h-4 text-green-600" />
                  <span className="text-2xl font-bold text-green-700">{stats.inbound_today}</span>
                </div>
                <div className="text-sm text-green-600">Eingehend heute</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <ArrowUpRight className="w-4 h-4 text-blue-600" />
                  <span className="text-2xl font-bold text-blue-700">{stats.outbound_today}</span>
                </div>
                <div className="text-sm text-blue-600">Ausgehend heute</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
