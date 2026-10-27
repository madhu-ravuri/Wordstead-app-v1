import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '../domain/projects'
import { sampleDataset } from '../test/backupFixtures'
import {
  BACKUP_FORMAT,
  CURRENT_SCHEMA_VERSION,
  backupFileName,
  createBackup,
  parseBackup,
  serializeBackup,
} from './backup'
import { WordsteadRepository } from './database'

const databaseNames: string[] = []

afterEach(() => {
  vi.unstubAllEnvs()
  for (const name of databaseNames.splice(0)) indexedDB.deleteDatabase(name)
})

describe('createBackup', () => {
  it('writes a versioned file with every project and session, including completed and deleted ones', () => {
    const backup = createBackup(sampleDataset(), '2026-10-26T17:00:00.000Z')

    expect(backup.format).toBe(BACKUP_FORMAT)
    expect(backup.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(backup.exportedAt).toBe('2026-10-26T17:00:00.000Z')
    expect(backup.projects.map((project) => project.id)).toEqual(['harbor', 'orchard', 'lighthouse'])
    expect(backup.projects[1].completedAt).toBe('2026-10-20T16:00:00.000Z')
    expect(backup.projects[2].deletedAt).toBe('2026-10-22T16:00:00.000Z')
    expect(backup.sessions).toHaveLength(4)
  })

  it('keeps only known fields', () => {
    const data = sampleDataset()
    ;(data.projects[0] as Project & { extra?: string }).extra = 'not exported'
    expect(createBackup(data).projects[0]).not.toHaveProperty('extra')
  })

  it('names the file with the local date', () => {
    expect(backupFileName('2026-10-26')).toBe('wordstead-backup-2026-10-26.json')
  })
})

describe('backup round trip', () => {
  it('restores identical records, optional fields, IDs, and date-only values', () => {
    const data = sampleDataset()
    const result = parseBackup(serializeBackup(createBackup(data)))
    expect(result).toEqual({ ok: true, data })
  })

  it.each(['Pacific/Kiritimati', 'America/Los_Angeles', 'Asia/Tokyo', 'America/Santiago'])(
    'never reinterprets session dates through UTC (%s)',
    (timeZone) => {
      vi.stubEnv('TZ', timeZone)
      const text = serializeBackup(createBackup(sampleDataset()))
      const result = parseBackup(text)
      expect(result.ok && result.data.sessions.map((session) => session.date)).toEqual([
        '2026-10-21',
        '2026-10-21',
        '2026-03-08',
        '2026-11-01',
      ])
      expect(text).toContain('"date": "2026-11-01"')
    },
  )

  it('round-trips through browser storage export and atomic replace', async () => {
    const name = `wordstead-backup-${crypto.randomUUID()}`
    databaseNames.push(name)
    const source = new WordsteadRepository(name)
    for (const project of sampleDataset().projects) await source.saveProject(project)
    for (const session of sampleDataset().sessions) await source.saveSession(session)

    const text = serializeBackup(createBackup(await source.exportData()))
    await source.replaceAll({ projects: [], sessions: [] })
    await expect(source.exportData()).resolves.toEqual({ projects: [], sessions: [] })

    const parsed = parseBackup(text)
    if (!parsed.ok) throw new Error(parsed.problems.join(' '))
    await source.replaceAll(parsed.data)
    const restored = await source.exportData()
    const byId = <T extends { id: string }>(records: T[]) => [...records].sort((a, b) => a.id.localeCompare(b.id))
    expect(byId(restored.projects)).toEqual(byId(sampleDataset().projects))
    expect(byId(restored.sessions)).toEqual(byId(sampleDataset().sessions))
    await source.close()
  })
})
