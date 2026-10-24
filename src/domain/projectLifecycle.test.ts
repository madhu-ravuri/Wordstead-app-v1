import { describe, expect, it } from 'vitest'
import {
  canChangeSessions,
  completeProject,
  getProjectStatus,
  getVisibleProjects,
  reopenProject,
  softDeleteProject,
} from './projectLifecycle'
import { createProject, getProjectTotal } from './projects'
import { createSession } from './sessions'
import { getOverallSeries, getProjectSeries } from './sparkline'

const today = '2026-10-23'

function localNoon(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, 12).toISOString()
}

function project(id: string, title = id) {
  return createProject(
    { title, startingWordCount: 1000, deadline: null, synopsis: null, notes: null },
    id,
    localNoon('2026-10-01'),
  )
}

const sessions = [
  createSession('novel', { wordCount: 400, date: '2026-10-21' }, 's1', localNoon('2026-10-21')),
  createSession('novel', { wordCount: 100, date: '2026-10-23' }, 's2', localNoon('2026-10-23')),
  createSession('essay', { wordCount: 60, date: '2026-10-21' }, 's3', localNoon('2026-10-21')),
]

describe('project status transitions', () => {
  it('completes and reopens without touching totals or chart activity', () => {
    const active = project('novel')
    const completed = completeProject(active, '2026-10-23T18:00:00.000Z')
    const reopened = reopenProject(completed, '2026-10-24T18:00:00.000Z')

    expect(getProjectStatus(active)).toBe('active')
    expect(getProjectStatus(completed)).toBe('completed')
    expect(completed).toMatchObject({ completedAt: '2026-10-23T18:00:00.000Z', updatedAt: '2026-10-23T18:00:00.000Z' })
    expect(getProjectStatus(reopened)).toBe('active')
    expect(reopened).toMatchObject({ completedAt: null, updatedAt: '2026-10-24T18:00:00.000Z' })

    for (const version of [completed, reopened]) {
      expect(getProjectTotal(version, sessions)).toBe(getProjectTotal(active, sessions))
      expect(getProjectSeries(version, sessions, today)).toEqual(getProjectSeries(active, sessions, today))
    }
  })

  it('rejects transitions that do not apply to the current state', () => {
    const active = project('novel')
    const completed = completeProject(active)
    const deleted = softDeleteProject(active)

    expect(() => reopenProject(active)).toThrow('Only a completed project can be reopened.')
    expect(() => completeProject(completed)).toThrow('Only an active project can be marked complete.')
    expect(() => completeProject(deleted)).toThrow('Only an active project can be marked complete.')
    expect(() => softDeleteProject(deleted)).toThrow('This project has already been deleted.')
  })

  it('soft-deletes active or completed projects and keeps every other field', () => {
    const active = project('novel')
    const deleted = softDeleteProject(active, '2026-10-23T18:00:00.000Z')
    expect(deleted).toEqual({ ...active, deletedAt: '2026-10-23T18:00:00.000Z', updatedAt: '2026-10-23T18:00:00.000Z' })

    const deletedAfterCompletion = softDeleteProject(completeProject(active))
    expect(getProjectStatus(deletedAfterCompletion)).toBe('deleted')
    expect(deletedAfterCompletion.completedAt).not.toBeNull()
  })
})

describe('session editability', () => {
  it('allows session changes only while a project is active', () => {
    const active = project('novel')
    expect(canChangeSessions(active)).toBe(true)
    expect(canChangeSessions(completeProject(active))).toBe(false)
    expect(canChangeSessions(reopenProject(completeProject(active)))).toBe(true)
    expect(canChangeSessions(softDeleteProject(active))).toBe(false)
  })
})

describe('visible project lists', () => {
  it('splits active and completed projects and hides soft-deleted ones from both', () => {
    const novel = project('novel', 'Novel')
    const essay = completeProject(project('essay', 'Essay'))
    const poems = softDeleteProject(project('poems', 'Poems'))
    const finishedThenDeleted = softDeleteProject(completeProject(project('memoir', 'Memoir')))

    const visible = getVisibleProjects([novel, essay, poems, finishedThenDeleted])
    expect(visible.active.map((item) => item.id)).toEqual(['novel'])
    expect(visible.completed.map((item) => item.id)).toEqual(['essay'])
  })
})

describe('overall activity across the project lifecycle', () => {
  it('keeps completed and soft-deleted project sessions in the overall chart', () => {
    const before = getOverallSeries(sessions, today)
    // Status lives on project records; the overall series reads every stored session,
    // so completing or deleting a project cannot change it.
    expect(before?.find((point) => point.date === '2026-10-21')?.words).toBe(460)
    expect(before?.find((point) => point.date === '2026-10-23')?.words).toBe(100)

    const deletedNovel = softDeleteProject(project('novel'))
    const completedEssay = completeProject(project('essay'))
    expect(getProjectTotal(completedEssay, sessions)).toBe(1060)
    expect(getProjectTotal(deletedNovel, sessions)).toBe(1500)
    expect(getOverallSeries(sessions, today)).toEqual(before)
  })
})
