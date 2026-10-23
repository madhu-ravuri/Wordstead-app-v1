import { useState } from 'react'
import { ArrowLeft, Pencil } from 'lucide-react'
import { getLocalCalendarDate, getProjectTotal, type Project, type ProjectFields } from '../../domain/projects'
import { ProjectForm } from './ProjectForm'

interface ProjectDetailProps {
  project: Project
  onBack: () => void
  onSave: (fields: ProjectFields) => Promise<void>
  storageUnavailable: boolean
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function formatEditedDate(dateTime: string): string {
  return formatDate(getLocalCalendarDate(dateTime))
}

export function ProjectDetail({
  project,
  onBack,
  onSave,
  storageUnavailable,
}: ProjectDetailProps) {
  const [isEditing, setIsEditing] = useState(false)

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
              <dd>{formatEditedDate(project.updatedAt)}</dd>
            </div>
            <div>
              <dt>Word count</dt>
              <dd>{new Intl.NumberFormat().format(getProjectTotal(project))}</dd>
            </div>
            {project.deadline && (
              <div>
                <dt>Deadline</dt>
                <dd>{formatDate(project.deadline)}</dd>
              </div>
            )}
          </dl>

          {project.notes && (
            <section className="notes-block" aria-labelledby="project-notes-heading">
              <h2 id="project-notes-heading">Notes</h2>
              <p>{project.notes}</p>
            </section>
          )}
        </section>

        <aside className="project-activity-panel" aria-labelledby="project-activity-heading">
          <p className="eyebrow">Recent rhythm</p>
          <h2 id="project-activity-heading">Writing activity</h2>
          <div className="project-chart-empty" role="img" aria-label="No writing sessions recorded for this project">
            <span className="chart-baseline" aria-hidden="true" />
            <p>No writing sessions yet</p>
          </div>
        </aside>
      </div>

      <section className="session-history-empty" aria-labelledby="session-history-heading">
        <div>
          <p className="eyebrow">The pages so far</p>
          <h2 id="session-history-heading">Writing sessions</h2>
        </div>
        <p>No sessions recorded</p>
      </section>
    </div>
  )
}