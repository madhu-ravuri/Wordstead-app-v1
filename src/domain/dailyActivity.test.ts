import { describe, expect, it } from 'vitest'
import { getDailyActivity } from './dailyActivity'
import { createSession } from './sessions'

const sessions = [
  createSession('p1', { wordCount: 300, date: '2026-10-20' }, 's1'),
  createSession('p1', { wordCount: 200, date: '2026-10-20' }, 's2'),
  createSession('p2', { wordCount: 50, date: '2026-10-20' }, 's3'),
  createSession('p2', { wordCount: 75, date: '2026-10-21' }, 's4'),
  createSession('deleted-project', { wordCount: 10, date: '2026-10-21' }, 's5'),
]

describe('getDailyActivity', () => {
  it('sums one project per date and counts its sessions', () => {
    const activity = getDailyActivity(sessions, 'p1')
    expect(Object.fromEntries(activity)).toEqual({
      '2026-10-20': { words: 500, sessionCount: 2 },
    })
  })

  it('sums every project record for overall activity, including soft-deleted projects', () => {
    const activity = getDailyActivity(sessions)
    expect(Object.fromEntries(activity)).toEqual({
      '2026-10-20': { words: 550, sessionCount: 3 },
      '2026-10-21': { words: 85, sessionCount: 2 },
    })
  })

  it('is empty when there are no sessions, regardless of starting counts', () => {
    expect(getDailyActivity([]).size).toBe(0)
    expect(getDailyActivity(sessions, 'project-without-sessions').size).toBe(0)
  })
})
