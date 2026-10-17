import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../App'
import { KeyVaultProvider } from '../context/KeyVaultProvider'
import { MemoryKeyVault } from '../lib/storage/keyVault'
import {
  decryptPackage,
  importPrivateKeyPem,
  parsePackage,
  serializePackage,
} from '../lib/crypto'
import { createTestKey, createTestPackage } from '../test/fixtures'

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

describe('Encrypt workflow', () => {
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

  it('encrypts a selected file for a saved recipient key', async () => {
    const user = userEvent.setup()
    const key = await createTestKey('Alice')
    const vault = new MemoryKeyVault([key.stored])

    const { container } = renderApp('/encrypt', vault)

    const keySelect = await screen.findByLabelText("Recipient's public key")
    await user.selectOptions(keySelect, key.stored.id)
    expect(await screen.findByText('Recipient key ready')).toBeInTheDocument()

    const file = new File(['hello from the test suite'], 'greeting.txt', { type: 'text/plain' })
    await user.upload(dropzoneInput(container), file)

    expect(await screen.findByText('greeting.txt')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Encrypt file' }))

    expect(await screen.findByText(/Encryption completed/i)).toBeInTheDocument()
    const downloadButton = screen.getByRole('button', { name: 'Download package' })

    await user.click(downloadButton)
    await waitFor(() => expect(createdBlobs.length).toBeGreaterThan(0))

    const pkg = parsePackage(await createdBlobs[createdBlobs.length - 1].text())
    const privateKey = await importPrivateKeyPem(key.privateKeyPem)
    const decrypted = await decryptPackage(pkg, privateKey)
    expect(new TextDecoder().decode(decrypted.bytes)).toBe('hello from the test suite')
    expect(pkg.fileName).toBe('greeting.txt')
  })

  it('keeps the encrypt action disabled until a file and key are chosen', async () => {
    const key = await createTestKey('Bob')
    const vault = new MemoryKeyVault([key.stored])
    renderApp('/encrypt', vault)

    await screen.findByLabelText("Recipient's public key")
    expect(screen.getByRole('button', { name: 'Encrypt file' })).toBeDisabled()
  })
})

describe('Decrypt workflow', () => {
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

  afterEach(() => {
    createdBlobs.length = 0
  })

  it('decrypts a package with the matching private key', async () => {
    const user = userEvent.setup()
    const key = await createTestKey('Alice')
    const pkg = await createTestPackage(key.publicKeyPem, 'secret.txt', 'classified payload')
    const vault = new MemoryKeyVault([key.stored])

    const { container } = renderApp('/decrypt', vault)

    const pkgFile = new File([serializePackage(pkg)], 'secret.txt.sealbox', {
      type: 'application/json',
    })
    await user.upload(dropzoneInput(container), pkgFile)

    expect(await screen.findByText('secret.txt')).toBeInTheDocument()

    const keySelect = screen.getByLabelText('Your private key')
    await user.selectOptions(keySelect, key.stored.id)

    await user.click(screen.getByRole('button', { name: 'Decrypt file' }))

    expect(await screen.findByText(/Decryption completed/i)).toBeInTheDocument()
    expect(screen.getAllByText('secret.txt').length).toBeGreaterThanOrEqual(1)

    await user.click(screen.getByRole('button', { name: 'Download file' }))
    await waitFor(() => expect(createdBlobs.length).toBeGreaterThan(0))
    expect(await createdBlobs[createdBlobs.length - 1].text()).toBe('classified payload')
  })

  it('shows a clear error when the wrong private key is used', async () => {
    const user = userEvent.setup()
    const recipient = await createTestKey('Recipient', 'recipient-key')
    const stranger = await createTestKey('Stranger', 'stranger-key')
    const pkg = await createTestPackage(recipient.publicKeyPem, 'secret.txt', 'classified payload')
    const vault = new MemoryKeyVault([stranger.stored])

    const { container } = renderApp('/decrypt', vault)

    await user.upload(
      dropzoneInput(container),
      new File([serializePackage(pkg)], 'secret.txt.sealbox', { type: 'application/json' }),
    )
    await screen.findByText('secret.txt')

    await user.selectOptions(screen.getByLabelText('Your private key'), stranger.stored.id)
    await user.click(screen.getByRole('button', { name: 'Decrypt file' }))

    expect(await screen.findByText(/does not match/i)).toBeInTheDocument()
    expect(screen.queryByText(/Decryption completed/i)).toBeNull()
  })
})

describe('Key management workflow', () => {
  it('shows the private key once on creation, then keeps it out of view', async () => {
    const user = userEvent.setup()
    const vault = new MemoryKeyVault()
    renderApp('/keys', vault)

    await user.click(screen.getByRole('button', { name: 'Generate key pair' }))
    await user.type(await screen.findByLabelText('Key name'), 'My laptop')
    await user.click(screen.getByRole('button', { name: 'Create key pair' }))

    expect(await screen.findByText('Key pair created')).toBeInTheDocument()
    const reveal = (await screen.findByLabelText('Private key')) as HTMLTextAreaElement
    expect(reveal.value).toContain('BEGIN PRIVATE KEY')

    await user.click(screen.getByRole('button', { name: 'Copy private key' }))
    expect(await navigator.clipboard.readText()).toContain('BEGIN PRIVATE KEY')

    await user.click(screen.getByRole('button', { name: 'I have saved it' }))

    expect(screen.getByText('My laptop')).toBeInTheDocument()
    expect(screen.getByText('Key pair')).toBeInTheDocument()
    expect(screen.queryByLabelText('Private key')).toBeNull()
  })

  it('requires a name before generating a key', async () => {
    const user = userEvent.setup()
    const vault = new MemoryKeyVault()
    renderApp('/keys', vault)

    await user.click(screen.getByRole('button', { name: 'Generate key pair' }))
    await user.click(await screen.findByRole('button', { name: 'Create key pair' }))

    expect(await screen.findByText(/give this key a name/i)).toBeInTheDocument()
  })
})
