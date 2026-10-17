import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TextAreaField, TextField } from './TextField'

describe('TextField', () => {
  it('associates its label and hint with the input', () => {
    render(<TextField label="Key name" hint="Used to recognise the key." />)
    const input = screen.getByLabelText('Key name')
    expect(input).toHaveAccessibleDescription('Used to recognise the key.')
  })

  it('marks the field invalid and announces the error', () => {
    render(<TextField label="Key name" error="A name is required." />)
    const input = screen.getByLabelText('Key name')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('A name is required.')
  })

  it('keeps the entered value when an error appears', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<TextField label="Key name" />)
    const input = screen.getByLabelText('Key name')
    await user.type(input, 'My laptop')
    rerender(<TextField label="Key name" error="A name is required." />)
    expect(screen.getByLabelText('Key name')).toHaveValue('My laptop')
  })

  it('supports a required indicator', () => {
    render(<TextField label="Key name" required />)
    expect(screen.getByLabelText(/Key name/)).toBeRequired()
  })
})

describe('TextAreaField', () => {
  it('renders a labelled textarea', async () => {
    const user = userEvent.setup()
    render(<TextAreaField label="Public key" hint="Paste the PEM block." />)
    const textarea = screen.getByLabelText('Public key')
    await user.type(textarea, 'abc')
    expect(textarea).toHaveValue('abc')
    expect(textarea).toHaveAccessibleDescription('Paste the PEM block.')
  })
})
