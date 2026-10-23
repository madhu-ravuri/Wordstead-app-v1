import { useState, type FormEvent } from 'react'
import { ArrowLeft } from 'lucide-react'
import {
  validateProjectForm,
  type Project,
  type ProjectFields,
  type ProjectFormValues,
} from '../../domain/projects'

interface ProjectFormProps {
  initialProject?: Project
  onCancel: () => void
  onSubmit: (fields: ProjectFields) => Promise<void>
  storageUnavailable?: boolean
}

function getInitialValues(project?: Project): ProjectFormValues {
  return {
    title: project?.title ?? '',
    startingWordCount: project ? String(project.startingWordCount) : '',
    deadline: project?.deadline ?? '',
    synopsis: project?.synopsis ?? '',
    notes: project?.notes ?? '',
  }
}

export function ProjectForm({
  initialProject,
  onCancel,
  onSubmit,
  storageUnavailable = false,
}: ProjectFormProps) {
  const [values, setValues] = useState(() => getInitialValues(initialProject))
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectFormValues, string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const updateField = (field: keyof ProjectFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setSubmitError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = validateProjectForm(values)
    setErrors(result.errors)
    setSubmitError(null)
    if (!result.fields) return

    setIsSaving(true)
    try {
      await onSubmit(result.fields)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Your project could not be saved.')
    } finally {
      setIsSaving(false)
    }
  }

  const titleErrorId = errors.title ? 'project-title-error' : undefined
  const countErrorId = errors.startingWordCount ? 'starting-count-error' : undefined
  const deadlineErrorId = errors.deadline ? 'deadline-error' : undefined

  return (
    <section className="project-form-wrap">
      <button className="back-link" type="button" onClick={onCancel}>
        <ArrowLeft size={18} aria-hidden="true" />
        <span>Back</span>
      </button>
      <div className="form-heading">
        <p className="eyebrow">{initialProject ? 'Revising the page' : 'A new page'}</p>
        <h1>{initialProject ? 'Edit project' : 'New project'}</h1>
      </div>

      <form className="project-form" onSubmit={handleSubmit} noValidate>
        {submitError && <p className="form-error form-error-summary" role="alert">{submitError}</p>}
        <div className="form-field">
          <label htmlFor="project-title">Title <span aria-hidden="true">*</span></label>
          <input
            autoFocus
            id="project-title"
            name="title"
            type="text"
            autoComplete="off"
            value={values.title}
            onChange={(event) => updateField('title', event.currentTarget.value)}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={titleErrorId}
            required
          />
          {errors.title && <p className="form-error" id={titleErrorId}>{errors.title}</p>}
        </div>

        <div className="form-field form-field-compact">
          <label htmlFor="starting-count">Starting word count</label>
          <input
            id="starting-count"
            name="startingWordCount"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={values.startingWordCount}
            onChange={(event) => updateField('startingWordCount', event.currentTarget.value)}
            aria-invalid={Boolean(errors.startingWordCount)}
            aria-describedby={countErrorId}
          />
          {errors.startingWordCount && <p className="form-error" id={countErrorId}>{errors.startingWordCount}</p>}
        </div>

        <div className="form-field form-field-compact">
          <label htmlFor="project-deadline">Deadline</label>
          <input
            id="project-deadline"
            name="deadline"
            type="date"
            value={values.deadline}
            onChange={(event) => updateField('deadline', event.currentTarget.value)}
            aria-invalid={Boolean(errors.deadline)}
            aria-describedby={deadlineErrorId}
          />
          {errors.deadline && <p className="form-error" id={deadlineErrorId}>{errors.deadline}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="project-synopsis">Synopsis</label>
          <textarea
            id="project-synopsis"
            name="synopsis"
            rows={3}
            value={values.synopsis}
            onChange={(event) => updateField('synopsis', event.currentTarget.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="project-notes">Notes</label>
          <textarea
            id="project-notes"
            name="notes"
            rows={4}
            value={values.notes}
            onChange={(event) => updateField('notes', event.currentTarget.value)}
          />
        </div>

        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={onCancel} disabled={isSaving}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={isSaving || storageUnavailable}>
            {isSaving ? 'Saving…' : initialProject ? 'Save changes' : 'Save project'}
          </button>
        </div>
      </form>
    </section>
  )
}