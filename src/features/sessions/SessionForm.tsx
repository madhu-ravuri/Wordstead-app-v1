import { useState, type FormEvent } from 'react'
import type { WritingSession } from '../../domain/projects'
import {
  validateSessionForm,
  type SessionFieldErrors,
  type SessionFields,
  type SessionFormValues,
} from '../../domain/sessions'

interface SessionFormProps {
  session?: WritingSession
  today: string
  onCancel: () => void
  onSubmit: (fields: SessionFields) => Promise<void>
  storageUnavailable?: boolean
}

export function SessionForm({
  session,
  today,
  onCancel,
  onSubmit,
  storageUnavailable = false,
}: SessionFormProps) {
  const [values, setValues] = useState<SessionFormValues>(() => ({
    wordCount: session ? String(session.wordCount) : '',
    date: session?.date ?? today,
  }))
  const [errors, setErrors] = useState<SessionFieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const idPrefix = session ? `session-${session.id}` : 'new-session'

  const updateField = (field: keyof SessionFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setSubmitError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = validateSessionForm(values, today)
    setErrors(result.errors)
    setSubmitError(null)
    if (!result.fields) return

    setIsSaving(true)
    try {
      await onSubmit(result.fields)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'This session could not be saved.')
      setIsSaving(false)
    }
  }

  const countErrorId = errors.wordCount ? `${idPrefix}-count-error` : undefined
  const dateErrorId = errors.date ? `${idPrefix}-date-error` : undefined

  return (
    <form
      className="session-form"
      onSubmit={handleSubmit}
      noValidate
      aria-label={session ? 'Edit session' : 'Log a session'}
    >
      {submitError && <p className="form-error form-error-summary" role="alert">{submitError}</p>}
      <div className="form-field">
        <label htmlFor={`${idPrefix}-count`}>Words written</label>
        <input
          autoFocus
          id={`${idPrefix}-count`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={values.wordCount}
          onChange={(event) => updateField('wordCount', event.currentTarget.value)}
          aria-invalid={Boolean(errors.wordCount)}
          aria-describedby={countErrorId}
          required
        />
        {errors.wordCount && <p className="form-error" id={countErrorId}>{errors.wordCount}</p>}
      </div>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-date`}>Date written</label>
        <input
          id={`${idPrefix}-date`}
          type="date"
          max={today}
          value={values.date}
          onChange={(event) => updateField('date', event.currentTarget.value)}
          aria-invalid={Boolean(errors.date)}
          aria-describedby={dateErrorId}
          required
        />
        {errors.date && <p className="form-error" id={dateErrorId}>{errors.date}</p>}
      </div>
      <div className="form-actions">
        <button className="secondary-button" type="button" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
        <button className="primary-button" type="submit" disabled={isSaving || storageUnavailable}>
          {isSaving ? 'Saving…' : session ? 'Save session' : 'Log session'}
        </button>
      </div>
    </form>
  )
}
