import { isLocalDate } from '../domain/dates'
import { MAX_WORD_COUNT, type Project, type WritingSession } from '../domain/projects'

// Versioned backup format. See docs/backup-format.md.

export const BACKUP_FORMAT = 'wordstead-backup'
export const CURRENT_SCHEMA_VERSION = 1
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024
const MAX_REPORTED_PROBLEMS = 6

export interface Dataset {
  projects: Project[]
  sessions: WritingSession[]
}

export interface BackupFile extends Dataset {
  format: typeof BACKUP_FORMAT
  schemaVersion: typeof CURRENT_SCHEMA_VERSION
  exportedAt: string
}

export type ParseResult = { ok: true; data: Dataset } | { ok: false; problems: string[] }

export function createBackup(data: Dataset, exportedAt = new Date().toISOString()): BackupFile {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt,
    projects: data.projects.map(pickProject),
    sessions: data.sessions.map(pickSession),
  }
}

export function serializeBackup(backup: BackupFile): string {
  return `${JSON.stringify(backup, null, 2)}\n`
}

export function backupFileName(today: string): string {
  return `wordstead-backup-${today}.json`
}

// Upgrades older schema versions one step at a time. Version 1 is the first released format,
// so there are no steps yet; add `{ [n]: (v_n) => v_(n+1) }` entries when the format changes.
const MIGRATIONS: Record<number, (backup: Record<string, unknown>) => Record<string, unknown>> = {}

const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && TIMESTAMP_PATTERN.test(value) && !Number.isNaN(Date.parse(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isWholeNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

function isOptionalText(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function pickProject(project: Project): Project {
  const { id, title, startingWordCount, deadline, synopsis, notes, createdAt, updatedAt, completedAt, deletedAt } =
    project
  return { id, title, startingWordCount, deadline, synopsis, notes, createdAt, updatedAt, completedAt, deletedAt }
}

function pickSession(session: WritingSession): WritingSession {
  const { id, projectId, date, wordCount, createdAt, updatedAt } = session
  return { id, projectId, date, wordCount, createdAt, updatedAt }
}

function validateProject(value: unknown, label: string, problems: string[]): value is Project {
  if (!isRecord(value)) {
    problems.push(`${label} is not a project record.`)
    return false
  }
  const before = problems.length
  const name = typeof value.title === 'string' && value.title.trim() ? `${label} (“${value.title.trim()}”)` : label

  if (typeof value.id !== 'string' || value.id === '') problems.push(`${name} is missing its ID.`)
  if (typeof value.title !== 'string' || value.title.trim() === '') problems.push(`${label} is missing a title.`)
  if (!isWholeNumberInRange(value.startingWordCount, 0, MAX_WORD_COUNT)) {
    problems.push(`${name} has a starting word count that isn’t a whole number from 0 to 1,000,000.`)
  }
  if (value.deadline !== null && !(typeof value.deadline === 'string' && isLocalDate(value.deadline))) {
    problems.push(`${name} has an invalid deadline.`)
  }
  if (!isOptionalText(value.synopsis)) problems.push(`${name} has an invalid synopsis.`)
  if (!isOptionalText(value.notes)) problems.push(`${name} has invalid notes.`)
  for (const field of ['createdAt', 'updatedAt'] as const) {
    if (!isTimestamp(value[field])) problems.push(`${name} has an invalid ${field} timestamp.`)
  }
  for (const field of ['completedAt', 'deletedAt'] as const) {
    if (value[field] !== null && !isTimestamp(value[field])) problems.push(`${name} has an invalid ${field} timestamp.`)
  }
  return problems.length === before
}

function validateSession(value: unknown, label: string, problems: string[]): value is WritingSession {
  if (!isRecord(value)) {
    problems.push(`${label} is not a session record.`)
    return false
  }
  const before = problems.length

  if (typeof value.id !== 'string' || value.id === '') problems.push(`${label} is missing its ID.`)
  if (typeof value.projectId !== 'string' || value.projectId === '') problems.push(`${label} is missing its project ID.`)
  if (!(typeof value.date === 'string' && isLocalDate(value.date))) {
    problems.push(`${label} has an invalid date (expected YYYY-MM-DD).`)
  }
  if (!isWholeNumberInRange(value.wordCount, 1, MAX_WORD_COUNT)) {
    problems.push(`${label} has a word count that isn’t a whole number from 1 to 1,000,000.`)
  }
  for (const field of ['createdAt', 'updatedAt'] as const) {
    if (!isTimestamp(value[field])) problems.push(`${label} has an invalid ${field} timestamp.`)
  }
  return problems.length === before
}

function findDuplicates(ids: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id)
    seen.add(id)
  }
  return [...duplicates]
}

function summarize(problems: string[]): string[] {
  if (problems.length <= MAX_REPORTED_PROBLEMS) return problems
  const hidden = problems.length - (MAX_REPORTED_PROBLEMS - 1)
  return [...problems.slice(0, MAX_REPORTED_PROBLEMS - 1), `…and ${hidden} more problems.`]
}

// Validates everything before any stored data is touched (§5.8 AC 3).
export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, problems: ['This file isn’t valid JSON, so it can’t be a Wordstead backup.'] }
  }

  if (!isRecord(raw) || raw.format !== BACKUP_FORMAT) {
    return { ok: false, problems: ['This file isn’t a Wordstead backup.'] }
  }

  const version = raw.schemaVersion
  if (!Number.isInteger(version) || (version as number) < 1) {
    return { ok: false, problems: ['This backup has a missing or unsupported schema version.'] }
  }
  if ((version as number) > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      problems: [
        `This backup uses schema version ${version}, which is newer than this version of Wordstead supports (${CURRENT_SCHEMA_VERSION}).`,
      ],
    }
  }

  let backup = raw
  for (let step = version as number; step < CURRENT_SCHEMA_VERSION; step += 1) {
    const migrate = MIGRATIONS[step]
    if (!migrate) return { ok: false, problems: [`Backups with schema version ${version} can’t be imported.`] }
    backup = migrate(backup)
  }

  if (!Array.isArray(backup.projects) || !Array.isArray(backup.sessions)) {
    return { ok: false, problems: ['This backup is missing its projects or sessions list.'] }
  }

  const problems: string[] = []
  const projects: Project[] = []
  const sessions: WritingSession[] = []

  backup.projects.forEach((value, index) => {
    if (validateProject(value, `Project ${index + 1}`, problems)) projects.push(pickProject(value))
  })
  backup.sessions.forEach((value, index) => {
    if (validateSession(value, `Session ${index + 1}`, problems)) sessions.push(pickSession(value))
  })

  for (const id of findDuplicates(projects.map((project) => project.id))) {
    problems.push(`More than one project has the ID “${id}”.`)
  }
  for (const id of findDuplicates(sessions.map((session) => session.id))) {
    problems.push(`More than one session has the ID “${id}”.`)
  }

  const projectIds = new Set(projects.map((project) => project.id))
  sessions.forEach((session) => {
    if (!projectIds.has(session.projectId)) {
      problems.push(`Session “${session.id}” belongs to a project that isn’t in this backup.`)
    }
  })

  return problems.length > 0 ? { ok: false, problems: summarize(problems) } : { ok: true, data: { projects, sessions } }
}
