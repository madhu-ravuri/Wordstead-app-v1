import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Project, WritingSession } from '../domain/projects'

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