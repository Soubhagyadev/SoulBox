import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FileDropZone } from './FileDropZone'

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]')
  if (!input) throw new Error('file input not found')
  return input as HTMLInputElement
}

describe('FileDropZone', () => {
  it('calls onSelect with a valid file', () => {
    const onSelect = vi.fn()
    const { container } = render(<FileDropZone onSelect={onSelect} />)
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })

    fireEvent.change(fileInput(container), { target: { files: [file] } })

    expect(onSelect).toHaveBeenCalledWith([file])
  })

  it('rejects files larger than the maximum size', () => {
    const onSelect = vi.fn()
    const onReject = vi.fn()
    const { container } = render(<FileDropZone onSelect={onSelect} onReject={onReject} maxSize={4} />)
    const big = new File(['too much data'], 'big.txt', { type: 'text/plain' })

    fireEvent.change(fileInput(container), { target: { files: [big] } })

    expect(onSelect).not.toHaveBeenCalled()
    expect(onReject).toHaveBeenCalledOnce()
    expect(onReject.mock.calls[0][0][0]).toMatch(/maximum size/i)
  })

  it('rejects unsupported file types', () => {
    const onSelect = vi.fn()
    const onReject = vi.fn()
    const { container } = render(
      <FileDropZone onSelect={onSelect} onReject={onReject} accept=".sealbox" />,
    )
    const wrong = new File(['x'], 'photo.png', { type: 'image/png' })

    fireEvent.change(fileInput(container), { target: { files: [wrong] } })

    expect(onSelect).not.toHaveBeenCalled()
    expect(onReject.mock.calls[0][0][0]).toMatch(/not a supported file type/i)
  })

  it('renders the provided title, hint, and button label', () => {
    render(
      <FileDropZone
        onSelect={() => {}}
        title="Choose a file to encrypt"
        hint="Drag a file here."
        buttonLabel="Browse"
      />,
    )
    expect(screen.getByText('Choose a file to encrypt')).toBeInTheDocument()
    expect(screen.getByText('Drag a file here.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Browse' })).toBeInTheDocument()
  })

  it('does not open the picker when disabled', () => {
    render(<FileDropZone onSelect={() => {}} disabled buttonLabel="Browse" />)
    expect(screen.getByRole('button', { name: 'Browse' })).toBeDisabled()
  })

  it('highlights the zone while dragging a file over it', () => {
    const { container } = render(<FileDropZone onSelect={() => {}} />)
    const zone = container.querySelector('.sb-dropzone') as HTMLElement

    fireEvent.dragOver(zone, { dataTransfer: { files: [] } })
    expect(zone).toHaveAttribute('data-dragover', 'true')

    fireEvent.dragLeave(zone)
    expect(zone.getAttribute('data-dragover')).toBeNull()
  })

  it('accepts a file dropped onto the zone', () => {
    const onSelect = vi.fn()
    const { container } = render(<FileDropZone onSelect={onSelect} />)
    const zone = container.querySelector('.sb-dropzone') as HTMLElement
    const file = new File(['x'], 'dropped.txt', { type: 'text/plain' })

    fireEvent.drop(zone, { dataTransfer: { files: [file] } })

    expect(onSelect).toHaveBeenCalledWith([file])
  })
})
