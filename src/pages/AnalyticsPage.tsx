import { useMemo, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import {
  ChartNoAxesColumn,
  FileKey,
  FileLock2,
  FolderLock,
  FolderOpen,
  KeyRound,
  Trash2,
} from 'lucide-react'
import { useKeyVault } from '../context/keyVault'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Dialog } from '../components/Dialog'
import { EmptyState } from '../components/EmptyState'
import { StatusMessage } from '../components/StatusMessage'
import {
  clearAnalytics,
  getAnalyticsEvents,
  subscribeToAnalytics,
  type AnalyticsEvent,
  type AnalyticsEventType,
} from '../lib/analytics'
import { formatBytes } from '../lib/files'

const EVENT_LABELS: Record<AnalyticsEventType, string> = {
  encrypt: 'File encrypted',
  'batch-encrypt': 'Bundle encrypted',
  decrypt: 'File decrypted',
  'bundle-decrypt': 'Bundle decrypted',
  'key-create': 'Key pair created',
  'key-import': 'Key imported',
  'key-delete': 'Key deleted',
}

const EVENT_ICONS = {
  encrypt: FileLock2,
  'batch-encrypt': FolderLock,
  decrypt: FileKey,
  'bundle-decrypt': FolderOpen,
  'key-create': KeyRound,
  'key-import': KeyRound,
  'key-delete': Trash2,
} as const

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function relativeTime(iso: string): string {
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return 'Unknown time'
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} d ago`
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function eventDetail(event: AnalyticsEvent): string {
  const parts: string[] = []
  if (event.files !== undefined && event.files > 1) {
    const unit = event.type === 'key-delete' ? 'keys' : 'files'
    parts.push(`${event.files} ${unit}`)
  }
  if (event.bytes !== undefined && event.bytes > 0) {
    parts.push(formatBytes(event.bytes))
  }
  return parts.join(' · ')
}

interface DayBucket {
  key: string
  label: string
  tick: string
  encrypt: number
  decrypt: number
}

function buildDailyBuckets(events: AnalyticsEvent[], days = 14): DayBucket[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const buckets: DayBucket[] = []
  const byDay = new Map<string, DayBucket>()
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - offset)
    const bucket: DayBucket = {
      key: dayKey(date),
      label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      tick: String(date.getDate()),
      encrypt: 0,
      decrypt: 0,
    }
    buckets.push(bucket)
    byDay.set(bucket.key, bucket)
  }

  for (const event of events) {
    const date = new Date(event.at)
    if (Number.isNaN(date.getTime())) continue
    const bucket = byDay.get(dayKey(date))
    if (!bucket) continue
    if (event.type === 'encrypt' || event.type === 'batch-encrypt') bucket.encrypt += 1
    if (event.type === 'decrypt' || event.type === 'bundle-decrypt') bucket.decrypt += 1
  }

  return buckets
}

function eventLabel(event: AnalyticsEvent): string {
  if (event.type === 'key-delete' && event.files !== undefined && event.files > 1) {
    return 'Keys deleted'
  }
  return EVENT_LABELS[event.type]
}

export function AnalyticsPage() {
  const events = useSyncExternalStore(subscribeToAnalytics, getAnalyticsEvents)
  const { keys } = useKeyVault()
  const [clearOpen, setClearOpen] = useState(false)

  const stats = useMemo(() => {
    let encryptedFiles = 0
    let decryptedFiles = 0
    let bytesEncrypted = 0
    let bytesDecrypted = 0
    let bundlesCreated = 0
    let bundlesOpened = 0

    for (const event of events) {
      switch (event.type) {
        case 'encrypt':
          encryptedFiles += 1
          bytesEncrypted += event.bytes ?? 0
          break
        case 'batch-encrypt':
          encryptedFiles += event.files ?? 1
          bytesEncrypted += event.bytes ?? 0
          bundlesCreated += 1
          break
        case 'decrypt':
          decryptedFiles += 1
          bytesDecrypted += event.bytes ?? 0
          break
        case 'bundle-decrypt':
          decryptedFiles += event.files ?? 1
          bytesDecrypted += event.bytes ?? 0
          bundlesOpened += 1
          break
        default:
          break
      }
    }

    return {
      encryptedFiles,
      decryptedFiles,
      bytesEncrypted,
      bytesDecrypted,
      bundlesCreated,
      bundlesOpened,
    }
  }, [events])

  const daily = useMemo(() => buildDailyBuckets(events), [events])
  const maxDaily = Math.max(
    1,
    ...daily.map((bucket) => Math.max(bucket.encrypt, bucket.decrypt)),
  )
  const recent = events.slice(0, 10)
  const hasEvents = events.length > 0

  const summary = [
    {
      label: 'Files encrypted',
      value: stats.encryptedFiles,
      detail: formatBytes(stats.bytesEncrypted),
    },
    {
      label: 'Files decrypted',
      value: stats.decryptedFiles,
      detail: formatBytes(stats.bytesDecrypted),
    },
    {
      label: 'Bundles created',
      value: stats.bundlesCreated,
      detail: `${stats.bundlesOpened} ${stats.bundlesOpened === 1 ? 'bundle opened' : 'bundles opened'}`,
    },
    {
      label: 'Tracked operations',
      value: events.length,
      detail: `${keys.length} ${keys.length === 1 ? 'key' : 'keys'} in vault`,
    },
  ]

  return (
    <div className="sb-container sb-workflow">
      <header className="sb-workflow__header">
        <h1 className="sb-page-title">Analytics</h1>
        <p className="sb-muted" style={{ marginTop: 'var(--space-2)' }}>
          Local usage insights for this browser. SealBox never sends analytics anywhere, and file
          names, key names, and file contents are never recorded.
        </p>
      </header>

      {hasEvents ? (
        <>
          <section className="sb-stat-grid" aria-label="Usage summary">
            {summary.map((item) => (
              <div className="sb-stat" role="group" aria-label={item.label} key={item.label}>
                <p className="sb-stat__label">{item.label}</p>
                <p className="sb-stat__value">{item.value}</p>
                <p className="sb-stat__detail">{item.detail}</p>
              </div>
            ))}
          </section>

          <div className="sb-stack" style={{ marginTop: 'var(--space-6)' }}>
            <Card>
              <h2 className="sb-section-title">Last 14 days</h2>
              <p className="sb-muted sb-text-sm" style={{ marginTop: 'var(--space-1)' }}>
                Encrypt and decrypt operations per day.
              </p>

              <figure className="sb-chart">
                <figcaption className="sb-chart__legend">
                  <span>
                    <span
                      className="sb-chart__swatch sb-chart__swatch--encrypt"
                      aria-hidden="true"
                    />
                    Encrypted
                  </span>
                  <span>
                    <span
                      className="sb-chart__swatch sb-chart__swatch--decrypt"
                      aria-hidden="true"
                    />
                    Decrypted
                  </span>
                </figcaption>
                <div
                  className="sb-chart__plot"
                  role="group"
                  aria-label="Encryption and decryption operations over the last 14 days"
                >
                  {daily.map((bucket) => (
                    <div
                      className="sb-chart__day"
                      key={bucket.key}
                      role="img"
                      aria-label={`${bucket.label}: ${bucket.encrypt} encrypted, ${bucket.decrypt} decrypted`}
                    >
                      <div className="sb-chart__bars" aria-hidden="true">
                        <span
                          className="sb-chart__bar sb-chart__bar--encrypt"
                          style={{
                            height:
                              bucket.encrypt === 0
                                ? '0%'
                                : `${Math.max(8, (bucket.encrypt / maxDaily) * 100)}%`,
                          }}
                        />
                        <span
                          className="sb-chart__bar sb-chart__bar--decrypt"
                          style={{
                            height:
                              bucket.decrypt === 0
                                ? '0%'
                                : `${Math.max(8, (bucket.decrypt / maxDaily) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="sb-chart__tick" aria-hidden="true">
                        {bucket.tick}
                      </span>
                    </div>
                  ))}
                </div>
              </figure>
            </Card>

            <Card>
              <div className="sb-vault__toolbar">
                <div>
                  <h2 className="sb-section-title">Recent activity</h2>
                  <p className="sb-muted sb-text-sm" style={{ marginTop: 'var(--space-1)' }}>
                    The latest {recent.length} tracked operations.
                  </p>
                </div>
                <Button
                  variant="tertiary"
                  size="sm"
                  icon={<Trash2 size={16} aria-hidden="true" />}
                  onClick={() => setClearOpen(true)}
                >
                  Clear analytics
                </Button>
              </div>

              <ul className="sb-batch-list" role="list">
                {recent.map((event) => {
                  const Icon = EVENT_ICONS[event.type]
                  const detail = eventDetail(event)
                  return (
                    <li className="sb-batch-item" key={event.id}>
                      <span className="sb-batch-item__icon" aria-hidden="true">
                        <Icon size={16} strokeWidth={1.9} />
                      </span>
                      <div className="sb-batch-item__meta">
                        <p className="sb-batch-item__name">{eventLabel(event)}</p>
                        <p className="sb-batch-item__sub">
                          {[detail, relativeTime(event.at)].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <p className="sb-analytics-note">
                Stored locally in this browser. Clearing analytics does not affect your keys or
                encrypted files.
              </p>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <EmptyState
            icon={<ChartNoAxesColumn size={24} strokeWidth={1.75} />}
            title="No activity yet"
            action={
              <Link to="/encrypt" className="sb-btn sb-btn--primary">
                Encrypt a file
              </Link>
            }
          >
            Encrypt or decrypt a file to start building local usage analytics.
          </EmptyState>
        </Card>
      )}

      <Dialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Clear analytics"
        footer={
          <>
            <Button variant="secondary" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                clearAnalytics()
                setClearOpen(false)
              }}
              icon={<Trash2 size={16} aria-hidden="true" />}
            >
              Delete analytics
            </Button>
          </>
        }
      >
        <StatusMessage variant="warning" title="This cannot be undone" live="off">
          This removes all locally stored analytics from this browser. Your keys and encrypted
          files are not affected.
        </StatusMessage>
      </Dialog>
    </div>
  )
}
