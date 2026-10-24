import { useEffect, useRef, useState } from 'react'
import { BookOpenText } from 'lucide-react'
import { WordsteadRepository } from './data/database'
import { getTodayLocalDate } from './domain/dates'
import {
  createProject,
  sortByLastEdited,
  updateProject,
  type Project,
  type ProjectFields,
  type WritingSession,
} from './domain/projects'
import { createSession, updateSession, type SessionFields } from './domain/sessions'
import { Dashboard } from './features/dashboard/Dashboard'
import { ProjectDetail } from './features/projects/ProjectDetail'
import { ProjectForm } from './features/projects/ProjectForm'
import './App.css'

type Route = { page: 'dashboard' } | { page: 'new' } | { page: 'project'; id: string }

function readRoute(): Route {
  const hash = window.location.hash
  if (hash === '#/new') return { page: 'new' }
  if (hash.startsWith('#/project/')) {
    return { page: 'project', id: decodeURIComponent(hash.slice('#/project/'.length)) }
  }
  return { page: 'dashboard' }
}

function App() {
  const repository = useRef<WordsteadRepository | null>(null)
  const [route, setRoute] = useState<Route>(readRoute)
  const [projects, setProjects] = useState<Project[]>([])
  const [sessions, setSessions] = useState<WritingSession[]>([])
  const [today, setToday] = useState(getTodayLocalDate)
  const [isLoading, setIsLoading] = useState(true)
  const [storageError, setStorageError] = useState<string | null>(null)

  useEffect(() => {
    const store = new WordsteadRepository()
    repository.current = store
    let isCurrent = true

    Promise.all([store.listProjects(), store.listSessions()])
      .then(([savedProjects, savedSessions]) => {
        if (isCurrent) {
          setProjects(savedProjects)
          setSessions(savedSessions)
          setStorageError(null)
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setStorageError(error instanceof Error ? error.message : 'Browser storage is unavailable.')
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
      repository.current = null
      void store.close().catch(() => undefined)
    }
  }, [])

  // Keep "today" current across local midnight so new sessions default correctly.
  useEffect(() => {
    const refreshToday = () => setToday(getTodayLocalDate())
    const timer = window.setInterval(refreshToday, 60_000)
    document.addEventListener('visibilitychange', refreshToday)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshToday)
    }
  }, [])

  useEffect(() => {
    const handleHashChange = () => setRoute(readRoute())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const navigate = (nextRoute: string) => {
    window.location.hash = nextRoute
  }

  const handleCreate = async (fields: ProjectFields) => {
    const project = createProject(fields)
    const store = repository.current
    if (!store) throw new Error('Browser storage is not ready. Your project was not saved.')
    await store.saveProject(project)
    setProjects((current) => [...current, project])
    navigate(`/project/${encodeURIComponent(project.id)}`)
  }

  const handleUpdate = async (project: Project, fields: ProjectFields) => {
    const updatedProject = updateProject(project, fields)
    const store = repository.current
    if (!store) throw new Error('Browser storage is not ready. Your changes were not saved.')
    await store.saveProject(updatedProject)
    setProjects((current) => current.map((item) => (item.id === project.id ? updatedProject : item)))
  }

  const handleLogSession = async (project: Project, fields: SessionFields) => {
    const session = createSession(project.id, fields)
    const store = repository.current
    if (!store) throw new Error('Browser storage is not ready. Your session was not saved.')
    await store.saveSession(session)
    setSessions((current) => [...current, session])
  }

  const handleUpdateSession = async (session: WritingSession, fields: SessionFields) => {
    const updatedSession = updateSession(session, fields)
    const store = repository.current
    if (!store) throw new Error('Browser storage is not ready. Your changes were not saved.')
    await store.saveSession(updatedSession)
    setSessions((current) => current.map((item) => (item.id === session.id ? updatedSession : item)))
  }

  const handleDeleteSession = async (session: WritingSession) => {
    const store = repository.current
    if (!store) throw new Error('Browser storage is not ready. The session was not deleted.')
    await store.deleteSession(session.id)
    setSessions((current) => current.filter((item) => item.id !== session.id))
  }

  const activeProjects = sortByLastEdited(
    projects.filter((project) => !project.deletedAt && !project.completedAt),
    sessions,
  )
  const completedProjects = sortByLastEdited(
    projects.filter((project) => !project.deletedAt && project.completedAt),
    sessions,
  )
  const selectedProject = route.page === 'project'
    ? projects.find((project) => project.id === route.id && !project.deletedAt)
    : undefined

  return (
    <div className="app-frame">
      <header className="brand-header">
        <a className="brand-lockup" href="#/" aria-label="Wordstead dashboard">
          <span className="brand-icon" aria-hidden="true"><BookOpenText size={25} strokeWidth={1.8} /></span>
          <span>Wordstead</span>
        </a>
        <span className="brand-caption">A little progress, often</span>
      </header>

      {storageError && (
        <div className="storage-alert" role="alert">
          <strong>Local storage unavailable.</strong> {storageError} Your existing data has not been changed.
        </div>
      )}

      {isLoading ? (
        <main className="paper loading-paper" aria-live="polite">Opening your desk…</main>
      ) : route.page === 'new' ? (
        <main className="paper form-paper">
          <ProjectForm
            onCancel={() => navigate('/')}
            onSubmit={handleCreate}
            storageUnavailable={Boolean(storageError)}
          />
        </main>
      ) : route.page === 'project' ? (
        <main className="paper detail-paper">
          {selectedProject ? (
            <ProjectDetail
              key={selectedProject.id}
              project={selectedProject}
              sessions={sessions.filter((session) => session.projectId === selectedProject.id)}
              today={today}
              onBack={() => navigate('/')}
              onSave={(fields) => handleUpdate(selectedProject, fields)}
              onLogSession={(fields) => handleLogSession(selectedProject, fields)}
              onUpdateSession={handleUpdateSession}
              onDeleteSession={handleDeleteSession}
              storageUnavailable={Boolean(storageError)}
            />
          ) : (
            <section className="not-found-state">
              <h1>Project not found</h1>
              <button className="text-button" type="button" onClick={() => navigate('/')}>Back to projects</button>
            </section>
          )}
        </main>
      ) : (
        <main className="paper dashboard-paper">
          <Dashboard
            activeProjects={activeProjects}
            completedProjects={completedProjects}
            sessions={sessions}
            today={today}
            onCreate={() => navigate('/new')}
            onOpen={(id) => navigate(`/project/${encodeURIComponent(id)}`)}
            storageUnavailable={Boolean(storageError)}
          />
        </main>
      )}

      <footer className="local-footer">
        <span className="local-indicator" aria-hidden="true" />
        Your writing stays in this browser and isn’t synced to other devices
      </footer>
    </div>
  )
}

export default App