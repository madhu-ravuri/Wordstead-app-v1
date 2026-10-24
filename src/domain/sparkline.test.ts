import { describe, expect, it } from 'vitest'
import { createProject } from './projects'
import { createSession } from './sessions'
import {
  describeSeries,
  getOverallChartRange,
  getOverallSeries,
  getProjectChartRange,
  getProjectSeries,
} from './sparkline'

const today = '2026-10-23'

function localNoon(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, 12).toISOString()
}

function projectCreatedOn(date: string, id = 'p1') {
  return createProject(
    { title: 'Draft', startingWordCount: 900, deadline: null, synopsis: null, notes: null },
    id,
    localNoon(date),
  )
}

describe('project chart range', () => {
  it('shows today and the previous six days for a project at least seven days old', () => {
    const project = projectCreatedOn('2026-10-16')
    const oldSession = createSession('p1', { wordCount: 50, date: '2026-10-01' })
    expect(getProjectChartRange(project, [oldSession], today)).toEqual({ start: '2026-10-17', end: today })
    expect(getProjectSeries(project, [oldSession], today)).toHaveLength(7)
  })

  it('starts a young project at its creation date', () => {
    expect(getProjectChartRange(projectCreatedOn('2026-10-21'), [], today)).toEqual({ start: '2026-10-21', end: today })
    expect(getProjectSeries(projectCreatedOn(today), [], today)).toEqual([
      { date: today, words: 0, sessionCount: 0, hasActivity: false },
    ])
  })

  it('starts a young project at a backdated session within the seven-day window', () => {
    const project = projectCreatedOn('2026-10-22')
    const sessions = [createSession('p1', { wordCount: 50, date: '2026-10-19' })]
    expect(getProjectChartRange(project, sessions, today)).toEqual({ start: '2026-10-19', end: today })
    expect(getProjectSeries(project, sessions, today)).toHaveLength(5)
  })

  it('caps a young project at seven days when a backdated session is older', () => {
    const project = projectCreatedOn('2026-10-21')
    const sessions = [
      createSession('p1', { wordCount: 50, date: '2026-10-02' }),
      createSession('other', { wordCount: 50, date: '2026-09-01' }),
    ]
    expect(getProjectChartRange(project, sessions, today)).toEqual({ start: '2026-10-17', end: today })
    const series = getProjectSeries(project, sessions, today)
    expect(series).toHaveLength(7)
    expect(series.some((point) => point.hasActivity)).toBe(false)
  })

  it('zero-fills days and marks each active day once, however many sessions it has', () => {
    const project = projectCreatedOn('2026-10-01')
    const sessions = [
      createSession('p1', { wordCount: 100, date: '2026-10-19' }),
      createSession('p1', { wordCount: 150, date: '2026-10-19' }),
      createSession('p1', { wordCount: 40, date: today }),
      createSession('other', { wordCount: 999, date: '2026-10-20' }),
    ]
    expect(getProjectSeries(project, sessions, today)).toEqual([
      { date: '2026-10-17', words: 0, sessionCount: 0, hasActivity: false },
      { date: '2026-10-18', words: 0, sessionCount: 0, hasActivity: false },
      { date: '2026-10-19', words: 250, sessionCount: 2, hasActivity: true },
      { date: '2026-10-20', words: 0, sessionCount: 0, hasActivity: false },
      { date: '2026-10-21', words: 0, sessionCount: 0, hasActivity: false },
      { date: '2026-10-22', words: 0, sessionCount: 0, hasActivity: false },
      { date: today, words: 40, sessionCount: 1, hasActivity: true },
    ])
  })
})

describe('overall chart range', () => {
  it('has no range (empty state) when there are no sessions', () => {
    expect(getOverallChartRange([], today)).toBeNull()
    expect(getOverallSeries([], today)).toBeNull()
  })

  it('starts at the earliest session when it is within the last 30 days', () => {
    const sessions = [
      createSession('p1', { wordCount: 10, date: '2026-10-20' }),
      createSession('p2', { wordCount: 10, date: '2026-10-11' }),
    ]
    expect(getOverallChartRange(sessions, today)).toEqual({ start: '2026-10-11', end: today })
    expect(getOverallSeries(sessions, today)).toHaveLength(13)
  })

  it('shows today and the previous 29 days when activity is older', () => {
    const sessions = [createSession('p1', { wordCount: 10, date: '2026-08-01' })]
    expect(getOverallChartRange(sessions, today)).toEqual({ start: '2026-09-24', end: today })
    const series = getOverallSeries(sessions, today)
    expect(series).toHaveLength(30)
    expect(series?.every((point) => point.words === 0)).toBe(true)
  })

  it('sums across projects on the same date', () => {
    const sessions = [
      createSession('p1', { wordCount: 10, date: today }),
      createSession('p2', { wordCount: 32, date: today }),
    ]
    expect(getOverallSeries(sessions, today)).toEqual([
      { date: today, words: 42, sessionCount: 2, hasActivity: true },
    ])
  })
})

describe('describeSeries', () => {
  it('summarizes activity in plain language', () => {
    const project = projectCreatedOn('2026-10-01')
    const sessions = [
      createSession('p1', { wordCount: 1200, date: '2026-10-19' }),
      createSession('p1', { wordCount: 300, date: '2026-10-21' }),
    ]
    const summary = describeSeries(getProjectSeries(project, sessions, today))
    expect(summary).toMatch(/^1,500 words written from .+ to .+, on 2 of 7 days\./)
    expect(summary).toMatch(/Most in one day: 1,200 words on /)
  })

  it('states when a range has no sessions', () => {
    expect(describeSeries(getProjectSeries(projectCreatedOn('2026-10-01'), [], today))).toMatch(/^No writing sessions from /)
  })
})
