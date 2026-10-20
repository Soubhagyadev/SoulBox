import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ANALYTICS_STORAGE_KEY,
  MAX_ANALYTICS_EVENTS,
  clearAnalytics,
  getAnalyticsEvents,
  recordEvent,
  subscribeToAnalytics,
} from './analytics'

describe('analytics store', () => {
  beforeEach(() => {
    localStorage.clear()
    clearAnalytics()
  })

  it('records events newest first and persists them', () => {
    recordEvent('encrypt', { bytes: 512 })
    recordEvent('batch-encrypt', { bytes: 2048, files: 4 })

    const events = getAnalyticsEvents()
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ type: 'batch-encrypt', bytes: 2048, files: 4 })
    expect(events[1]).toMatchObject({ type: 'encrypt', bytes: 512 })

    const stored = JSON.parse(localStorage.getItem(ANALYTICS_STORAGE_KEY) ?? '{}')
    expect(stored.version).toBe(1)
    expect(stored.events[0]).toMatchObject({ type: 'batch-encrypt', files: 4 })
  })

  it('notifies subscribers until they unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToAnalytics(listener)

    recordEvent('decrypt', { bytes: 128 })
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    recordEvent('decrypt', { bytes: 256 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('caps stored events at the maximum', () => {
    for (let index = 0; index < MAX_ANALYTICS_EVENTS + 5; index += 1) {
      recordEvent('encrypt', { bytes: index })
    }

    const events = getAnalyticsEvents()
    expect(events).toHaveLength(MAX_ANALYTICS_EVENTS)
    expect(events[0]?.bytes).toBe(MAX_ANALYTICS_EVENTS + 4)
  })

  it('clears events and removes stored data', () => {
    recordEvent('key-create')
    clearAnalytics()

    expect(getAnalyticsEvents()).toEqual([])
    expect(localStorage.getItem(ANALYTICS_STORAGE_KEY)).toBeNull()
  })
})
