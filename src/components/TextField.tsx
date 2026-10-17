import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'

interface FieldShellProps {
  id: string
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: (ids: { describedBy: string | undefined; invalid: boolean }) => ReactNode
}

function FieldShell({ id, label, hint, error, required, children }: FieldShellProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="sb-field">
      <label className="sb-field__label" htmlFor={id}>
        {label}
        {required ? (
          <span className="sb-field__required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p className="sb-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {children({ describedBy, invalid: Boolean(error) })}
      {error ? (
        <p className="sb-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
}

export function TextField({ label, hint, error, id, required, ...rest }: TextFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required}>
      {({ describedBy, invalid }) => (
        <input
          id={fieldId}
          className="sb-input"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          {...rest}
        />
      )}
    </FieldShell>
  )
}
export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  hint?: string
  error?: string
}

export function TextAreaField({ label, hint, error, id, required, ...rest }: TextAreaFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required}>
      {({ describedBy, invalid }) => (
        <textarea
          id={fieldId}
          className="sb-textarea"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          {...rest}
        />
      )}
    </FieldShell>
  )
}
