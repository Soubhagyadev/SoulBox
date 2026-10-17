import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FingerprintValue } from './FingerprintValue'

const VALUE =
  '9C:41:6D:2E:88:B0:73:5F:A1:22:04:D9:6E:C8:31:B7:AB:CD:EF:01:23:45:67:89:0A:BC:DE:F0:11:22:33:44'

describe('FingerprintValue', () => {
  it('masks the fingerprint by default and toggles reveal', async () => {
    const user = userEvent.setup()
    render(<FingerprintValue value={VALUE} label="Work laptop" />)

    expect(screen.getByText('••:••:••:••')).toBeInTheDocument()
    expect(screen.queryByText(VALUE)).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Show fingerprint for Work laptop' }))
    expect(screen.getByText(VALUE)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hide fingerprint for Work laptop' }))
    expect(screen.queryByText(VALUE)).toBeNull()
  })

  it('copies the full fingerprint and confirms', async () => {
    const user = userEvent.setup()
    render(<FingerprintValue value={VALUE} />)

    expect(screen.queryByText(VALUE)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Copy fingerprint' }))

    expect(await navigator.clipboard.readText()).toBe(VALUE)
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })
})
