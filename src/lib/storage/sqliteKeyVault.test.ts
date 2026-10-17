import path from 'node:path'
import { describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import type { StoredKey } from './keyVault'
import {
  IndexedDbPersistence,
  SqliteKeyVault,
  type KeyVaultPersistence,
} from './sqliteKeyVault'

class ArrayPersistence implements KeyVaultPersistence {
  bytes: Uint8Array | null = null
  saves = 0

  async load(): Promise<Uint8Array | null> {
    return this.bytes
  }

  async save(data: Uint8Array): Promise<void> {
    this.bytes = data.slice()
    this.saves += 1
  }
}

const locateFile = (file: string) => path.join(process.cwd(), 'node_modules/sql.js/dist', file)

function makeKey(overrides: Partial<StoredKey> = {}): StoredKey {
  return {
    id: 'key-1',
    name: 'Laptop',
    createdAt: '2026-01-01T00:00:00.000Z',
    algorithm: 'RSA-OAEP / SHA-256 / 2048-bit',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----',
    privateKeyPem: '-----BEGIN PRIVATE KEY-----\nBBBB\n-----END PRIVATE KEY-----',
    ...overrides,
  }
}

function createVault(persistence: KeyVaultPersistence, legacyKeys?: () => StoredKey[]) {
  return new SqliteKeyVault({ persistence, locateFile, legacyKeys })
}

describe('SqliteKeyVault', () => {
  it('stores, lists, updates, and removes keys', async () => {
    const vault = createVault(new ArrayPersistence())
    const plusOne = makeKey({
      id: 'key-2',
      name: 'Cloud runner',
      createdAt: '2026-02-01T00:00:00.000Z',
      privateKeyPem: null,
    })

    await vault.put(makeKey())
    await vault.put(plusOne)

    const keys = await vault.list()
    expect(keys.map((key) => key.id)).toEqual(['key-1', 'key-2'])
    expect(keys[1].privateKeyPem).toBeNull()

    await vault.put(makeKey({ name: 'Renamed laptop' }))
    const updated = await vault.get('key-1')
    expect(updated?.name).toBe('Renamed laptop')
    expect(await vault.list()).toHaveLength(2)

    await vault.remove('key-1')
    expect(await vault.get('key-1')).toBeNull()
    expect(await vault.list()).toHaveLength(1)
  })

  it('persists the database so a fresh vault sees the same keys', async () => {
    const persistence = new ArrayPersistence()
    const first = createVault(persistence)
    await first.put(makeKey())

    expect(persistence.saves).toBeGreaterThan(0)
    expect(persistence.bytes).not.toBeNull()

    const second = createVault(persistence)
    const keys = await second.list()
    expect(keys).toHaveLength(1)
    expect(keys[0]).toMatchObject({ id: 'key-1', name: 'Laptop', publicKeyPem: makeKey().publicKeyPem })
  })

  it('imports legacy localStorage keys once', async () => {
    const persistence = new ArrayPersistence()
    const first = createVault(persistence, () => [makeKey()])
    expect(await first.list()).toHaveLength(1)

    const second = createVault(persistence, () => [makeKey({ id: 'key-legacy', name: 'Old key' })])
    const keys = await second.list()
    expect(keys).toHaveLength(1)
    expect(keys[0].id).toBe('key-1')
  })
})

describe('IndexedDbPersistence', () => {
  it('round-trips database bytes through IndexedDB', async () => {
    const persistence = new IndexedDbPersistence()
    expect(await persistence.load()).toBeNull()

    const bytes = new Uint8Array([1, 2, 3, 250])
    await persistence.save(bytes)

    const loaded = await persistence.load()
    expect(loaded).not.toBeNull()
    expect(Array.from(loaded!)).toEqual([1, 2, 3, 250])
  })
})
