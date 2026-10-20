export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export interface Preferences {
  theme: ThemePreference
}

export const PREFERENCES_STORAGE_KEY = 'sealbox.preferences.v1'

const DEFAULT_PREFERENCES: Preferences = { theme: 'system' }
const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark']

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && THEME_PREFERENCES.includes(value as ThemePreference)
}

export function readPreferences(): Preferences {
  const raw = storage()?.getItem(PREFERENCES_STORAGE_KEY)
  if (!raw) return { ...DEFAULT_PREFERENCES }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_PREFERENCES }
    const theme = (parsed as Record<string, unknown>).theme
    return isThemePreference(theme) ? { theme } : { ...DEFAULT_PREFERENCES }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return preference
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(): ResolvedTheme {
  const resolved = resolveTheme(currentTheme)
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved
  }
  return resolved
}

let currentTheme: ThemePreference = readPreferences().theme
let systemQuery: MediaQueryList | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

function handleSystemThemeChange() {
  if (currentTheme !== 'system') return
  applyTheme()
  notify()
}

function listenForSystemTheme() {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function' ||
    systemQuery
  ) {
    return
  }
  systemQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemQuery.addEventListener?.('change', handleSystemThemeChange)
}

export function getThemePreference(): ThemePreference {
  return currentTheme
}

export function subscribeToTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setThemePreference(theme: ThemePreference): void {
  currentTheme = theme
  try {
    storage()?.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ ...readPreferences(), theme }))
  } catch {
    // A blocked storage backend should not prevent the theme from applying.
  }
  applyTheme()
  listenForSystemTheme()
  notify()
}

export function initTheme(): ThemePreference {
  currentTheme = readPreferences().theme
  applyTheme()
  listenForSystemTheme()
  return currentTheme
}
