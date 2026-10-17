import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders its label and responds to clicks', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Encrypt file</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Encrypt file' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled and busy while loading', () => {
    render(<Button loading>Encrypt file</Button>)
    const button = screen.getByRole('button', { name: 'Encrypt file' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Disabled' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
