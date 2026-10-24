import { useState } from 'react'
import { ArrowLeft, Pencil } from 'lucide-react'
import { formatCalendarDate, getLocalCalendarDate } from '../../domain/dates'
import {
  getLastEditedAt,
  getProjectTotal,
  type Project,
  type ProjectFields,
  type WritingSession,
} from '../../domain/projects'
import type { SessionFields } from '../../domain/sessions'
import { describeSeries, getProjectSeries } from '../../domain/sparkline'
import { ActivityChart } from '../charts/ActivityChart'
import { SessionHistory } from '../sessions/SessionHistory'
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
  storageUnavailable,
}: ProjectDetailProps) {
  const [isEditing, setIsEditing] = useState(false)
  const series = getProjectSeries(project, sessions, today)

  if (isEditing) {
    return (
      <ProjectForm
        initialProject={project}
        onCancel={() => setIsEditing(false)}
        onSubmit={async (fields) => {
          await onSave(fields)
          setIsEditing(false)
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
        <button
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

      <div className="detail-columns">
        <section className="project-summary" aria-labelledby="project-title-heading">
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
        canLog={!project.completedAt}
        onLog={onLogSession}
        onUpdate={onUpdateSession}
        onDelete={onDeleteSession}
        storageUnavailable={storageUnavailable}
      />
    </div>
  )
}