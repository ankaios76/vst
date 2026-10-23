import { Phone, PhoneOff, Clock } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useI18n } from '../context/I18nContext'

interface Call {
  channel: string
  caller: string
  destination: string
  state: string
  start_time: string
}

interface ActiveCallsProps {
  calls: Call[]
}

export default function ActiveCalls({ calls }: ActiveCallsProps) {
  const { tr } = useI18n()
  if (calls.length === 0) {
    return (
      <div className="bg-surface rounded-input shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Phone className="w-5 h-5 text-muted" />
          <h2 className="text-lg font-semibold text-content">{tr('Aktive Anrufe', 'Active Calls')}</h2>
        </div>
        <p className="text-muted text-center py-8">{tr('Keine aktiven Anrufe', 'No active calls')}</p>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-input shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5 text-success" />
          <h2 className="text-lg font-semibold text-content">{tr('Aktive Anrufe', 'Active Calls')}</h2>
        </div>
        <span className="bg-surface-subtle text-success px-3 py-1 rounded-full text-sm font-medium">
          {calls.length} {tr('aktiv', 'active')}
        </span>
      </div>

      <div className="space-y-3">
        {calls.map((call, index) => (
          <CallItem key={call.channel || index} call={call} />
        ))}
      </div>
    </div>
  )
}

function CallItem({ call }: { call: Call }) {
  const { tr } = useI18n()
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setDuration(d => d + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStateColor = (state: string) => {
    switch (state) {
      case 'connected':
        return 'text-success bg-surface-subtle bg-surface-subtle'
      case 'ringing':
        return 'text-warning bg-surface-subtle text-warning bg-surface-subtle'
      default:
        return 'text-muted bg-surface-subtle bg-surface-subtle'
    }
  }

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'connected':
        return <Phone className="w-4 h-4" />
      case 'ringing':
        return <PhoneOff className="w-4 h-4 animate-pulse" />
      default:
        return <Phone className="w-4 h-4" />
    }
  }

  const getStateLabel = (state: string) => {
    switch (state) {
      case 'connected':
        return tr('Verbunden', 'Connected')
      case 'ringing':
        return tr('Klingelt', 'Ringing')
      default:
        return state
    }
  }

  return (
    <div className="flex items-center justify-between p-4 bg-surface-subtle rounded-input border border-subtle">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-input ${getStateColor(call.state)}`}>
          {getStateIcon(call.state)}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-content">{call.caller || tr('Unbekannt', 'Unknown')}</span>
            <span className="text-muted">&rarr;</span>
            <span className="font-medium text-content">{call.destination || tr('Unbekannt', 'Unknown')}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded ${getStateColor(call.state)}`}>
              {getStateLabel(call.state)}
            </span>
            {call.state === 'connected' && (
              <div className="flex items-center gap-1 text-xs text-muted">
                <Clock className="w-3 h-3" />
                {formatDuration(duration)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
