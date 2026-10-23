import { useState, useEffect } from 'react'
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Search, Filter, RefreshCw, Ban, Trash2 } from 'lucide-react'
import { api } from '../services/api'
import { useI18n } from '../context/I18nContext'

interface CDRRecord {
  id: number
  call_date: string
  clid: string | null
  src: string | null
  dst: string | null
  duration: number | null
  billsec: number | null
  disposition: string | null
}

interface CDRStats {
  total_calls: number
  answered_calls: number
  missed_calls: number
  busy_calls: number
  total_duration: number
  avg_duration: number
  calls_today: number
  calls_this_week: number
}

interface BlockedCaller {
  id: number
  number: string
  destination: string
  description: string | null
  enabled: boolean
}

export default function CDRPage() {
  const [records, setRecords] = useState<CDRRecord[]>([])
  const [blocked, setBlocked] = useState<BlockedCaller[]>([])
  const [blockDestination, setBlockDestination] = useState('')
  const [blockBusy, setBlockBusy] = useState<string | null>(null)
  const [blockError, setBlockError] = useState<string | null>(null)
  const [showBlocklist, setShowBlocklist] = useState(false)
  const [blockAnonymous, setBlockAnonymous] = useState(false)
  const [anonBusy, setAnonBusy] = useState(false)
  const [stats, setStats] = useState<CDRStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterSrc, setFilterSrc] = useState('')
  const [filterDst, setFilterDst] = useState('')
  const [filterDisposition, setFilterDisposition] = useState('')
  const { tr, lang } = useI18n()

  const fetchCDR = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('limit', '100')
      if (filterSrc) params.append('src', filterSrc)
      if (filterDst) params.append('dst', filterDst)
      if (filterDisposition) params.append('disposition', filterDisposition)

      const [recordsData, statsData] = await Promise.all([
        api.getCdr(params.toString()),
        api.getCdrStats()
      ])

      setRecords(recordsData)
      setStats(statsData)
    } catch (error) {
      console.error(tr('CDR konnte nicht geladen werden:', 'Failed to fetch CDR:'), error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBlocklist = async () => {
    try {
      const [list, dest, anon] = await Promise.all([
        api.getBlocklist(),
        api.getBlocklistDestination(),
        api.getBlockAnonymous(),
      ])
      setBlocked(list)
      setBlockDestination(dest.destination)
      setBlockAnonymous(anon.block_anonymous)
      // Gibt es Sperren, den Bereich aufklappen - sonst findet niemand den Weg zurueck.
      if (list.length > 0 || anon.block_anonymous) setShowBlocklist(true)
    } catch (error) {
      console.error('Failed to fetch blocklist:', error)
    }
  }

  // Nummern koennen im CDR mit Leerzeichen oder Bindestrichen stehen, in der
  // Sperrliste stehen sie nur mit Ziffern - vor dem Vergleich angleichen.
  const normalize = (n: string | null) =>
    (n || '').split('').filter(c => /[0-9+]/.test(c)).join('')

  const isBlocked = (number: string | null) => {
    const n = normalize(number)
    return n !== '' && blocked.some(b => b.number === n)
  }

  const handleBlock = async (record: CDRRecord) => {
    const number = normalize(record.src)
    if (!number) return
    if (!confirm(
      `Anrufe von ${record.src} kuenftig nach ${blockDestination} umleiten?\n\n` +
      `Der Anrufer erreicht dich damit nicht mehr.`
    )) return
    setBlockBusy(number)
    setBlockError(null)
    try {
      await api.blockCaller({ number, description: `Gesperrt aus der Anrufliste am ${new Date().toLocaleDateString('de-DE')}` })
      await fetchBlocklist()
    } catch (e: any) {
      setBlockError(e?.message || 'Nummer konnte nicht gesperrt werden.')
    } finally {
      setBlockBusy(null)
    }
  }

  const handleToggleAnonymous = async (enabled: boolean) => {
    setAnonBusy(true)
    setBlockError(null)
    const previous = blockAnonymous
    setBlockAnonymous(enabled)
    try {
      await api.setBlockAnonymous(enabled)
    } catch (e: any) {
      setBlockAnonymous(previous)
      setBlockError(e?.message || 'Einstellung konnte nicht gespeichert werden.')
    } finally {
      setAnonBusy(false)
    }
  }

  const handleUnblock = async (entry: BlockedCaller) => {
    setBlockBusy(entry.number)
    setBlockError(null)
    try {
      await api.unblockCaller(entry.id)
      await fetchBlocklist()
    } catch (e: any) {
      setBlockError(e?.message || 'Sperre konnte nicht aufgehoben werden.')
    } finally {
      setBlockBusy(null)
    }
  }

  useEffect(() => {
    fetchCDR()
    fetchBlocklist()
  }, [])

  const handleFilter = () => {
    fetchCDR()
  }

  const clearFilters = () => {
    setFilterSrc('')
    setFilterDst('')
    setFilterDisposition('')
    setTimeout(fetchCDR, 100)
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString(lang === 'en' ? 'en-US' : 'de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }


  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface rounded-input shadow p-4">
            <div className="flex items-center gap-2 text-muted mb-1">
              <Phone className="w-4 h-4" />
              <span className="text-sm">{tr('Gesamt', 'Total')}</span>
            </div>
            <p className="text-2xl font-bold text-content">{stats.total_calls}</p>
          </div>
          
          <div className="bg-surface rounded-input shadow p-4">
            <div className="flex items-center gap-2 text-success mb-1">
              <Phone className="w-4 h-4" />
              <span className="text-sm">{tr('Angenommen', 'Answered')}</span>
            </div>
            <p className="text-2xl font-bold text-success">{stats.answered_calls}</p>
          </div>
          
          <div className="bg-surface rounded-input shadow p-4">
            <div className="flex items-center gap-2 text-warning mb-1">
              <PhoneMissed className="w-4 h-4" />
              <span className="text-sm">{tr('Verpasst', 'Missed')}</span>
            </div>
            <p className="text-2xl font-bold text-warning">{stats.missed_calls}</p>
          </div>
          
          <div className="bg-surface rounded-input shadow p-4">
            <div className="flex items-center gap-2 text-link mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">{tr('Ø Dauer', 'Avg duration')}</span>
            </div>
            <p className="text-2xl font-bold text-link">{formatDuration(Math.round(stats.avg_duration))}</p>
          </div>
        </div>
      )}

      {/* Sperrliste */}
      <div className="bg-surface rounded-input shadow p-4">
        <button
          onClick={() => setShowBlocklist(v => !v)}
          className="flex items-center gap-2 w-full text-left"
        >
          <Ban className="w-6 h-6 text-muted" />
          <h2 className="font-semibold text-content">
            Gesperrte Anrufer{blocked.length > 0 ? ` (${blocked.length})` : ''}
          </h2>
          <span className="ml-auto text-sm text-muted">
            {showBlocklist ? 'einklappen' : 'anzeigen'}
          </span>
        </button>

        {showBlocklist && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-sm text-muted mb-1">
                  Gesperrte Anrufer umleiten nach
                </label>
                <input
                  type="text"
                  value={blockDestination}
                  onChange={(e) => setBlockDestination(e.target.value)}
                  onBlur={() => api.setBlocklistDestination(blockDestination)
                    .then(fetchBlocklist)
                    .catch((e: any) => setBlockError(e?.message || 'Ziel konnte nicht gespeichert werden.'))}
                  className="px-3 py-2 bg-surface text-content border border-subtle rounded-input focus:ring-2 focus:ring-link focus:border-link"
                />
              </div>
              <p className="text-sm text-muted max-w-md">
                Gilt für neu gesperrte Nummern. Bereits gesperrte behalten ihr Ziel.
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer border-t border-subtle pt-4">
              <input
                type="checkbox"
                checked={blockAnonymous}
                disabled={anonBusy}
                onChange={e => handleToggleAnonymous(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-subtle text-brand focus:ring-link disabled:opacity-50"
              />
              <span className="text-sm">
                <span className="font-medium text-content">
                  Anrufer mit unterdrückter Rufnummer sperren
                </span>
                <span className="block text-muted mt-0.5">
                  Betrifft Anrufe ganz ohne Rufnummer und solche, die als „nicht anzeigen“
                  gekennzeichnet sind. Sie werden auf dasselbe Ziel umgeleitet.
                  Achtung: manche Behörden und Arztpraxen rufen grundsätzlich anonym an.
                </span>
                {anonBusy && (
                  <span className="block text-muted mt-1">Dialplan wird neu geschrieben…</span>
                )}
              </span>
            </label>

            {blockError && (
              <p className="text-sm text-danger">{blockError}</p>
            )}

            {blocked.length === 0 ? (
              <p className="text-sm text-muted">
                Niemand gesperrt. In der Anrufliste unten steht bei jedem Anruf ein Knopf „Sperren“.
              </p>
            ) : (
              <ul className="divide-y divide-subtle">
                {blocked.map(b => (
                  <li key={b.id} className="py-2 flex items-center gap-3">
                    <span className="font-medium text-content">{b.number}</span>
                    <span className="text-sm text-muted">→ {b.destination}</span>
                    {b.description && (
                      <span className="text-sm text-muted truncate">{b.description}</span>
                    )}
                    <button
                      onClick={() => handleUnblock(b)}
                      disabled={blockBusy === b.number}
                      className="ml-auto inline-flex items-center gap-1 text-xs text-content hover:text-danger border border-subtle rounded px-2 py-1 transition disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Sperre aufheben
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-surface rounded-input shadow p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-6 h-6 text-muted" />
          <h2 className="font-semibold text-content">{tr('Filter', 'Filter')}</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1">{tr('Von (Quelle)', 'From (source)')}</label>
            <input
              type="text"
              value={filterSrc}
              onChange={(e) => setFilterSrc(e.target.value)}
              placeholder={tr('z.B. 1000', 'e.g. 1000')}
              className="w-full px-3 py-2 bg-surface text-content border border-subtle rounded-input focus:ring-2 focus:ring-link focus:border-link"
            />
          </div>
          
          <div>
            <label className="block text-sm text-muted mb-1">{tr('Nach (Ziel)', 'To (destination)')}</label>
            <input
              type="text"
              value={filterDst}
              onChange={(e) => setFilterDst(e.target.value)}
              placeholder={tr('z.B. 1001', 'e.g. 1001')}
              className="w-full px-3 py-2 bg-surface text-content border border-subtle rounded-input focus:ring-2 focus:ring-link focus:border-link"
            />
          </div>
          
          
          <div className="flex items-end gap-2">
            <button
              onClick={handleFilter}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-on-primary rounded-input hover:bg-brand-hover"
            >
              <Search className="w-4 h-4" />
              {tr('Suchen', 'Search')}
            </button>
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-2 bg-surface-subtle text-content rounded-input hover:bg-surface-hover"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CDR Table */}
      <div className="bg-surface rounded-input shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-subtle">
          <h2 className="font-semibold text-content">{tr('Anrufverlauf', 'Call history')}</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-muted">{tr('Laden...', 'Loading...')}</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-muted">{tr('Keine Anrufe gefunden', 'No calls found')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-subtle">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">{tr('Zeit', 'Time')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">{tr('Von', 'From')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">{tr('Nach', 'To')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">{tr('Dauer', 'Duration')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase">{tr('Gesprächszeit', 'Billable time')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-surface-hover">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-content">
                      {record.call_date ? formatDate(record.call_date) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <PhoneOutgoing className="w-4 h-4 text-muted" />
                        <span className="text-sm font-medium text-content">{record.src || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <PhoneIncoming className="w-4 h-4 text-muted" />
                        <span className="text-sm font-medium text-content">{record.dst || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {formatDuration(record.duration)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {formatDuration(record.billsec)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {isBlocked(record.src) ? (
                        <button
                          onClick={() => {
                            const entry = blocked.find(b => b.number === normalize(record.src))
                            if (entry) handleUnblock(entry)
                          }}
                          disabled={blockBusy === normalize(record.src)}
                          title={`Sperre für ${record.src} aufheben`}
                          className="inline-flex items-center gap-1 text-xs text-danger hover:text-content border border-red-500 border-red-500 rounded px-2 py-1 transition disabled:opacity-50"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          {blockBusy === normalize(record.src) ? 'Moment…' : 'Entsperren'}
                        </button>
                      ) : normalize(record.src) ? (
                        <button
                          onClick={() => handleBlock(record)}
                          disabled={blockBusy === normalize(record.src)}
                          title={`Anrufe von ${record.src} nach ${blockDestination} umleiten`}
                          className="inline-flex items-center gap-1 text-xs text-content hover:text-danger border border-subtle rounded px-2 py-1 transition disabled:opacity-50"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          {blockBusy === normalize(record.src) ? 'Sperre…' : 'Sperren'}
                        </button>
                      ) : null}
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
