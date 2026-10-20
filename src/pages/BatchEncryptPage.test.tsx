import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../App'
import { KeyVaultProvider } from '../context/KeyVaultProvider'
import { MemoryKeyVault } from '../lib/storage/keyVault'
import {
  decryptPackage,
  encryptFile,
  importPrivateKeyPem,
  importPublicKeyPem,
  parsePackage,
  serializePackage,
} from '../lib/crypto'
import { createBundle, readBundle } from '../lib/bundle'
import { createTestKey } from '../test/fixtures'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function renderApp(path: string, vault: MemoryKeyVault) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <KeyVaultProvider storage={vault}>
        <App />
      </KeyVaultProvider>
    </MemoryRouter>,
  )
}

function dropzoneInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('.sb-dropzone input[type="file"]')
  if (!input) throw new Error('dropzone file input not found')
  return input as HTMLInputElement
}

describe('Folder & batch encryption', () => {
  const createdBlobs: Blob[] = []

  beforeAll(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn((blob: Blob) => {
        createdBlobs.push(blob)
        return 'blob:mock-url'
      }),
    })
    Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: vi.fn() })
  })

  beforeEach(() => {
    createdBlobs.length = 0
  })

  afterEach(() => {
    createdBlobs.length = 0
  })

  it('encrypts multiple files as one bundle', async () => {
    const user = userEvent.setup()
    const key = await createTestKey('Alice')
    const vault = new MemoryKeyVault([key.stored])
    const { container } = renderApp('/batch', vault)

    const keySelect = await screen.findByLabelText("Recipient's public key")
    await user.selectOptions(keySelect, key.stored.id)
    expect(await screen.findByText('Recipient key ready')).toBeInTheDocument()

    await user.upload(dropzoneInput(container), [
      new File(['alpha'], 'a.txt', { type: 'text/plain' }),
      new File(['beta'], 'b.bin', { type: 'application/octet-stream' }),
    ])

    expect(await screen.findByText(/files · 9 B/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Encrypt bundle' }))
    expect(await screen.findByText('Bundle encrypted')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Download package' }))
    await waitFor(() => expect(createdBlobs.length).toBeGreaterThan(0))

    const pkg = parsePackage(await createdBlobs[createdBlobs.length - 1].text())
    if (pkg.metadata !== 'visible') throw new Error('expected visible metadata')
    expect(pkg.fileName).toBe('sealbox-batch-2-files.zip')
    expect(pkg.fileType).toBe('application/zip')

    const privateKey = await importPrivateKeyPem(key.privateKeyPem)
    const decrypted = await decryptPackage(pkg, privateKey)
    const bundle = readBundle(decrypted.bytes)
    expect(bundle).not.toBeNull()
    expect(bundle?.entries.map((entry) => entry.name).sort()).toEqual(['a.txt', 'b.bin'])
    expect(
      decoder.decode(bundle?.entries.find((entry) => entry.name === 'b.bin')?.bytes),
    ).toBe('beta')
  })

  it('decrypts a bundle and lists its files', async () => {
    const user = userEvent.setup()
    const key = await createTestKey('Alice', 'bundle-key')
    const bundleBytes = createBundle([
      { name: 'docs/notes.txt', bytes: encoder.encode('hello bundle') },
    ])
    const publicKey = await importPublicKeyPem(key.publicKeyPem)
    const pkg = await encryptFile({
      data: bundleBytes,
      fileName: 'docs.zip',
      fileType: 'application/zip',
      recipientPublicKey: publicKey,
    })
    const vault = new MemoryKeyVault([key.stored])
    const { container } = renderApp('/decrypt', vault)

    await user.upload(
      dropzoneInput(container),
      new File([serializePackage(pkg)], 'docs.sealbox', { type: 'application/json' }),
    )

    await user.selectOptions(
      await screen.findByLabelText('Your private key'),
      key.stored.id,
    )
    await user.click(screen.getByRole('button', { name: 'Decrypt file' }))

    expect(await screen.findByText('Bundle decrypted')).toBeInTheDocument()
    expect(await screen.findByText('docs/notes.txt')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Download docs/notes.txt' }))
    await waitFor(() => expect(createdBlobs.length).toBeGreaterThan(0))
    expect(await createdBlobs[createdBlobs.length - 1].text()).toBe('hello bundle')

    await user.click(screen.getByRole('button', { name: 'Download all (.zip)' }))
    await waitFor(() => expect(createdBlobs.length).toBeGreaterThan(1))
    expect(createdBlobs[createdBlobs.length - 1].type).toBe('application/zip')
  })
})
