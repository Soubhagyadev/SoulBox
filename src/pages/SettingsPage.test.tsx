import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../App'
import { KeyVaultProvider } from '../context/KeyVaultProvider'
import { MemoryKeyVault } from '../lib/storage/keyVault'
import { PREFERENCES_STORAGE_KEY, initTheme } from '../lib/preferences'
import { createTestKey } from '../test/fixtures'

function renderSettings(vault: MemoryKeyVault) {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <KeyVaultProvider storage={vault}>
        <App />
      </KeyVaultProvider>
    </MemoryRouter>,
  )
}

describe('Settings page', () => {
  beforeEach(() => {
    localStorage.clear()
    initTheme()
  })

  it('applies and persists the selected theme', async () => {
    const user = userEvent.setup()
    renderSettings(new MemoryKeyVault())

    const dark = screen.getByRole('radio', { name: /^dark/i })
    await user.click(dark)

    expect(dark).toBeChecked()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}')).toMatchObject({
      theme: 'dark',
    })

    await user.click(screen.getByRole('radio', { name: /^light/i }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('deletes every key from the vault after confirmation', async () => {
    const user = userEvent.setup()
    const key = await createTestKey('Alice', 'settings-key')
    const vault = new MemoryKeyVault([key.stored])
    renderSettings(vault)

    expect(await screen.findByText('1 key is stored in this browser.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete all keys' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete every key' }))

    expect(await screen.findByText('Key vault cleared')).toBeInTheDocument()
    expect(await screen.findByText('No keys are stored in this browser.')).toBeInTheDocument()
    expect(await vault.list()).toHaveLength(0)
  })

  it('disables wiping the vault when no keys are stored', async () => {
    renderSettings(new MemoryKeyVault())

    expect(await screen.findByText('No keys are stored in this browser.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete all keys' })).toBeDisabled()
  })
})
