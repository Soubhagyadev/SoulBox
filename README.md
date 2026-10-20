# SealBox — Encrypted File Transfer

A browser-based tool for encrypting files for a specific recipient and decrypting packages with
the matching private key. Built to the design specification in `EFT_Design_Spec.md`.

## What it does

- **Encrypt** a file for a recipient's RSA public key. A random AES-256-GCM key encrypts the
  file, and the recipient's public key wraps that key (hybrid encryption). An optional
  **Hide metadata** mode encrypts the original name, type, size, creation time, and recipient
  fingerprint inside the package.
- **Folder & batch encryption** packs up to 500 files (or a folder) into a ZIP bundle, encrypts
  the bundle as one package, and preserves relative paths inside it.
- **Decrypt** an `.sealbox` package with the matching RSA private key. Encrypted bundles list
  their recovered files for individual download or as one ZIP.
- **Key management** to generate, import, export, protect (passphrase), and delete keys.
- **Local analytics** with file and bundle counts, data processed, a 14-day activity chart, and a
  recent-activity list. Only operation types, dates, sizes, and counts are stored in this
  browser — never file names or contents, and nothing is uploaded.
- **Settings** for the color theme and for wiping the browser's key vault.

All cryptography runs in the browser with the Web Crypto API. Plaintext files and private keys
are never uploaded — there is no backend.

## Security model (accurate, not aspirational)

- Encryption: RSA-OAEP (SHA-256, 2048-bit) to wrap a one-time AES-256-GCM key.
- Packages are JSON `.sealbox` files. By default, **visible metadata** includes the file or
  bundle name, size, creation time, and recipient key fingerprint. Individual file names inside
  a batch bundle stay encrypted. File contents stay encrypted.
- **Hide metadata** (package format v2) encrypts those outer details with the same one-time
  AES-GCM key in a separate authenticated ciphertext. The package still reveals that it is a
  SealBox package and its approximate size through the ciphertext length, and older SealBox
  versions cannot open v2 packages.
- Private keys are kept in a SQLite database that runs in the page (WebAssembly) and is
  persisted to the browser's IndexedDB — keys survive closing and reopening the app, but
  never leave the device. Export a passphrase-protected copy for backup and delete keys
  you no longer need. (Browsers without IndexedDB fall back to `localStorage`.)
- Encryption protects confidentiality only. It is not a digital signature and does not prove who
  sent a file. Losing a private key makes addressed files unrecoverable.

## Scripts

```bash
npm install
npm run dev        # start the dev server
npm run build      # typecheck + production build
npm run preview    # preview the production build
npm run test       # run tests in watch mode
npm run test:run   # run tests once
npm run coverage   # run tests with coverage
npm run lint       # oxlint
npm run typecheck  # tsc
```

## Structure

```
src/
  lib/crypto/     encryption, keys, passphrase protection, package format (no UI dependencies)
  lib/bundle.ts   ZIP bundle creation and extraction (fflate)
  lib/analytics.ts local-only activity tracking (localStorage)
  lib/storage/    key vault (SQLite WASM + IndexedDB, localStorage/memory fallbacks)
  components/     reusable UI (Button, Card, TextField, FileDropZone, StatusMessage, Dialog…)
  context/        key vault provider
  pages/          Landing, Encrypt, Batch encryption, Decrypt, Key management, Analytics, Settings, NotFound
  styles/         design tokens and component/page styles
  test/           test setup and fixtures
```
