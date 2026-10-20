import { act } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AnalyticsPage } from './AnalyticsPage'
import { KeyVaultProvider } from '../context/KeyVaultProvider'
import { MemoryKeyVault } from '../lib/storage/keyVault'
import { ANALYTICS_STORAGE_KEY, clearAnalytics, recordEvent } from '../lib/analytics'

function renderAnalytics(vault = new MemoryKeyVault()) {
  return render(
    <MemoryRouter>
      <KeyVaultProvider storage={vault}>
        <AnalyticsPage />
      </KeyVaultProvider>
    </MemoryRouter>,
  )
}

describe('Analytics page', () => {
  beforeEach(() => {
    localStorage.clear()
    clearAnalytics()
  })

  it('shows an empty state when nothing has been recorded', () => {
    renderAnalytics()

    expect(screen.getByText('No activity yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Encrypt a file' })).toHaveAttribute(
      'href',
      '/encrypt',
    )
  })

  it('summarises recorded activity', async () => {
    recordEvent('batch-encrypt', { bytes: 2048, files: 3 })
    recordEvent('encrypt', { bytes: 512 })
    recordEvent('bundle-decrypt', { bytes: 4096, files: 4 })
    recordEvent('decrypt', { bytes: 1024 })
    renderAnalytics()

    const encrypted = await screen.findByRole('group', { name: 'Files encrypted' })
    expect(within(encrypted).getByText('4')).toBeInTheDocument()
    expect(within(encrypted).getByText('2.5 KB')).toBeInTheDocument()

    const decrypted = screen.getByRole('group', { name: 'Files decrypted' })
    expect(within(decrypted).getByText('5')).toBeInTheDocument()
    expect(within(decrypted).getByText('5 KB')).toBeInTheDocument()

    const bundles = screen.getByRole('group', { name: 'Bundles created' })
    expect(within(bundles).getByText('1')).toBeInTheDocument()
    expect(within(bundles).getByText('1 bundle opened')).toBeInTheDocument()

    const operations = screen.getByRole('group', { name: 'Tracked operations' })
    expect(within(operations).getByText('4')).toBeInTheDocument()
    expect(within(operations).getByText('0 keys in vault')).toBeInTheDocument()

    expect(
      screen.getByRole('group', {
        name: 'Encryption and decryption operations over the last 14 days',
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(14)

    expect(screen.getByText('Bundle encrypted')).toBeInTheDocument()
    expect(screen.getByText('File encrypted')).toBeInTheDocument()
    expect(screen.getByText('Bundle decrypted')).toBeInTheDocument()
    expect(screen.getByText('File decrypted')).toBeInTheDocument()
  })

  it('updates live when new activity is recorded', async () => {
    renderAnalytics()
    expect(screen.getByText('No activity yet')).toBeInTheDocument()

    act(() => {
      recordEvent('encrypt', { bytes: 1024 })
    })

    const encrypted = await screen.findByRole('group', { name: 'Files encrypted' })
    expect(within(encrypted).getByText('1')).toBeInTheDocument()
    expect(screen.getByText('File encrypted')).toBeInTheDocument()
  })

  it('clears analytics after confirmation', async () => {
    const user = userEvent.setup()
    recordEvent('key-delete', { files: 3 })
    renderAnalytics()

    expect(await screen.findByText('Keys deleted')).toBeInTheDocument()
    expect(screen.getByText('3 keys · just now')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear analytics' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete analytics' }))
    expect(await screen.findByText('No activity yet')).toBeInTheDocument()
    expect(localStorage.getItem(ANALYTICS_STORAGE_KEY)).toBeNull()
  })
})
