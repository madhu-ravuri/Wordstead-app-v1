import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StorageError, WordsteadRepository } from './database'

const databaseNames: string[] = []

function createRepository(): WordsteadRepository {
  const name = `wordstead-test-${crypto.randomUUID()}`
  databaseNames.push(name)
  return new WordsteadRepository(name)
}

afterEach(() => {
  vi.unstubAllGlobals()
  for (const name of databaseNames.splice(0)) {
    indexedDB.deleteDatabase(name)
  }
})

describe('WordsteadRepository', () => {
  it('initializes empty project and session stores', async () => {
    const repository = createRepository()

    await expect(repository.listProjects()).resolves.toEqual([])
    await repository.close()
  })

  it('persists projects after the database is reopened', async () => {
    const firstRepository = createRepository()
    const project = {
      id: 'project-1',
      title: 'Persisted draft',
      startingWordCount: 42,
      deadline: null,
      synopsis: null,
      notes: null,
      createdAt: '2026-10-23T12:00:00.000Z',
      updatedAt: '2026-10-23T12:00:00.000Z',
      completedAt: null,
      deletedAt: null,
    }

    await firstRepository.saveProject(project)
    await firstRepository.close()

    const reopenedRepository = new WordsteadRepository(
      databaseNames[databaseNames.length - 1],
    )

    await expect(reopenedRepository.getProject(project.id)).resolves.toEqual(project)
    await reopenedRepository.close()
  })

  it('saves, corrects, and deletes individual sessions across reopen', async () => {
    const repository = createRepository()
    const session = {
      id: 'session-1',
      projectId: 'project-1',
      date: '2026-10-20',
      wordCount: 500,
      createdAt: '2026-10-23T12:00:00.000Z',
      updatedAt: '2026-10-23T12:00:00.000Z',
    }
    const sameDay = { ...session, id: 'session-2', wordCount: 250 }

    await expect(repository.listSessions()).resolves.toEqual([])
    await repository.saveSession(session)
    await repository.saveSession(sameDay)
    await repository.saveSession({ ...session, wordCount: 550, updatedAt: '2026-10-24T08:00:00.000Z' })
    await repository.close()

    const reopened = new WordsteadRepository(databaseNames[databaseNames.length - 1])
    const stored = await reopened.listSessions()
    expect(stored).toHaveLength(2)
    expect(stored.find((item) => item.id === 'session-1')).toMatchObject({ wordCount: 550, date: '2026-10-20' })

    await reopened.deleteSession('session-1')
    await expect(reopened.listSessions()).resolves.toEqual([sameDay])
    await reopened.close()
  })

  it('reports a failed session write without claiming success', async () => {
    const repository = createRepository()
    await repository.listSessions()
    await expect(
      repository.saveSession({ id: undefined } as unknown as Parameters<WordsteadRepository['saveSession']>[0]),
    ).rejects.toThrow('Wordstead could not save this session. Your data was not changed.')
    await expect(repository.listSessions()).resolves.toEqual([])
    await repository.close()
  })

  it('returns a user-facing storage error when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const repository = createRepository()

    await expect(repository.listProjects()).rejects.toBeInstanceOf(StorageError)
  })
})