import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NotFound } from './NotFound'

describe('NotFound', () => {
  it('explains the page is missing and offers recovery links', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    )
    expect(screen.getByText('Page not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Encrypt a file' })).toBeInTheDocument()
  })
})
