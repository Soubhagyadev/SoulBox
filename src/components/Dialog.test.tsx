import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialog } from './Dialog'

function ReRenderingDialog() {
  const [open, setOpen] = useState(true)
  const [value, setValue] = useState('')
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Test">
      <input
        aria-label="Name"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </Dialog>
  )
}

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    render(
      <Dialog open={false} onClose={() => {}} title="Hidden">
        Body
      </Dialog>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders an accessible modal dialog when open', () => {
    render(
      <Dialog open onClose={() => {}} title="Export private key">
        <p>Sensitive content</p>
      </Dialog>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName('Export private key')
    expect(screen.getByText('Sensitive content')).toBeInTheDocument()
  })

  it('stays open and keeps focus while typing after parent re-renders', async () => {
    const user = userEvent.setup()
    render(<ReRenderingDialog />)

    await user.type(screen.getByLabelText('Name'), 'My laptop')

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('My laptop')
    expect(screen.getByLabelText('Name')).toHaveFocus()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose} title="Confirm">
        Body
      </Dialog>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not close on Escape when not dismissible', async () => {
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose} title="Confirm" dismissible={false}>
        Body
      </Dialog>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes when the overlay is clicked', async () => {
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose} title="Confirm">
        Body
      </Dialog>,
    )
    await userEvent.click(document.querySelector('.sb-dialog-overlay') as HTMLElement)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes via the close button', async () => {
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose} title="Confirm">
        Body
      </Dialog>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
