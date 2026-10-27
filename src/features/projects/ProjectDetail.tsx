import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CircleCheck, Pencil, Plus } from 'lucide-react'
import { formatCalendarDate, getLocalCalendarDate } from '../../domain/dates'
import {
  getLastEditedAt,
  getProjectTotal,
  type Project,
  type ProjectFields,
  type WritingSession,
} from '../../domain/projects'
import type { SessionFields } from '../../domain/sessions'
import { canChangeSessions } from '../../domain/projectLifecycle'
import { describeSeries, getProjectSeries } from '../../domain/sparkline'
import { ActivityChart } from '../charts/ActivityChart'
import { SessionHistory } from '../sessions/SessionHistory'
import { DeleteProjectDialog } from './DeleteProjectDialog'
import { ProjectForm } from './ProjectForm'

interface ProjectDetailProps {
  project: Project
  /** Sessions belonging to this project. */
  sessions: readonly WritingSession[]
  today: string
  onBack: () => void
  onSave: (fields: ProjectFields) => Promise<void>
  onLogSession: (fields: SessionFields) => Promise<void>
  onUpdateSession: (session: WritingSession, fields: SessionFields) => Promise<void>
  onDeleteSession: (session: WritingSession) => Promise<void>
  onComplete: () => Promise<void>
  onReopen: () => Promise<void>
  onDelete: () => Promise<void>
  storageUnavailable: boolean
}

export function ProjectDetail({
  project,
  sessions,
  today,
  onBack,
  onSave,
  onLogSession,
  onUpdateSession,
  onDeleteSession,
  onComplete,
  onReopen,
  onDelete,
  storageUnavailable,
}: ProjectDetailProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isChangingStatus, setIsChangingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [isLogging, setIsLogging] = useState(false)
  const logButton = useRef<HTMLButtonElement>(null)
  const wasLogging = useRef(false)
  const editButton = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)
  const series = getProjectSeries(project, sessions, today)
  const isCompleted = Boolean(project.completedAt)
  const sessionsEditable = canChangeSessions(project)

  // The log button is hidden while its form is open; return focus to it when the form closes.
  useEffect(() => {
    if (wasLogging.current && !isLogging) logButton.current?.focus()
    wasLogging.current = isLogging
  }, [isLogging])

  // Return focus to the pencil button after the edit form closes.
  useEffect(() => {
    if (wasEditing.current && !isEditing) editButton.current?.focus()
    wasEditing.current = isEditing
  }, [isEditing])

  const changeStatus = async (action: () => Promise<void>, message: string) => {
    setIsChangingStatus(true)
    setStatusError(null)
    try {
      await action()
      setStatusMessage(message)
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'This project could not be updated.')
    } finally {
      setIsChangingStatus(false)
    }
  }

  if (isEditing) {
    return (
      <ProjectForm
        initialProject={project}
        onCancel={() => setIsEditing(false)}
        onSubmit={async (fields) => {
          await onSave(fields)
          setIsEditing(false)
          setStatusMessage('Changes saved.')
        }}
        storageUnavailable={storageUnavailable}
      />
    )
  }

  return (
    <div className="project-detail-layout">
      <div className="detail-toolbar">
        <button className="back-link" type="button" onClick={onBack}>
          <ArrowLeft size={18} aria-hidden="true" />
          <span>All projects</span>
        </button>
        <div className="detail-toolbar-actions">
          {sessionsEditable && !isLogging && (
            <button
              ref={logButton}
              className="primary-button log-session-button"
              type="button"
              onClick={() => setIsLogging(true)}
              disabled={storageUnavailable}
            >
              <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
              Log session
            </button>
          )}
          <button
            ref={editButton}
            className="icon-button edit-project-button"
            type="button"
            aria-label="Edit project"
            title="Edit project"
            onClick={() => setIsEditing(true)}
            disabled={storageUnavailable}
          >
            <Pencil size={19} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="detail-columns">
        <section className="project-summary" aria-labelledby="project-title-heading">
          {project.completedAt && (
            <p className="status-badge">
              <CircleCheck size={15} strokeWidth={2.2} aria-hidden="true" />
              Completed {formatCalendarDate(getLocalCalendarDate(project.completedAt))}
            </p>
          )}
          <h1 id="project-title-heading" className="project-title-pill">{project.title}</h1>
          {project.synopsis && <p className="project-synopsis">{project.synopsis}</p>}

          <dl className="project-metadata">
            <div>
              <dt>Date last edited</dt>
              <dd>{formatCalendarDate(getLocalCalendarDate(getLastEditedAt(project, sessions)))}</dd>
            </div>
            <div>
              <dt>Word count</dt>
              <dd>{new Intl.NumberFormat().format(getProjectTotal(project, sessions))}</dd>
            </div>
            {project.deadline && (
              <div>
                <dt>Deadline</dt>
                <dd>{formatCalendarDate(project.deadline)}</dd>
              </div>
            )}
            {project.notes && (
              <div>
                <dt>Notes</dt>
                <dd className="metadata-notes">{project.notes}</dd>
              </div>
            )}
          </dl>

          <div className="project-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() =>
                void (isCompleted
                  ? changeStatus(onReopen, 'Project reopened. It’s back in your active projects.')
                  : changeStatus(async () => {
                      await onComplete()
                      setIsLogging(false)
                    }, 'Project marked complete. It’s now in your completed projects.'))
              }
              disabled={isChangingStatus || storageUnavailable}
            >
              {isCompleted ? 'Reopen project' : 'Mark complete'}
            </button>
            <button
              className="text-button danger-text-button"
              type="button"
              onClick={() => setIsConfirmingDelete(true)}
              disabled={isChangingStatus || storageUnavailable}
            >
              Delete project
            </button>
          </div>
          <p className="visually-hidden" role="status">{statusMessage}</p>
          {statusError && <p className="form-error form-error-summary" role="alert">{statusError}</p>}
        </section>

        <aside className="project-activity-panel" aria-labelledby="project-activity-heading">
          <p className="eyebrow">Recent rhythm</p>
          <h2 id="project-activity-heading">Writing activity</h2>
          <ActivityChart
            points={series}
            variant="detail"
            description={`Daily words for ${project.title}. ${describeSeries(series)}`}
          />
          {sessions.length === 0 && <p className="chart-note">No writing sessions yet</p>}
        </aside>
      </div>

      <SessionHistory
        sessions={sessions}
        today={today}
        canChangeSessions={sessionsEditable}
        readOnlyMessage={
          sessionsEditable ? undefined : 'This project is complete. Reopen it to log, correct, or delete sessions.'
        }
        isLogging={isLogging}
        onLogClose={() => setIsLogging(false)}
        onSessionRemoved={() => logButton.current?.focus()}
        onLog={onLogSession}
        onUpdate={onUpdateSession}
        onDelete={onDeleteSession}
        storageUnavailable={storageUnavailable}
      />

      {isConfirmingDelete && (
        <DeleteProjectDialog
          project={project}
          sessionCount={sessions.length}
          sessionWords={sessions.reduce((total, session) => total + session.wordCount, 0)}
          onCancel={() => setIsConfirmingDelete(false)}
          onConfirm={onDelete}
          storageUnavailable={storageUnavailable}
        />
      )}
    </div>
  )
}