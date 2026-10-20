import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getThemePreference,
  initTheme,
  PREFERENCES_STORAGE_KEY,
  readPreferences,
  resolveTheme,
  setThemePreference,
  subscribeToTheme,
} from './preferences'

function mediaQuery(matches: boolean): MediaQueryList {
  return {
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList
}

describe('preferences', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    initTheme()
  })

  it('defaults to the system theme', () => {
    expect(readPreferences()).toEqual({ theme: 'system' })
  })

  it('persists and applies the selected theme', () => {
    setThemePreference('dark')

    expect(getThemePreference()).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}')).toMatchObject({
      theme: 'dark',
    })
  })

  it('falls back to the default when stored preferences are invalid', () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, 'not json')
    expect(readPreferences()).toEqual({ theme: 'system' })

    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ theme: 'neon' }))
    expect(readPreferences()).toEqual({ theme: 'system' })
  })

  it('resolves the system theme from the device preference', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQuery(true))
    expect(resolveTheme('system')).toBe('dark')

    vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQuery(false))
    expect(resolveTheme('system')).toBe('light')

    vi.restoreAllMocks()
  })

  it('notifies subscribers until they unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToTheme(listener)

    setThemePreference('light')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    setThemePreference('dark')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
