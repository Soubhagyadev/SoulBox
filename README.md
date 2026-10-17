# SealBox — Encrypted File Transfer

A browser-based tool for encrypting files for a specific recipient and decrypting packages with
the matching private key. Built to the design specification in `EFT_Design_Spec.md`.

## What it does

- **Encrypt** a file for a recipient's RSA public key. A random AES-256-GCM key encrypts the
  file, and the recipient's public key wraps that key (hybrid encryption).
- **Decrypt** an `.sealbox` package with the matching RSA private key.
- **Key management** to generate, import, export, protect (passphrase), and delete keys.

All cryptography runs in the browser with the Web Crypto API. Plaintext files and private keys
are never uploaded — there is no backend.

## Security model (accurate, not aspirational)

- Encryption: RSA-OAEP (SHA-256, 2048-bit) to wrap a one-time AES-256-GCM key.
- Packages are JSON `.sealbox` files. **Visible metadata**: original file name, size, creation time,
  and the recipient key fingerprint. File contents stay encrypted.
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
  lib/storage/    key vault (SQLite WASM + IndexedDB, localStorage/memory fallbacks)
  components/     reusable UI (Button, Card, TextField, FileDropZone, StatusMessage, Dialog…)
  context/        key vault provider
  pages/          Landing, Encrypt, Decrypt, Key management, NotFound
  styles/         design tokens and component/page styles
  test/           test setup and fixtures
```
