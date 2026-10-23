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

export type ProjectFieldErrors = Partial<Record<keyof ProjectFormValues, string>>

export function validateProjectForm(values: ProjectFormValues): {
  fields: ProjectFields | null
  errors: ProjectFieldErrors
} {
  const errors: ProjectFieldErrors = {}
  const title = values.title.trim()
  const rawStartingCount = values.startingWordCount.trim()
  const startingWordCount = rawStartingCount === '' ? 0 : Number(rawStartingCount)

  if (!title) {
    errors.title = 'Enter a project title.'
  }

  if (
    !Number.isInteger(startingWordCount) ||
    startingWordCount < 0 ||
    startingWordCount > MAX_WORD_COUNT
  ) {
    errors.startingWordCount = `Enter a whole number from 0 to ${MAX_WORD_COUNT.toLocaleString()}.`
  }

  if (values.deadline && !isLocalDate(values.deadline)) {
    errors.deadline = 'Enter a valid deadline.'
  }

  if (Object.keys(errors).length > 0) {
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

export function getLocalCalendarDate(dateTime: string): string {
  const date = new Date(dateTime)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isLocalDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00`)
  return !Number.isNaN(parsed.getTime()) && getLocalCalendarDate(parsed.toISOString()) === value
}