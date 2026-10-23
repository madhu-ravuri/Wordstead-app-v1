import { ArrowUpRight, Plus, Sparkles } from 'lucide-react'
import { getProjectTotal, type Project } from '../../domain/projects'

interface DashboardProps {
  activeProjects: Project[]
  completedProjects: Project[]
  onCreate: () => void
  onOpen: (id: string) => void
  storageUnavailable: boolean
}

function formatCount(count: number): string {
  return new Intl.NumberFormat().format(count)
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function ProjectRow({ project, onOpen }: { project: Project; onOpen: () => void }) {
  return (
    <button className="project-row" type="button" onClick={onOpen}>
      <span className="project-row-copy">
        <span className="project-row-title">{project.title}</span>
        <span className="project-row-date">Edited {formatDate(project.updatedAt)}</span>
      </span>
      <span className="project-row-count">
        <span>{formatCount(getProjectTotal(project))}</span>
        <small>words</small>
      </span>
      <span className="project-row-open" aria-hidden="true"><ArrowUpRight size={18} /></span>
    </button>
  )
}

function EmptyProjectState({ onCreate, storageUnavailable }: Pick<DashboardProps, 'onCreate' | 'storageUnavailable'>) {
  return (
    <div className="empty-project-state">
      <Sparkles className="empty-scribble" size={24} aria-hidden="true" />
      <p>No projects on your desk yet.</p>
      <button className="text-button" type="button" onClick={onCreate} disabled={storageUnavailable}>
        Start a project
      </button>
    </div>
  )
}

export function Dashboard({
  activeProjects,
  completedProjects,
  onCreate,
  onOpen,
  storageUnavailable,
}: DashboardProps) {
  return (
    <div className="dashboard-layout">
      <div className="dashboard-topline">
        <div>
          <p className="eyebrow">Your writing desk</p>
          <h1>In progress</h1>
        </div>
        <button
          className="icon-button create-button"
          type="button"
          aria-label="New project"
          title="New project"
          onClick={onCreate}
          disabled={storageUnavailable}
        >
          <Plus size={24} strokeWidth={2.3} aria-hidden="true" />
        </button>
      </div>

      <div className="dashboard-columns">
        <section className="project-list-column" aria-labelledby="active-projects-heading">
          <div className="section-heading">
            <h2 id="active-projects-heading">Projects</h2>
            <span className="section-count">{activeProjects.length}</span>
          </div>
          {activeProjects.length > 0 ? (
            <div className="project-list">
              {activeProjects.map((project) => (
                <ProjectRow key={project.id} project={project} onOpen={() => onOpen(project.id)} />
              ))}
            </div>
          ) : (
            <EmptyProjectState onCreate={onCreate} storageUnavailable={storageUnavailable} />
          )}

          <section className="completed-section" aria-labelledby="completed-projects-heading">
            <div className="section-heading completed-heading">
              <h2 id="completed-projects-heading">Completed</h2>
              <span className="section-count">{completedProjects.length}</span>
            </div>
            {completedProjects.length > 0 ? (
              <div className="project-list completed-list">
                {completedProjects.map((project) => (
                  <ProjectRow key={project.id} project={project} onOpen={() => onOpen(project.id)} />
                ))}
              </div>
            ) : (
              <p className="quiet-empty">Finished projects will gather here.</p>
            )}
          </section>
        </section>

        <aside className="overall-panel" aria-labelledby="overall-heading">
          <div className="overall-heading">
            <div>
              <p className="eyebrow">Across every story</p>
              <h2 id="overall-heading">Daily words</h2>
            </div>
            <span className="chart-caption">Overall</span>
          </div>
          <div className="overall-chart-empty" role="img" aria-label="No writing sessions recorded yet">
            <div className="chart-grid" aria-hidden="true">
              <span /><span /><span /><span />
            </div>
            <p>No writing sessions yet</p>
          </div>
        </aside>
      </div>
    </div>
  )
}