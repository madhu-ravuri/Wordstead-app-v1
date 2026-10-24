import { useState } from 'react'
import { formatCalendarDate } from '../../domain/dates'
import type { WritingSession } from '../../domain/projects'
import { sortSessionHistory, type SessionFields } from '../../domain/sessions'
import { SessionForm } from './SessionForm'

interface SessionHistoryProps {
  sessions: readonly WritingSession[]
  today: string
  /** False for completed projects: sessions are read-only until the project is reopened. */
  canChangeSessions: boolean
  /** Explains why sessions are read-only. */
  readOnlyMessage?: string
  /** The log form is opened from the page toolbar; this section renders it. */
  isLogging: boolean
  onLogClose: () => void
  /** Called after a deletion removes the focused row, so focus can be restored. */
  onSessionRemoved?: () => void
  onLog: (fields: SessionFields) => Promise<void>
  onUpdate: (session: WritingSession, fields: SessionFields) => Promise<void>
  onDelete: (session: WritingSession) => Promise<void>
  storageUnavailable: boolean
}

function formatWords(count: number): string {
  return `${new Intl.NumberFormat().format(count)} ${count === 1 ? 'word' : 'words'}`
}

export function SessionHistory({
  sessions,
  today,
  canChangeSessions,
  readOnlyMessage,
  isLogging,
  onLogClose,
  onSessionRemoved,
  onLog,
  onUpdate,
  onDelete,
  storageUnavailable,
}: SessionHistoryProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const history = sortSessionHistory(sessions)
  // Only one session form at a time: opening the log form supersedes an in-progress edit.
  const showLogForm = isLogging && canChangeSessions
  const activeEditId = showLogForm || !canChangeSessions ? null : editingId

  const openEdit = (id: string | null) => {
    if (showLogForm) onLogClose()
    setEditingId(id)
    setConfirmingDeleteId(null)
    setDeleteError(null)
    setStatus('')
  }

  const handleDelete = async (session: WritingSession) => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await onDelete(session)
      setConfirmingDeleteId(null)
      setStatus(`Deleted the ${formatCalendarDate(session.date)} session.`)
      onSessionRemoved?.()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'This session could not be deleted.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="session-history" aria-labelledby="session-history-heading">
      <div className="session-history-header">
        <p className="eyebrow">The pages so far</p>
        <h2 id="session-history-heading">Writing sessions</h2>
      </div>

      {!canChangeSessions && readOnlyMessage && <p className="session-log-note">{readOnlyMessage}</p>}
      <p className="visually-hidden" role="status">{status}</p>
      {deleteError && <p className="form-error form-error-summary" role="alert">{deleteError}</p>}

      {showLogForm && (
        <SessionForm
          today={today}
          onCancel={onLogClose}
          onSubmit={async (fields) => {
            await onLog(fields)
            onLogClose()
            setStatus(`Logged ${formatWords(fields.wordCount)} for ${formatCalendarDate(fields.date)}.`)
          }}
          storageUnavailable={storageUnavailable}
        />
      )}

      {history.length === 0 ? (
        !showLogForm && (
          <p className="session-empty">
            No sessions recorded yet.
            {canChangeSessions && ' Log your first session to start this project’s chart.'}
          </p>
        )
      ) : (
        <ol className="session-list">
          {history.map((session) => {
            const date = formatCalendarDate(session.date)
            const words = formatWords(session.wordCount)

            if (activeEditId === session.id) {
              return (
                <li key={session.id} className="session-entry session-entry-editing">
                  <SessionForm
                    session={session}
                    today={today}
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (fields) => {
                      await onUpdate(session, fields)
                      setEditingId(null)
                      setStatus(`Updated the session to ${formatWords(fields.wordCount)} on ${formatCalendarDate(fields.date)}.`)
                    }}
                    storageUnavailable={storageUnavailable}
                  />
                </li>
              )
            }

            return (
              <li key={session.id} className="session-entry">
                <span className="session-entry-date">{date}</span>
                <span className="session-entry-words">{words}</span>
                {!canChangeSessions ? null : confirmingDeleteId === session.id ? (
                  <div className="session-confirm" role="group" aria-label={`Delete the ${date} session of ${words}?`}>
                    <span className="session-confirm-question">Delete this session?</span>
                    <button
                      autoFocus
                      className="secondary-button"
                      type="button"
                      onClick={() => setConfirmingDeleteId(null)}
                      disabled={isDeleting}
                    >
                      Keep
                    </button>
                    <button
                      className="primary-button danger-button"
                      type="button"
                      onClick={() => void handleDelete(session)}
                      disabled={isDeleting || storageUnavailable}
                    >
                      {isDeleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                ) : (
                  <div className="session-actions">
                    <button
                      className="text-button"
                      type="button"
                      aria-label={`Edit session on ${date}, ${words}`}
                      onClick={() => openEdit(session.id)}
                      disabled={storageUnavailable}
                    >
                      Edit
                    </button>
                    <button
                      className="text-button"
                      type="button"
                      aria-label={`Delete session on ${date}, ${words}`}
                      onClick={() => {
                        openEdit(null)
                        setConfirmingDeleteId(session.id)
                      }}
                      disabled={storageUnavailable}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
