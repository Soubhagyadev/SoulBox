import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusMessage } from './StatusMessage'

describe('StatusMessage', () => {
  it('announces errors assertively with an alert role', () => {
    render(
      <StatusMessage variant="danger" title="Verification failed">
        Check the package.
      </StatusMessage>,
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Verification failed')
  })

  it('announces success politely with a status role', () => {
    render(<StatusMessage variant="success" title="Encryption completed" />)
    expect(screen.getByRole('status')).toHaveTextContent('Encryption completed')
  })

  it('can opt out of live-region semantics', () => {
    render(
      <StatusMessage variant="warning" title="Sensitive" live="off">
        Warning copy
      </StatusMessage>,
    )
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText('Sensitive')).toBeInTheDocument()
  })
})
