/**
 * SQLite-backed key vault.
 *
 * SQLite is compiled to WebAssembly (`sql.js`) and runs inside the page — no
 * server involved. The database bytes are persisted to IndexedDB, so saved
 * keys survive closing and reopening the app on the same browser.
 */

import type { Database, SqlJsStatic } from 'sql.js'
import type { KeyVaultStorage, StoredKey } from './keyVault'

export interface KeyVaultPersistence {
  load(): Promise<Uint8Array | null>
  save(data: Uint8Array): Promise<void>
}

export interface SqliteKeyVaultOptions {
  persistence: KeyVaultPersistence
  locateFile?: (file: string) => string
  legacyKeys?: () => StoredKey[]
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  algorithm TEXT NOT NULL,
  public_key_pem TEXT NOT NULL,
  private_key_pem TEXT
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

const LEGACY_IMPORT_MARKER = 'legacy-import'

const INSERT_KEY = `
INSERT OR REPLACE INTO keys (id, name, created_at, algorithm, public_key_pem, private_key_pem)
VALUES (?, ?, ?, ?, ?, ?)
`

const SELECT_KEYS = `
SELECT id, name, created_at, algorithm, public_key_pem, private_key_pem
FROM keys ORDER BY created_at
`

const SELECT_KEY_BY_ID = `
SELECT id, name, created_at, algorithm, public_key_pem, private_key_pem
FROM keys WHERE id = ?
`

type SqlValue = string | number | null | Uint8Array

function toStoredKey(row: Record<string, SqlValue>): StoredKey {
  return {
    id: String(row.id),
    name: String(row.name),
    createdAt: String(row.created_at),
    algorithm: String(row.algorithm),
    publicKeyPem: String(row.public_key_pem),
    privateKeyPem: row.private_key_pem === null ? null : String(row.private_key_pem),
  }
}

function selectRows(db: Database, sql: string, params: SqlValue[] = []): Record<string, SqlValue>[] {
  const statement = db.prepare(sql)
  try {
    statement.bind(params)
    const rows: Record<string, SqlValue>[] = []
    while (statement.step()) rows.push(statement.getAsObject() as Record<string, SqlValue>)
    return rows
  } finally {
    statement.free()
  }
}

export class SqliteKeyVault implements KeyVaultStorage {
  private readonly options: SqliteKeyVaultOptions
  private database: Promise<Database> | null = null

  constructor(options: SqliteKeyVaultOptions) {
    this.options = options
  }

  private open(): Promise<Database> {
    this.database ??= this.initialize()
    return this.database
  }

  private async initialize(): Promise<Database> {
    const { default: initSqlJs } = await import('sql.js')
    const SQL: SqlJsStatic = await initSqlJs({ locateFile: this.options.locateFile })
    const bytes = await this.options.persistence.load()
    const db = bytes ? new SQL.Database(bytes) : new SQL.Database()
    db.exec(SCHEMA)
    await this.importLegacyKeys(db)
    return db
  }

  private async importLegacyKeys(db: Database): Promise<void> {
    const marker = selectRows(db, 'SELECT value FROM meta WHERE key = ?', [LEGACY_IMPORT_MARKER])
    if (marker.length > 0) return
    for (const key of this.options.legacyKeys?.() ?? []) {
      db.run(INSERT_KEY, [key.id, key.name, key.createdAt, key.algorithm, key.publicKeyPem, key.privateKeyPem])
    }
    db.run('INSERT INTO meta (key, value) VALUES (?, ?)', [LEGACY_IMPORT_MARKER, new Date().toISOString()])
    await this.persist(db)
  }

  private persist(db: Database): Promise<void> {
    return this.options.persistence.save(db.export())
  }

  async list(): Promise<StoredKey[]> {
    return selectRows(await this.open(), SELECT_KEYS).map(toStoredKey)
  }

  async get(id: string): Promise<StoredKey | null> {
    const rows = selectRows(await this.open(), SELECT_KEY_BY_ID, [id])
    return rows.length > 0 ? toStoredKey(rows[0]) : null
  }

  async put(key: StoredKey): Promise<void> {
    const db = await this.open()
    db.run(INSERT_KEY, [key.id, key.name, key.createdAt, key.algorithm, key.publicKeyPem, key.privateKeyPem])
    await this.persist(db)
  }

  async remove(id: string): Promise<void> {
    const db = await this.open()
    db.run('DELETE FROM keys WHERE id = ?', [id])
    await this.persist(db)
  }
}

const IDB_NAME = 'sealbox'
const IDB_VERSION = 1
const IDB_STORE = 'vault'
const IDB_RECORD = 'keyvault'

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(IDB_NAME, IDB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened.'))
  })
}

export class IndexedDbPersistence implements KeyVaultPersistence {
  async load(): Promise<Uint8Array | null> {
    const db = await openIndexedDb()
    try {
      const record = await new Promise<unknown>((resolve, reject) => {
        const request = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_RECORD)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed.'))
      })
      if (record !== null && typeof record === 'object') {
        if (ArrayBuffer.isView(record)) {
          return new Uint8Array(record.buffer, record.byteOffset, record.byteLength)
        }
        if (Object.prototype.toString.call(record) === '[object ArrayBuffer]') {
          return new Uint8Array(record as ArrayBuffer)
        }
      }
      return null
    } finally {
      db.close()
    }
  }

  async save(data: Uint8Array): Promise<void> {
    const db = await openIndexedDb()
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE, 'readwrite')
        transaction.objectStore(IDB_STORE).put(data, IDB_RECORD)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB write failed.'))
        transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB write failed.'))
      })
    } finally {
      db.close()
    }
  }
}
