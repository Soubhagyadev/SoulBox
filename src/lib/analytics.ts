export type AnalyticsEventType =
  | 'encrypt'
  | 'batch-encrypt'
  | 'decrypt'
  | 'bundle-decrypt'
  | 'key-create'
  | 'key-import'
  | 'key-delete'

export interface AnalyticsEvent {
  id: string
  type: AnalyticsEventType
  at: string
  bytes?: number
  files?: number
}

export const ANALYTICS_STORAGE_KEY = 'sealbox.analytics.v1'
export const MAX_ANALYTICS_EVENTS = 1000

const EVENT_TYPES: readonly AnalyticsEventType[] = [
  'encrypt',
  'batch-encrypt',
  'decrypt',
  'bundle-decrypt',
  'key-create',
  'key-import',
  'key-delete',
]

interface AnalyticsStore {
  version: 1
  events: AnalyticsEvent[]
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function isEventType(value: unknown): value is AnalyticsEventType {
  return typeof value === 'string' && EVENT_TYPES.includes(value as AnalyticsEventType)
}

function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    isEventType(candidate.type) &&
    typeof candidate.at === 'string' &&
    !Number.isNaN(Date.parse(candidate.at)) &&
    (candidate.bytes === undefined ||
      (typeof candidate.bytes === 'number' && Number.isFinite(candidate.bytes) && candidate.bytes >= 0)) &&
    (candidate.files === undefined ||
      (typeof candidate.files === 'number' && Number.isFinite(candidate.files) && candidate.files >= 0))
  )
}

function readEvents(): AnalyticsEvent[] {
  const raw = storage()?.getItem(ANALYTICS_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return []
    const events = (parsed as Record<string, unknown>).events
    if (!Array.isArray(events)) return []
    return events.filter(isAnalyticsEvent).slice(0, MAX_ANALYTICS_EVENTS)
  } catch {
    return []
  }
}

function createEventId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `event_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

let events: AnalyticsEvent[] = readEvents()
const listeners = new Set<() => void>()

function persist() {
  try {
    if (events.length === 0) {
      storage()?.removeItem(ANALYTICS_STORAGE_KEY)
      return
    }
    const store: AnalyticsStore = { version: 1, events }
    storage()?.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Analytics is optional; a blocked storage backend must not break the workflow.
  }
}

function notify() {
  for (const listener of listeners) listener()
}

export function recordEvent(
  type: AnalyticsEventType,
  details: { bytes?: number; files?: number } = {},
): void {
  const event: AnalyticsEvent = {
    id: createEventId(),
    type,
    at: new Date().toISOString(),
    ...(details.bytes !== undefined ? { bytes: details.bytes } : {}),
    ...(details.files !== undefined ? { files: details.files } : {}),
  }
  events = [event, ...events].slice(0, MAX_ANALYTICS_EVENTS)
  persist()
  notify()
}

export function getAnalyticsEvents(): AnalyticsEvent[] {
  return events
}

export function subscribeToAnalytics(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function clearAnalytics(): void {
  events = []
  persist()
  notify()
}
