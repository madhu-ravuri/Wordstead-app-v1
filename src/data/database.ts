import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Project, WritingSession } from '../domain/projects'
import type { Dataset } from './backup'

export const DATABASE_NAME = 'wordstead'
export const DATABASE_VERSION = 1

interface WordsteadDatabase extends DBSchema {
  projects: {
    key: string
    value: Project
    indexes: { 'by-updated-at': string }
  }
  sessions: {
    key: string
    value: WritingSession
    indexes: { 'by-project-id': string; 'by-date': string }
  }
}

export class StorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'StorageError'
  }
}

export class WordsteadRepository {
  private readonly database: Promise<IDBPDatabase<WordsteadDatabase>>

  constructor(databaseName = DATABASE_NAME) {
    this.database = Promise.resolve()
      .then(() =>
        openDB<WordsteadDatabase>(databaseName, DATABASE_VERSION, {
          upgrade(database) {
            const projects = database.createObjectStore('projects', { keyPath: 'id' })
            projects.createIndex('by-updated-at', 'updatedAt')

            const sessions = database.createObjectStore('sessions', { keyPath: 'id' })
            sessions.createIndex('by-project-id', 'projectId')
            sessions.createIndex('by-date', 'date')
          },
        }),
      )
      .catch((error: unknown) => {
        throw new StorageError('Wordstead could not open browser storage.', { cause: error })
      })
  }

  async listProjects(): Promise<Project[]> {
    return this.withStorageErrors('load projects', async () => {
      const database = await this.database
      return database.getAll('projects')
    })
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.withStorageErrors('load this project', async () => {
      const database = await this.database
      return database.get('projects', id)
    })
  }

  async saveProject(project: Project): Promise<void> {
    await this.withStorageErrors('save this project', async () => {
      const database = await this.database
      await database.put('projects', project)
    })
  }

  async listSessions(): Promise<WritingSession[]> {
    return this.withStorageErrors('load writing sessions', async () => {
      const database = await this.database
      return database.getAll('sessions')
    })
  }

  async saveSession(session: WritingSession): Promise<void> {
    await this.withStorageErrors('save this session', async () => {
      const database = await this.database
      await database.put('sessions', session)
    })
  }

  async deleteSession(id: string): Promise<void> {
    await this.withStorageErrors('delete this session', async () => {
      const database = await this.database
      await database.delete('sessions', id)
    })
  }

  async exportData(): Promise<Dataset> {
    return this.withStorageErrors('read your data for export', async () => {
      const database = await this.database
      const transaction = database.transaction(['projects', 'sessions'])
      const [projects, sessions] = await Promise.all([
        transaction.objectStore('projects').getAll(),
        transaction.objectStore('sessions').getAll(),
        transaction.done,
      ])
      return { projects, sessions }
    })
  }

  // One transaction: either the whole dataset is written or nothing changes (§5.8 AC 7).
  async replaceAll(data: Dataset): Promise<void> {
    await this.withStorageErrors('import this backup', async () => {
      const database = await this.database
      const transaction = database.transaction(['projects', 'sessions'], 'readwrite')
      const projects = transaction.objectStore('projects')
      const sessions = transaction.objectStore('sessions')
      // Individual request failures surface through `transaction.done`; once one fails the rest
      // are aborted, so mark each handled to avoid unhandled rejections.
      const track = (request: Promise<unknown>) => void request.catch(() => undefined)
      try {
        track(projects.clear())
        track(sessions.clear())
        for (const project of data.projects) track(projects.put(project))
        for (const session of data.sessions) track(sessions.put(session))
        await transaction.done
      } catch (error) {
        // A failed request aborts the transaction; make sure it never commits partially.
        try {
          transaction.abort()
        } catch {
          // Already aborted.
        }
        await transaction.done.catch(() => undefined)
        throw error
      }
    })
  }

  async close(): Promise<void> {
    return this.withStorageErrors('close browser storage', async () => {
      const database = await this.database
      database.close()
    })
  }

  private async withStorageErrors<T>(
    operation: string,
    action: () => Promise<T>,
  ): Promise<T> {
    try {
      return await action()
    } catch (error) {
      if (error instanceof StorageError) {
        throw error
      }

      throw new StorageError(`Wordstead could not ${operation}. Your data was not changed.`, {
        cause: error,
      })
    }
  }
}