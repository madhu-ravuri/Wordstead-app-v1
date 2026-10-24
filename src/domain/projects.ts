import { isLocalDate } from './dates'

export const MAX_WORD_COUNT = 1_000_000

export type ProjectStatus = 'active' | 'completed' | 'deleted'

export interface Project {
  id: string
  title: string
  startingWordCount: number
  deadline: string | null
  synopsis: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  deletedAt: string | null
}

export interface WritingSession {
  id: string
  projectId: string
  date: string
  wordCount: number
  createdAt: string
  updatedAt: string
}

export interface ProjectFormValues {
  title: string
  startingWordCount: string
  deadline: string
  synopsis: string
  notes: string
}

export interface ProjectFields {
  title: string
  startingWordCount: number
  deadline: string | null
  synopsis: string | null
  notes: string | null
}

// Digits only: rejects signs, decimals, exponents, and hex that Number() would accept.
export function parseWholeNumber(value: string): number | null {
  const trimmed = value.trim()
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null
}

export type ProjectFieldErrors = Partial<Record<keyof ProjectFormValues, string>>

export function validateProjectForm(values: ProjectFormValues): {
  fields: ProjectFields | null
  errors: ProjectFieldErrors
} {
  const errors: ProjectFieldErrors = {}
  const title = values.title.trim()
  const rawStartingCount = values.startingWordCount.trim()
  const startingWordCount = rawStartingCount === '' ? 0 : parseWholeNumber(rawStartingCount)

  if (!title) {
    errors.title = 'Enter a project title.'
  }

  if (
    startingWordCount === null ||
    startingWordCount < 0 ||
    startingWordCount > MAX_WORD_COUNT
  ) {
    errors.startingWordCount = `Enter a whole number from 0 to ${MAX_WORD_COUNT.toLocaleString()}.`
  }

  if (values.deadline && !isLocalDate(values.deadline)) {
    errors.deadline = 'Enter a valid deadline.'
  }

  if (startingWordCount === null || Object.keys(errors).length > 0) {
    return { fields: null, errors }
  }

  return {
    fields: {
      title,
      startingWordCount,
      deadline: values.deadline || null,
      synopsis: values.synopsis === '' ? null : values.synopsis,
      notes: values.notes === '' ? null : values.notes,
    },
    errors,
  }
}

export function createProject(
  fields: ProjectFields,
  id: string = crypto.randomUUID(),
  now = new Date().toISOString(),
): Project {
  return {
    id,
    ...fields,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    deletedAt: null,
  }
}

export function updateProject(
  project: Project,
  fields: ProjectFields,
  now = new Date().toISOString(),
): Project {
  return {
    ...project,
    ...fields,
    updatedAt: now,
  }
}

export function getProjectTotal(
  project: Project,
  sessions: readonly WritingSession[] = [],
): number {
  return (
    project.startingWordCount +
    sessions.reduce(
      (total, session) =>
        session.projectId === project.id ? total + session.wordCount : total,
      0,
    )
  )
}

// Latest project-field/status edit or session log time (§4 "date last edited").
export function getLastEditedAt(
  project: Project,
  sessions: readonly WritingSession[] = [],
): string {
  return sessions.reduce(
    (latest, session) =>
      session.projectId === project.id && session.createdAt > latest ? session.createdAt : latest,
    project.updatedAt,
  )
}

export function sortByLastEdited(
  projects: readonly Project[],
  sessions: readonly WritingSession[] = [],
): Project[] {
  return [...projects].sort(
    (a, b) =>
      getLastEditedAt(b, sessions).localeCompare(getLastEditedAt(a, sessions)) ||
      b.createdAt.localeCompare(a.createdAt) ||
      a.id.localeCompare(b.id),
  )
}
