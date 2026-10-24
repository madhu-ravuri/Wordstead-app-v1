import { describe, expect, it } from 'vitest'
import { createProject, getProjectTotal, type WritingSession } from './projects'
import { createSession, updateSession } from './sessions'
import { getOverallSeries, getProjectSeries } from './sparkline'

const today = '2026-10-23'

function localNoon(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, 12).toISOString()
}

const fields = { deadline: null, synopsis: null, notes: null }
const novel = createProject({ ...fields, title: 'Novel', startingWordCount: 5000 }, 'novel', localNoon('2026-10-01'))
const essay = createProject({ ...fields, title: 'Essay', startingWordCount: 0 }, 'essay', localNoon('2026-10-01'))

function wordsByDate(points: { date: string; words: number }[]): Record<string, number> {
  return Object.fromEntries(points.filter((point) => point.words > 0).map((point) => [point.date, point.words]))
}

function snapshot(sessions: WritingSession[]) {
  return {
    novelTotal: getProjectTotal(novel, sessions),
    essayTotal: getProjectTotal(essay, sessions),
    novelDaily: wordsByDate(getProjectSeries(novel, sessions, today)),
    essayDaily: wordsByDate(getProjectSeries(essay, sessions, today)),
    overallDaily: wordsByDate(getOverallSeries(sessions, today) ?? []),
  }
}

describe('project totals and daily activity through session mutations', () => {
  it('counts the starting count in the total only, never in either chart', () => {
    expect(snapshot([])).toEqual({
      novelTotal: 5000,
      essayTotal: 0,
      novelDaily: {},
      essayDaily: {},
      overallDaily: {},
    })
    expect(getProjectSeries(novel, [], today).some((point) => point.hasActivity)).toBe(false)
    expect(getOverallSeries([], today)).toBeNull()
  })

  it('recalculates totals, project series, and overall series after add, edit, and delete', () => {
    const a = createSession('novel', { wordCount: 400, date: '2026-10-21' }, 'a')
    const b = createSession('novel', { wordCount: 100, date: '2026-10-21' }, 'b')
    const c = createSession('novel', { wordCount: 250, date: '2026-10-23' }, 'c')
    const d = createSession('essay', { wordCount: 60, date: '2026-10-21' }, 'd')
    let sessions = [a, b, c, d]

    expect(snapshot(sessions)).toEqual({
      novelTotal: 5750,
      essayTotal: 60,
      novelDaily: { '2026-10-21': 500, '2026-10-23': 250 },
      essayDaily: { '2026-10-21': 60 },
      overallDaily: { '2026-10-21': 560, '2026-10-23': 250 },
    })

    // Edit count only.
    sessions = sessions.map((session) => (session.id === 'a' ? updateSession(a, { wordCount: 450, date: a.date }) : session))
    expect(snapshot(sessions)).toMatchObject({
      novelTotal: 5800,
      novelDaily: { '2026-10-21': 550, '2026-10-23': 250 },
      essayDaily: { '2026-10-21': 60 },
      overallDaily: { '2026-10-21': 610, '2026-10-23': 250 },
    })

    // Move a session to another date and change its count.
    sessions = sessions.map((session) =>
      session.id === 'b' ? updateSession(b, { wordCount: 120, date: '2026-10-22' }) : session,
    )
    expect(snapshot(sessions)).toMatchObject({
      novelTotal: 5820,
      novelDaily: { '2026-10-21': 450, '2026-10-22': 120, '2026-10-23': 250 },
      overallDaily: { '2026-10-21': 510, '2026-10-22': 120, '2026-10-23': 250 },
    })

    // Delete the only session on a day: that day returns to zero and loses its marker.
    sessions = sessions.filter((session) => session.id !== 'b')
    const novelSeries = getProjectSeries(novel, sessions, today)
    expect(novelSeries.find((point) => point.date === '2026-10-22')).toEqual({
      date: '2026-10-22',
      words: 0,
      sessionCount: 0,
      hasActivity: false,
    })
    expect(snapshot(sessions)).toMatchObject({
      novelTotal: 5700,
      overallDaily: { '2026-10-21': 510, '2026-10-23': 250 },
    })

    // Moving a session outside the chart window still updates the total.
    sessions = sessions.map((session) =>
      session.id === 'c' ? updateSession(c, { wordCount: 250, date: '2026-09-01' }) : session,
    )
    expect(snapshot(sessions)).toMatchObject({
      novelTotal: 5700,
      novelDaily: { '2026-10-21': 450 },
      overallDaily: { '2026-10-21': 510 },
    })
  })

  it('allows a derived total above the per-entry limit', () => {
    const big = createProject({ ...fields, title: 'Epic', startingWordCount: 1_000_000 }, 'epic', localNoon('2026-10-01'))
    const sessions = [
      createSession('epic', { wordCount: 1_000_000, date: '2026-10-20' }),
      createSession('epic', { wordCount: 1_000_000, date: '2026-10-21' }),
    ]
    expect(getProjectTotal(big, sessions)).toBe(3_000_000)
  })
})
