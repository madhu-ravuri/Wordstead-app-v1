import { sortByLastEdited, type Project, type WritingSession } from './projects'

export type ProjectStatus = 'active' | 'completed' | 'deleted'

export function getProjectStatus(project: Project): ProjectStatus {
  if (project.deletedAt) return 'deleted'
  return project.completedAt ? 'completed' : 'active'
}

// Only active projects accept new, corrected, or deleted sessions; completed ones must be reopened.
export function canChangeSessions(project: Project): boolean {
  return getProjectStatus(project) === 'active'
}

// Status changes count as project edits (§4 `updatedAt`), but never create session activity.

export function completeProject(project: Project, now = new Date().toISOString()): Project {
  if (getProjectStatus(project) !== 'active') {
    throw new Error('Only an active project can be marked complete.')
  }
  return { ...project, completedAt: now, updatedAt: now }
}

export function reopenProject(project: Project, now = new Date().toISOString()): Project {
  if (getProjectStatus(project) !== 'completed') {
    throw new Error('Only a completed project can be reopened.')
  }
  return { ...project, completedAt: null, updatedAt: now }
}

// Soft deletion keeps the record (and, separately, its sessions) so overall history is unchanged.
export function softDeleteProject(project: Project, now = new Date().toISOString()): Project {
  if (getProjectStatus(project) === 'deleted') {
    throw new Error('This project has already been deleted.')
  }
  return { ...project, deletedAt: now, updatedAt: now }
}

// Lists shown on the dashboard: soft-deleted projects appear in neither (§5.6 AC 6).
export function getVisibleProjects(
  projects: readonly Project[],
  sessions: readonly WritingSession[] = [],
): { active: Project[]; completed: Project[] } {
  return {
    active: sortByLastEdited(projects.filter((project) => getProjectStatus(project) === 'active'), sessions),
    completed: sortByLastEdited(projects.filter((project) => getProjectStatus(project) === 'completed'), sessions),
  }
}
