import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'

function Harness({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  return (
    <MemoryRouter>
      <Sidebar open={open} onOpen={() => setOpen(true)} onClose={() => setOpen(false)} />
    </MemoryRouter>
  )
}

function renderSidebar(initialOpen = false) {
  return render(<Harness initialOpen={initialOpen} />)
}

describe('Sidebar', () => {
  it('renders the brand and primary navigation', () => {
    renderSidebar()
    expect(screen.getAllByRole('link', { name: 'SealBox home' })).toHaveLength(2)
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(nav).toHaveTextContent('Encrypt file')
    expect(nav).toHaveTextContent('Decrypt file')
    expect(nav).toHaveTextContent('Key management')
  })

  it('opens and closes the drawer from the toggle', async () => {
    const user = userEvent.setup()
    renderSidebar()

    const toggle = screen.getByRole('button', { name: 'Open navigation menu' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)
    const openToggle = screen.getByRole('button', { name: 'Close navigation menu' })
    expect(openToggle).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('sb-sidebar')).toHaveAttribute('data-open', 'true')

    await user.click(openToggle)
    expect(document.getElementById('sb-sidebar')?.getAttribute('data-open')).toBeNull()
  })

  it('moves focus into the drawer when opened', async () => {
    const user = userEvent.setup()
    renderSidebar()
    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus()
  })

  it('closes the drawer on Escape and restores focus to the toggle', async () => {
    const user = userEvent.setup()
    renderSidebar(true)

    await user.keyboard('{Escape}')
    expect(document.getElementById('sb-sidebar')?.getAttribute('data-open')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toHaveFocus()
  })

  it('closes the drawer when the overlay is clicked', async () => {
    const user = userEvent.setup()
    const { container } = renderSidebar(true)
    const overlay = container.querySelector('.sb-drawer-overlay')
    expect(overlay).not.toBeNull()
    await user.click(overlay as HTMLElement)
    expect(document.getElementById('sb-sidebar')?.getAttribute('data-open')).toBeNull()
  })

  it('closes the drawer after navigating', async () => {
    const user = userEvent.setup()
    renderSidebar(true)
    await user.click(screen.getByRole('link', { name: 'Key management' }))
    expect(document.getElementById('sb-sidebar')?.getAttribute('data-open')).toBeNull()
  })
})
