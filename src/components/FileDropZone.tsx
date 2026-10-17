import { useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { FileUp, UploadCloud } from 'lucide-react'
import { Button } from './Button'
import { formatBytes, matchesAccept } from '../lib/files'

export interface FileDropZoneProps {
  onSelect: (files: File[]) => void
  onReject?: (reasons: string[]) => void
  accept?: string
  multiple?: boolean
  maxSize?: number
  disabled?: boolean
  title?: string
  hint?: string
  buttonLabel?: string
  icon?: 'upload' | 'file'
}

export function FileDropZone({
  onSelect,
  onReject,
  accept,
  multiple = false,
  maxSize,
  disabled = false,
  title = 'Choose a file',
  hint,
  buttonLabel = 'Choose file',
  icon = 'upload',
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const [dragging, setDragging] = useState(false)

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    const accepted: File[] = []
    const reasons: string[] = []

    for (const file of files) {
      if (maxSize && file.size > maxSize) {
        reasons.push(`“${file.name}” is ${formatBytes(file.size)}. The maximum size is ${formatBytes(maxSize)}.`)
        continue
      }
      if (!matchesAccept(file, accept)) {
        reasons.push(`“${file.name}” is not a supported file type.`)
        continue
      }
      accepted.push(file)
    }

    const selected = multiple ? accepted : accepted.slice(0, 1)
    if (selected.length > 0) onSelect(selected)
    if (reasons.length > 0) onReject?.(reasons)
  }

  const openPicker = () => {
    if (!disabled) inputRef.current?.click()
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    if (disabled) return
    handleFiles(event.dataTransfer?.files ?? null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openPicker()
    }
  }

  const Icon = icon === 'file' ? FileUp : UploadCloud

  return (
    <div
      className="sb-dropzone"
      data-dragover={dragging || undefined}
      data-disabled={disabled || undefined}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={(event) => {
        if (event.target === event.currentTarget) openPicker()
      }}
      onKeyDown={handleKeyDown}
      aria-disabled={disabled || undefined}
    >
      <span className="sb-dropzone__icon" aria-hidden="true">
        <Icon size={28} strokeWidth={1.75} />
      </span>
      <p className="sb-dropzone__title">{title}</p>
      <p className="sb-dropzone__hint">
        {hint ?? 'Drag a file here, or choose a file from your device.'}
      </p>
      <Button variant="secondary" onClick={openPicker} disabled={disabled}>
        {buttonLabel}
      </Button>
      <input
        ref={inputRef}
        id={inputId}
        className="sb-visually-hidden"
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        tabIndex={-1}
        onChange={(event) => {
          handleFiles(event.target.files)
          event.target.value = ''
        }}
      />
    </div>
  )
}
