/**
 * Default key vault selection: SQLite inside the page (WASM + IndexedDB),
 * with localStorage / memory fallbacks for environments without IndexedDB.
 */

import sqlWasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'
import {
  LocalStorageKeyVault,
  MemoryKeyVault,
  localStorageAvailable,
  readLocalStorageKeys,
  type KeyVaultStorage,
} from './keyVault'
import { IndexedDbPersistence, SqliteKeyVault } from './sqliteKeyVault'

export function createKeyVaultStorage(): KeyVaultStorage {
  if (typeof globalThis.indexedDB !== 'undefined') {
    return new SqliteKeyVault({
      persistence: new IndexedDbPersistence(),
      locateFile: () => sqlWasmUrl,
      legacyKeys: readLocalStorageKeys,
    })
  }
  return localStorageAvailable() ? new LocalStorageKeyVault() : new MemoryKeyVault()
}
