import type { Project, WritingSession } from '../domain/projects'
import type { Dataset } from './backup'

// Merge rules (§5.8 AC 6): distinct IDs are kept, identical records deduplicate, and records that
// share an ID but differ are conflicts the user resolves before anything is written.

export type Conflict =
  | { key: string; kind: 'project'; existing: Project; incoming: Project }
  | { key: string; kind: 'session'; existing: WritingSession; incoming: WritingSession }

export type Resolution = 'existing' | 'incoming'

export interface MergePlan {
  newProjects: number
  newSessions: number
  identical: number
  conflicts: Conflict[]
}

export function conflictKey(kind: Conflict['kind'], id: string): string {
  return `${kind}:${id}`
}

function sameRecord<T extends object>(a: T, b: T): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof T>
  return [...keys].every((key) => a[key] === b[key])
}

function compare<T extends { id: string }>(existing: readonly T[], incoming: readonly T[]) {
  const byId = new Map(existing.map((record) => [record.id, record]))
  const added: T[] = []
  const conflicting: { existing: T; incoming: T }[] = []
  let identical = 0
  for (const record of incoming) {
    const match = byId.get(record.id)
    if (!match) added.push(record)
    else if (sameRecord(match, record)) identical += 1
    else conflicting.push({ existing: match, incoming: record })
  }
  return { added, conflicting, identical }
}

export function planMerge(existing: Dataset, incoming: Dataset): MergePlan {
  const projects = compare(existing.projects, incoming.projects)
  const sessions = compare(existing.sessions, incoming.sessions)
  return {
    newProjects: projects.added.length,
    newSessions: sessions.added.length,
    identical: projects.identical + sessions.identical,
    conflicts: [
      ...projects.conflicting.map(
        (pair): Conflict => ({ key: conflictKey('project', pair.existing.id), kind: 'project', ...pair }),
      ),
      ...sessions.conflicting.map(
        (pair): Conflict => ({ key: conflictKey('session', pair.existing.id), kind: 'session', ...pair }),
      ),
    ],
  }
}

function mergeRecords<T extends { id: string }>(
  kind: Conflict['kind'],
  existing: readonly T[],
  incoming: readonly T[],
  resolutions: Record<string, Resolution>,
): T[] {
  const merged = new Map(existing.map((record) => [record.id, record]))
  for (const record of incoming) {
    const current = merged.get(record.id)
    if (!current || sameRecord(current, record)) {
      merged.set(record.id, record)
      continue
    }
    const resolution = resolutions[conflictKey(kind, record.id)]
    if (!resolution) throw new Error(`Choose which version to keep for ${kind} “${record.id}”.`)
    if (resolution === 'incoming') merged.set(record.id, record)
  }
  return [...merged.values()]
}

export function applyMerge(existing: Dataset, incoming: Dataset, resolutions: Record<string, Resolution>): Dataset {
  return {
    projects: mergeRecords('project', existing.projects, incoming.projects, resolutions),
    sessions: mergeRecords('session', existing.sessions, incoming.sessions, resolutions),
  }
}
