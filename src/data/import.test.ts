import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { updateProject, type WritingSession } from '../domain/projects'
import { updateSession } from '../domain/sessions'
import { sampleDataset } from '../test/backupFixtures'
import { createBackup, parseBackup, serializeBackup, type Dataset } from './backup'
import { WordsteadRepository } from './database'
import { applyMerge, conflictKey, planMerge } from './merge'

function backupText(mutate: (backup: Record<string, unknown> & Dataset) => void = () => undefined): string {
  const backup = JSON.parse(serializeBackup(createBackup(sampleDataset())))
  mutate(backup)
  return JSON.stringify(backup)
}

function expectRejected(text: string, problem: RegExp) {
  const result = parseBackup(text)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.problems.join('\n')).toMatch(problem)
}

const databaseNames: string[] = []

async function seededRepository(): Promise<WordsteadRepository> {
  const name = `wordstead-import-${crypto.randomUUID()}`
  databaseNames.push(name)
  const repository = new WordsteadRepository(name)
  await repository.replaceAll(sampleDataset())
  return repository
}

afterEach(() => {
  for (const name of databaseNames.splice(0)) indexedDB.deleteDatabase(name)
})

describe('parseBackup rejects invalid files', () => {
  it('rejects files that are not JSON or not Wordstead backups', () => {
    expectRejected('not json {', /isn’t valid JSON/)
    expectRejected('[]', /isn’t a Wordstead backup/)
    expectRejected(JSON.stringify({ format: 'something-else', schemaVersion: 1, projects: [], sessions: [] }), /isn’t a Wordstead backup/)
  })

  it('rejects missing, invalid, and newer schema versions', () => {
    expectRejected(backupText((backup) => delete backup.schemaVersion), /missing or unsupported schema version/)
    expectRejected(backupText((backup) => (backup.schemaVersion = 0)), /missing or unsupported schema version/)
    expectRejected(backupText((backup) => (backup.schemaVersion = '1')), /missing or unsupported schema version/)
    expectRejected(backupText((backup) => (backup.schemaVersion = 2)), /schema version 2, which is newer/)
  })

  it('rejects a missing projects or sessions list', () => {
    expectRejected(backupText((backup) => delete (backup as Partial<Dataset>).sessions), /missing its projects or sessions list/)
  })

  it.each([
    ['blank title', (b: Dataset) => (b.projects[0].title = '   '), /Project 1 is missing a title/],
    ['negative starting count', (b: Dataset) => (b.projects[0].startingWordCount = -1), /starting word count/],
    ['over-limit starting count', (b: Dataset) => (b.projects[0].startingWordCount = 1_000_001), /starting word count/],
    ['fractional starting count', (b: Dataset) => (b.projects[0].startingWordCount = 1.5), /starting word count/],
    ['malformed deadline', (b: Dataset) => (b.projects[0].deadline = '2027-02-30'), /invalid deadline/],
    ['malformed timestamp', (b: Dataset) => (b.projects[1].completedAt = 'yesterday'), /invalid completedAt timestamp/],
    ['zero session count', (b: Dataset) => (b.sessions[0].wordCount = 0), /Session 1 has a word count/],
    ['over-limit session count', (b: Dataset) => (b.sessions[0].wordCount = 1_000_001), /Session 1 has a word count/],
    ['string session count', (b: Dataset) => ((b.sessions[0] as unknown as { wordCount: string }).wordCount = '400'), /word count/],
    ['malformed session date', (b: Dataset) => (b.sessions[1].date = '10/21/2026'), /Session 2 has an invalid date/],
    ['UTC timestamp as session date', (b: Dataset) => (b.sessions[1].date = '2026-10-21T00:00:00Z'), /invalid date/],
    ['missing project reference', (b: Dataset) => (b.sessions[2].projectId = 'nowhere'), /belongs to a project that isn’t in this backup/],
    ['missing session ID', (b: Dataset) => (b.sessions[3].id = ''), /Session 4 is missing its ID/],
  ])('rejects %s', (_name, mutate, problem) => {
    expectRejected(backupText((backup) => mutate(backup)), problem)
  })

  it('rejects duplicate project IDs even when the duplicates are identical', () => {
    expectRejected(backupText((backup) => backup.projects.push({ ...backup.projects[0] })), /More than one project has the ID “harbor”/)
  })

  it('rejects duplicate session IDs', () => {
    expectRejected(backupText((backup) => backup.sessions.push({ ...backup.sessions[0], wordCount: 5 })), /More than one session has the ID “s1”/)
  })

  it('summarizes long problem lists', () => {
    const result = parseBackup(
      backupText((backup) => {
        backup.sessions.forEach((session) => (session.wordCount = 0))
        backup.projects.forEach((project) => (project.startingWordCount = -1))
        backup.projects.forEach((project) => (project.deadline = 'soon'))
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.problems).toHaveLength(6)
      expect(result.problems[5]).toBe('…and 5 more problems.')
    }
  })

  it('leaves stored data unchanged when a file is rejected', async () => {
    const repository = await seededRepository()
    const before = await repository.exportData()
    const result = parseBackup(backupText((backup) => (backup.sessions[0].date = 'bad')))
    expect(result.ok).toBe(false)
    // Callers only write after a successful parse, so nothing reaches storage.
    await expect(repository.exportData()).resolves.toEqual(before)
    await repository.close()
  })
})

describe('replace import', () => {
  it('makes the backup the complete dataset, including soft-deleted records', async () => {
    const repository = await seededRepository()
    const backup: Dataset = {
      projects: [sampleDataset().projects[2]],
      sessions: [sampleDataset().sessions[3]],
    }
    await repository.replaceAll(backup)
    await expect(repository.exportData()).resolves.toEqual(backup)
    await repository.close()
  })

  it('is atomic: a failed write leaves the previous data untouched', async () => {
    const repository = await seededRepository()
    const before = await repository.exportData()
    const broken = {
      projects: sampleDataset().projects.slice(0, 1),
      // A record without a key fails partway through the transaction.
      sessions: [sampleDataset().sessions[0], { wordCount: 5 } as unknown as WritingSession],
    }
    await expect(repository.replaceAll(broken)).rejects.toThrow('Wordstead could not import this backup. Your data was not changed.')
    await expect(repository.exportData()).resolves.toEqual(before)
    await repository.close()
  })
})

describe('merge import', () => {
  const existing = sampleDataset()

  it('keeps distinct records from both sides and deduplicates identical ones', () => {
    const incoming: Dataset = {
      projects: [existing.projects[0], { ...existing.projects[0], id: 'new-project', title: 'New Story' }],
      sessions: [existing.sessions[0], { ...existing.sessions[0], id: 'new-session', projectId: 'new-project' }],
    }
    const plan = planMerge(existing, incoming)
    expect(plan).toEqual({ newProjects: 1, newSessions: 1, identical: 2, conflicts: [] })

    const merged = applyMerge(existing, incoming, {})
    expect(merged.projects).toHaveLength(4)
    expect(merged.sessions).toHaveLength(5)
    expect(merged.projects.filter((project) => project.id === 'harbor')).toHaveLength(1)
  })

  it('reports records that share an ID but differ as conflicts', () => {
    const incoming: Dataset = {
      projects: [updateProject(existing.projects[0], { ...existing.projects[0], title: 'Harbor Song (revised)' }, '2026-10-25T16:00:00.000Z')],
      sessions: [updateSession(existing.sessions[0], { wordCount: 450, date: '2026-10-21' }, '2026-10-25T16:00:00.000Z')],
    }
    const plan = planMerge(existing, incoming)
    expect(plan.newProjects).toBe(0)
    expect(plan.conflicts.map((conflict) => conflict.key)).toEqual(['project:harbor', 'session:s1'])
  })

  it('applies the chosen version for each conflict', () => {
    const revisedProject = { ...existing.projects[0], title: 'Harbor Song (revised)' }
    const revisedSession = { ...existing.sessions[0], wordCount: 450 }
    const incoming: Dataset = { projects: [revisedProject], sessions: [revisedSession] }

    const merged = applyMerge(existing, incoming, {
      [conflictKey('project', 'harbor')]: 'incoming',
      [conflictKey('session', 's1')]: 'existing',
    })
    expect(merged.projects.find((project) => project.id === 'harbor')?.title).toBe('Harbor Song (revised)')
    expect(merged.sessions.find((session) => session.id === 's1')?.wordCount).toBe(400)
    expect(merged.projects).toHaveLength(3)
    expect(merged.sessions).toHaveLength(4)
  })

  it('refuses to merge while a conflict is unresolved', () => {
    const incoming: Dataset = { projects: [], sessions: [{ ...existing.sessions[0], wordCount: 450 }] }
    expect(() => applyMerge(existing, incoming, {})).toThrow('Choose which version to keep for session “s1”.')
  })

  it('writes the merged dataset in one transaction', async () => {
    const repository = await seededRepository()
    const incoming: Dataset = {
      projects: [{ ...existing.projects[0], id: 'new-project', title: 'New Story' }],
      sessions: [{ ...existing.sessions[0], id: 'new-session', projectId: 'new-project' }],
    }
    await repository.replaceAll(applyMerge(await repository.exportData(), incoming, {}))
    const stored = await repository.exportData()
    expect(stored.projects).toHaveLength(4)
    expect(stored.sessions).toHaveLength(5)
    await repository.close()
  })
})
