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

  it('returns a user-facing storage error when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const repository = createRepository()

    await expect(repository.listProjects()).rejects.toBeInstanceOf(StorageError)
  })
})