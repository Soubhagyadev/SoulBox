import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card, CardHeader } from './Card'

describe('Card', () => {
  it('renders children in a bordered surface', () => {
    render(<Card data-testid="card">Content</Card>)
    const card = screen.getByTestId('card')
    expect(card).toHaveClass('sb-card')
    expect(card).toHaveTextContent('Content')
  })

  it('supports compact and muted variants', () => {
    render(
      <Card data-testid="card" compact muted>
        Content
      </Card>,
    )
    const card = screen.getByTestId('card')
    expect(card).toHaveClass('sb-card--compact')
    expect(card).toHaveClass('sb-card--muted')
  })
})

describe('CardHeader', () => {
  it('renders a title, description, and action', () => {
    render(
      <CardHeader
        title="Public keys"
        description="Safe to share."
        action={<button type="button">Export</button>}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Public keys' })).toBeInTheDocument()
    expect(screen.getByText('Safe to share.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
  })
})
