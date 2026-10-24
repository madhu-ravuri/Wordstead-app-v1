import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { formatCalendarDate } from '../../domain/dates'
import type { WritingSession } from '../../domain/projects'
import { sortSessionHistory, type SessionFields } from '../../domain/sessions'
import { SessionForm } from './SessionForm'

interface SessionHistoryProps {
  sessions: readonly WritingSession[]
  today: string
  canLog: boolean
  onLog: (fields: SessionFields) => Promise<void>
  onUpdate: (session: WritingSession, fields: SessionFields) => Promise<void>
  onDelete: (session: WritingSession) => Promise<void>
  storageUnavailable: boolean
}

type Editor = { mode: 'new' } | { mode: 'edit'; id: string } | null

function formatWords(count: number): string {
  return `${new Intl.NumberFormat().format(count)} ${count === 1 ? 'word' : 'words'}`
}

export function SessionHistory({
  sessions,
  today,
  canLog,
  onLog,
  onUpdate,
  onDelete,
  storageUnavailable,
}: SessionHistoryProps) {
  const [editor, setEditor] = useState<Editor>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const logButton = useRef<HTMLButtonElement>(null)
  const wasLogging = useRef(false)
  const history = sortSessionHistory(sessions)

  // Return focus to "Log session" when its form closes.
  useEffect(() => {
    if (wasLogging.current && editor === null) logButton.current?.focus()
    wasLogging.current = editor?.mode === 'new'
  }, [editor])

  const openEditor = (next: Editor) => {
    setEditor(next)
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
      // The focused row is gone; keep keyboard users in the session area.
      logButton.current?.focus()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'This session could not be deleted.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="session-history" aria-labelledby="session-history-heading">
      <div className="session-history-header">
        <div>
          <p className="eyebrow">The pages so far</p>
          <h2 id="session-history-heading">Writing sessions</h2>
        </div>
        {canLog && editor?.mode !== 'new' && (
          <button
            ref={logButton}
            className="primary-button log-session-button"
            type="button"
            onClick={() => openEditor({ mode: 'new' })}
            disabled={storageUnavailable}
          >
            <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
            Log session
          </button>
        )}
      </div>

      <p className="visually-hidden" role="status">{status}</p>
      {deleteError && <p className="form-error form-error-summary" role="alert">{deleteError}</p>}

      {editor?.mode === 'new' && (
        <SessionForm
          today={today}
          onCancel={() => setEditor(null)}
          onSubmit={async (fields) => {
            await onLog(fields)
            setEditor(null)
            setStatus(`Logged ${formatWords(fields.wordCount)} for ${formatCalendarDate(fields.date)}.`)
          }}
          storageUnavailable={storageUnavailable}
        />
      )}

      {history.length === 0 ? (
        editor?.mode !== 'new' && (
          <p className="session-empty">
            No sessions recorded yet.
            {canLog && ' Log your first session to start this project’s chart.'}
          </p>
        )
      ) : (
        <ol className="session-list">
          {history.map((session) => {
            const date = formatCalendarDate(session.date)
            const words = formatWords(session.wordCount)

            if (editor?.mode === 'edit' && editor.id === session.id) {
              return (
                <li key={session.id} className="session-entry session-entry-editing">
                  <SessionForm
                    session={session}
                    today={today}
                    onCancel={() => setEditor(null)}
                    onSubmit={async (fields) => {
                      await onUpdate(session, fields)
                      setEditor(null)
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
                {confirmingDeleteId === session.id ? (
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
                      onClick={() => openEditor({ mode: 'edit', id: session.id })}
                      disabled={storageUnavailable}
                    >
                      Edit
                    </button>
                    <button
                      className="text-button"
                      type="button"
                      aria-label={`Delete session on ${date}, ${words}`}
                      onClick={() => {
                        openEditor(null)
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
