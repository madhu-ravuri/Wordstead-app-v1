import { useEffect, useRef, useState } from 'react'
import type { Project } from '../../domain/projects'

interface DeleteProjectDialogProps {
  project: Project
  sessionCount: number
  sessionWords: number
  onCancel: () => void
  onConfirm: () => Promise<void>
  storageUnavailable: boolean
}

function formatCount(count: number): string {
  return new Intl.NumberFormat().format(count)
}

export function DeleteProjectDialog({
  project,
  sessionCount,
  sessionWords,
  onCancel,
  onConfirm,
  storageUnavailable,
}: DeleteProjectDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A modal <dialog> traps focus, makes the page inert, and closes on Escape.
  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
  }, [])

  // Closing (rather than just unmounting) lets the browser return focus to the trigger.
  const cancel = () => {
    if (isDeleting) return
    dialog.current?.close()
    onCancel()
  }

  const handleConfirm = async () => {
    setIsDeleting(true)
    setError(null)
    try {
      await onConfirm()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This project could not be deleted.')
      setIsDeleting(false)
    }
  }

  const history =
    sessionCount === 0
      ? 'It has no writing sessions, so your overall chart won’t change.'
      : `Its ${formatCount(sessionCount)} writing ${sessionCount === 1 ? 'session' : 'sessions'} ` +
        `(${formatCount(sessionWords)} words) will stay in your overall daily chart and in your backup data.`

  return (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      aria-labelledby="delete-project-title"
      aria-describedby="delete-project-description"
      onCancel={(event) => {
        event.preventDefault()
        cancel()
      }}
    >
      <p className="eyebrow">Delete project</p>
      <h2 id="delete-project-title">Delete “{project.title}”?</h2>
      <div id="delete-project-description" className="confirm-dialog-copy">
        <p>It will be removed from your active and completed projects.</p>
        <p>{history}</p>
        <p>Wordstead can’t restore deleted projects yet.</p>
      </div>
      {error && <p className="form-error form-error-summary" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="secondary-button" type="button" onClick={cancel} disabled={isDeleting}>
          Cancel
        </button>
        <button
          className="primary-button danger-button"
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isDeleting || storageUnavailable}
        >
          {isDeleting ? 'Deleting…' : 'Delete project'}
        </button>
      </div>
    </dialog>
  )
}
