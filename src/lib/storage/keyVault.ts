/**
 * Key vault contracts and fallbacks.
 *
 * The default vault is SQLite compiled to WebAssembly (`sqliteKeyVault.ts`),
 * persisted to IndexedDB; `LocalStorageKeyVault` remains as a fallback for
 * environments without IndexedDB and `MemoryKeyVault` backs tests.
 */

export interface StoredKey {
  id: string
  name: string
  createdAt: string
  algorithm: string
  publicKeyPem: string
  privateKeyPem: string | null
}

export interface KeyVaultStorage {
  list(): Promise<StoredKey[]>
  get(id: string): Promise<StoredKey | null>
  put(key: StoredKey): Promise<void>
  remove(id: string): Promise<void>
}

const STORAGE_KEY = 'sealbox.keyvault.v1'

function isStoredKey(value: unknown): value is StoredKey {
  if (typeof value !== 'object' || value === null) return false
  const key = value as Record<string, unknown>
  return (
    typeof key.id === 'string' &&
    typeof key.name === 'string' &&
    typeof key.createdAt === 'string' &&
    typeof key.publicKeyPem === 'string' &&
    (key.privateKeyPem === null || typeof key.privateKeyPem === 'string')
  )
}

function parseStored(raw: string | null): StoredKey[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isStoredKey)
  } catch {
    return []
  }
}

export class LocalStorageKeyVault implements KeyVaultStorage {
  async list(): Promise<StoredKey[]> {
    return parseStored(safeStorage()?.getItem(STORAGE_KEY) ?? null)
  }

  async get(id: string): Promise<StoredKey | null> {
    const keys = await this.list()
    return keys.find((key) => key.id === id) ?? null
  }

  async put(key: StoredKey): Promise<void> {
    const keys = await this.list()
    const index = keys.findIndex((existing) => existing.id === key.id)
    if (index >= 0) {
      keys[index] = key
    } else {
      keys.push(key)
    }
    safeStorage()?.setItem(STORAGE_KEY, JSON.stringify(keys))
  }

  async remove(id: string): Promise<void> {
    const keys = (await this.list()).filter((key) => key.id !== id)
    safeStorage()?.setItem(STORAGE_KEY, JSON.stringify(keys))
  }
}

export class MemoryKeyVault implements KeyVaultStorage {
  private keys: StoredKey[]

  constructor(initial: StoredKey[] = []) {
    this.keys = [...initial]
  }

  async list(): Promise<StoredKey[]> {
    return [...this.keys]
  }

  async get(id: string): Promise<StoredKey | null> {
    return this.keys.find((key) => key.id === id) ?? null
  }

  async put(key: StoredKey): Promise<void> {
    const index = this.keys.findIndex((existing) => existing.id === key.id)
    if (index >= 0) {
      this.keys[index] = key
    } else {
      this.keys.push(key)
    }
  }

  async remove(id: string): Promise<void> {
    this.keys = this.keys.filter((key) => key.id !== id)
  }
}

function safeStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function localStorageAvailable(): boolean {
  return safeStorage() !== null
}

export function readLocalStorageKeys(): StoredKey[] {
  return parseStored(safeStorage()?.getItem(STORAGE_KEY) ?? null)
}

export function createKeyId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `key_${Date.now()}_${Math.random().toString(36).slice(2)}`
}
