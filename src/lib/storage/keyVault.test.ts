import { beforeEach, describe, expect, it } from 'vitest'
import {
  LocalStorageKeyVault,
  MemoryKeyVault,
  type StoredKey,
} from './keyVault'

function makeKey(overrides: Partial<StoredKey> = {}): StoredKey {
  return {
    id: 'key-1',
    name: 'Test key',
    createdAt: '2024-01-01T00:00:00.000Z',
    algorithm: 'RSA-OAEP-2048',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----',
    privateKeyPem: null,
    ...overrides,
  }
}

describe('MemoryKeyVault', () => {
  it('adds, lists, gets, and removes keys', async () => {
    const vault = new MemoryKeyVault()
    await vault.put(makeKey())
    expect(await vault.list()).toHaveLength(1)
    expect((await vault.get('key-1'))?.name).toBe('Test key')

    await vault.put(makeKey({ name: 'Renamed' }))
    expect((await vault.list())[0].name).toBe('Renamed')

    await vault.remove('key-1')
    expect(await vault.list()).toHaveLength(0)
    expect(await vault.get('key-1')).toBeNull()
  })
})

describe('LocalStorageKeyVault', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists keys to localStorage', async () => {
    const vault = new LocalStorageKeyVault()
    await vault.put(makeKey())

    const reloaded = new LocalStorageKeyVault()
    expect(await reloaded.list()).toHaveLength(1)
  })

  it('ignores malformed stored data', async () => {
    localStorage.setItem('sealbox.keyvault.v1', 'not json')
    const vault = new LocalStorageKeyVault()
    expect(await vault.list()).toEqual([])
  })

  it('filters out entries that are not valid keys', async () => {
    localStorage.setItem(
      'sealbox.keyvault.v1',
      JSON.stringify([makeKey(), { id: 5 }, null]),
    )
    const vault = new LocalStorageKeyVault()
    const keys = await vault.list()
    expect(keys).toHaveLength(1)
    expect(keys[0].id).toBe('key-1')
  })
})
