import { useState, useEffect, useRef } from 'react'
import { ToggleLeft, ToggleRight, RefreshCw, ChevronDown, ChevronRight, ArrowRight, ArrowLeft } from 'lucide-react'
import { api } from '../services/api'
import { useI18n } from '../context/I18nContext'

interface SIPCall {
  call_id: string
  first_seen: string
  from: string
  to: string
  method: string
  message_count: number
}

interface SIPMessageData {
  timestamp: string
  direction: string
  method: string
  status_code: number
  from: string
  to: string
  cseq: string
  raw_text: string
}

export default function SIPDebugPage() {
  const { tr, lang } = useI18n()
  const [enabled, setEnabled] = useState(false)
  const [messageCount, setMessageCount] = useState(0)
  const [callCount, setCallCount] = useState(0)
  const [calls, setCalls] = useState<SIPCall[]>([])
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SIPMessageData[]>([])
  const [expandedMsg, setExpandedMsg] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = async () => {
    try {
      const data = await api.getSipDebugStatus()
      setEnabled(data.enabled)
      setMessageCount(data.message_count)
      setCallCount(data.call_count)
    } catch (e) {
      console.error(tr('SIP-Debug-Status konnte nicht geladen werden', 'Failed to fetch SIP debug status'), e)
    }
  }

  const fetchCalls = async () => {
    try {
      const data = await api.getSipDebugCalls()
      setCalls(data)
    } catch (e) {
      console.error(tr('SIP-Debug-Anrufe konnten nicht geladen werden', 'Failed to fetch SIP debug calls'), e)
    }
  }

  const fetchMessages = async (callId: string) => {
    try {
      const data = await api.getSipDebugMessages(callId)
      setMessages(data)
    } catch (e) {
      console.error(tr('SIP-Debug-Nachrichten konnten nicht geladen werden', 'Failed to fetch SIP debug messages'), e)
    }
  }

  const toggleCapture = async () => {
    setToggling(true)
    try {
      if (enabled) {
        await api.disableSipDebug()
      } else {
        await api.enableSipDebug()
      }
      await fetchStatus()
    } catch (e) {
      console.error(tr('SIP-Debug konnte nicht umgeschaltet werden', 'Failed to toggle SIP debug'), e)
    } finally {
      setToggling(false)
    }
  }

  const refresh = async () => {
    setLoading(true)
    await fetchStatus()
    await fetchCalls()
    if (selectedCallId) {
      await fetchMessages(selectedCallId)
    }
    setLoading(false)
  }

  const selectCall = async (callId: string) => {
    if (selectedCallId === callId) {
      setSelectedCallId(null)
      setMessages([])
      setExpandedMsg(null)
      return
    }
    setSelectedCallId(callId)
    setExpandedMsg(null)
    await fetchMessages(callId)
  }

  // Initial load
  useEffect(() => {
    fetchStatus()
    fetchCalls()
  }, [])

  // Auto-refresh when enabled
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (enabled) {
      intervalRef.current = setInterval(() => {
        fetchStatus()
        fetchCalls()
        if (selectedCallId) {
          fetchMessages(selectedCallId)
        }
      }, 10000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [enabled, selectedCallId])

  const shortCallId = (cid: string) => {
    if (cid.length > 24) return cid.substring(0, 24) + '...'
    return cid
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso + 'Z')
    return d.toLocaleTimeString(lang === 'en' ? 'en-US' : 'de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatDateTime = (iso: string) => {
    const d = new Date(iso + 'Z')
    return d.toLocaleString(lang === 'en' ? 'en-US' : 'de-DE', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  }

  // Extract display name or user part from SIP URI
  const extractParty = (header: string) => {
    if (!header) return ''
    const nameMatch = header.match(/^"?([^"<]+)"?\s*</)
    if (nameMatch) return nameMatch[1].trim()
    const uriMatch = header.match(/<sip:([^@>]+)/)
    if (uriMatch) return uriMatch[1]
    const bareMatch = header.match(/sip:([^@>]+)/)
    if (bareMatch) return bareMatch[1]
    return header.substring(0, 30)
  }

  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <div className="bg-surface rounded-card shadow-sm p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-content">SIP Debug</h1>
            <button
              onClick={toggleCapture}
              disabled={toggling}
              className="flex items-center gap-2 transition-colors"
              title={enabled ? tr('Capture deaktivieren', 'Disable capture') : tr('Capture aktivieren', 'Enable capture')}
            >
              {enabled ? (
                <ToggleRight className="w-8 h-8 text-success" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-muted" />
              )}
              <span className={`text-sm font-medium ${enabled ? 'text-success' : 'text-muted'}`}>
                {toggling ? '...' : enabled ? tr('Aktiv', 'Active') : tr('Inaktiv', 'Inactive')}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-muted">
              <span className="font-medium text-content">{messageCount}</span> {tr('Nachrichten', 'messages')}
              {' / '}
              <span className="font-medium text-content">{callCount}</span> {tr('Calls', 'calls')}
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              className="p-2 rounded-input text-muted hover:bg-surface-hover transition-colors"
              title={tr('Aktualisieren', 'Refresh')}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        {enabled && (
          <p className="text-xs text-muted mt-2">
            {tr('Auto-Refresh alle 10 Sekunden. Nachrichten werden max. 2 Stunden gespeichert.', 'Auto-refresh every 10 seconds. Messages are kept for up to 2 hours.')}
          </p>
        )}
      </div>

      {/* Call List */}
      {calls.length === 0 ? (
        <div className="bg-surface rounded-card shadow-sm p-8 text-center text-muted">
          {enabled
            ? tr('Noch keine SIP-Nachrichten erfasst. Starten Sie einen Anruf.', 'No SIP messages captured yet. Start a call.')
            : tr('Capture ist deaktiviert. Aktivieren Sie den Toggle oben.', 'Capture is disabled. Enable the toggle above.')}
        </div>
      ) : (
        <div className="bg-surface rounded-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-subtle/50 text-left">
                  <th className="px-4 py-3 font-medium text-content w-8"></th>
                  <th className="px-4 py-3 font-medium text-content">{tr('Zeit', 'Time')}</th>
                  <th className="px-4 py-3 font-medium text-content">{tr('Call-ID', 'Call ID')}</th>
                  <th className="px-4 py-3 font-medium text-content">{tr('Von', 'From')}</th>
                  <th className="px-4 py-3 font-medium text-content">{tr('Nach', 'To')}</th>
                  <th className="px-4 py-3 font-medium text-content">{tr('Methode', 'Method')}</th>
                  <th className="px-4 py-3 font-medium text-content text-right">Msgs</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.call_id}>
                    <td colSpan={7} className="p-0">
                      <div>
                        <button
                          onClick={() => selectCall(call.call_id)}
                          className={`w-full flex items-center text-left px-4 py-3 transition-colors border-b border-subtle ${
                            selectedCallId === call.call_id
                              ? 'bg-surface-accent bg-surface-accent'
                              : 'hover:bg-surface-hover/30'
                          }`}
                        >
                          <div className="w-8 flex-shrink-0">
                            {selectedCallId === call.call_id ? (
                              <ChevronDown className="w-4 h-4 text-link" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted" />
                            )}
                          </div>
                          <div className="flex-1 grid grid-cols-6 gap-4 items-center">
                            <div className="text-muted">{formatDateTime(call.first_seen)}</div>
                            <div className="font-mono text-xs text-content" title={call.call_id}>
                              {shortCallId(call.call_id)}
                            </div>
                            <div className="text-content">{extractParty(call.from)}</div>
                            <div className="text-content">{extractParty(call.to)}</div>
                            <div>
                              <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-surface-accent text-link bg-surface-accent">
                                {call.method || '?'}
                              </span>
                            </div>
                            <div className="text-right text-muted">{call.message_count}</div>
                          </div>
                        </button>

                        {/* Expanded SIP Messages */}
                        {selectedCallId === call.call_id && messages.length > 0 && (
                          <div className="bg-surface-subtle bg-surface-subtle/50 border-b border-subtle px-6 py-4 space-y-2">
                            {messages.map((msg, idx) => (
                              <div key={idx} className="border border-subtle rounded-input overflow-hidden">
                                <button
                                  onClick={() => setExpandedMsg(expandedMsg === idx ? null : idx)}
                                  className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-surface-hover transition-colors"
                                >
                                  {msg.direction === 'sent' ? (
                                    <ArrowRight className="w-4 h-4 text-link flex-shrink-0" />
                                  ) : (
                                    <ArrowLeft className="w-4 h-4 text-success flex-shrink-0" />
                                  )}
                                  <span className="text-xs text-muted w-20 flex-shrink-0">
                                    {formatTime(msg.timestamp)}
                                  </span>
                                  <span className={`text-sm font-medium ${
                                    msg.method
                                      ? 'text-link'
                                      : msg.status_code >= 200 && msg.status_code < 300
                                        ? 'text-success'
                                        : msg.status_code >= 400
                                          ? 'text-danger'
                                          : 'text-warning'
                                  }`}>
                                    {msg.method || `${msg.status_code}`}
                                  </span>
                                  <span className="text-xs text-muted ml-2">{msg.cseq}</span>
                                  <div className="flex-1" />
                                  {expandedMsg === idx ? (
                                    <ChevronDown className="w-4 h-4 text-muted" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-muted" />
                                  )}
                                </button>
                                {expandedMsg === idx && (
                                  <div className="border-t border-subtle bg-surface p-4 overflow-x-auto">
                                    <pre className="text-xs font-mono text-content whitespace-pre-wrap break-all">
                                      {msg.raw_text}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
