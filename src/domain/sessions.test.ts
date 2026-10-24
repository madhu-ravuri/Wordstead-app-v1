import { describe, expect, it } from 'vitest'
import { createSession, sortSessionHistory, updateSession, validateSessionForm } from './sessions'

const today = '2026-10-23'

describe('validateSessionForm', () => {
  it('accepts both word-count boundaries', () => {
    expect(validateSessionForm({ wordCount: '1', date: today }, today).fields).toEqual({ wordCount: 1, date: today })
    expect(validateSessionForm({ wordCount: '1000000', date: today }, today).fields?.wordCount).toBe(1_000_000)
    expect(validateSessionForm({ wordCount: ' 250 ', date: today }, today).fields?.wordCount).toBe(250)
  })

  it.each(['0', '-1', '1.5', '1000001', '', '   ', 'abc', '1e3', '+5', '12abc'])(
    'rejects word count %j',
    (wordCount) => {
      const result = validateSessionForm({ wordCount, date: today }, today)
      expect(result.fields).toBeNull()
      expect(result.errors.wordCount).toBeDefined()
    },
  )

  it('accepts today and past dates', () => {
    expect(validateSessionForm({ wordCount: '10', date: '2026-10-22' }, today).fields?.date).toBe('2026-10-22')
    expect(validateSessionForm({ wordCount: '10', date: '2019-01-01' }, today).fields?.date).toBe('2019-01-01')
  })

  it('rejects a future local date', () => {
    const result = validateSessionForm({ wordCount: '10', date: '2026-10-24' }, today)
    expect(result.fields).toBeNull()
    expect(result.errors.date).toBe('Choose today or an earlier date.')
  })

  it.each(['', '2026-02-30', '10/23/2026'])('rejects missing or malformed date %j', (date) => {
    const result = validateSessionForm({ wordCount: '10', date }, today)
    expect(result.fields).toBeNull()
    expect(result.errors.date).toBeDefined()
  })
})

describe('session records', () => {
  it('creates distinct records for repeated sessions on the same project and date', () => {
    const first = createSession('p1', { wordCount: 100, date: today }, 's1', '2026-10-23T09:00:00.000Z')
    const second = createSession('p1', { wordCount: 100, date: today }, 's2', '2026-10-23T09:00:00.000Z')

    expect(first).toEqual({
      id: 's1',
      projectId: 'p1',
      date: today,
      wordCount: 100,
      createdAt: '2026-10-23T09:00:00.000Z',
      updatedAt: '2026-10-23T09:00:00.000Z',
    })
    expect(second.id).not.toBe(first.id)
  })

  it('keeps the original log time when a session is corrected', () => {
    const session = createSession('p1', { wordCount: 100, date: today }, 's1', '2026-10-20T09:00:00.000Z')
    const corrected = updateSession(session, { wordCount: 150, date: '2026-10-19' }, '2026-10-23T09:00:00.000Z')

    expect(corrected).toEqual({
      ...session,
      wordCount: 150,
      date: '2026-10-19',
      updatedAt: '2026-10-23T09:00:00.000Z',
    })
  })

  it('orders history by newest activity date, then newest logged', () => {
    const sessions = [
      createSession('p1', { wordCount: 1, date: '2026-10-20' }, 'a', '2026-10-20T09:00:00.000Z'),
      createSession('p1', { wordCount: 2, date: '2026-10-22' }, 'b', '2026-10-22T09:00:00.000Z'),
      createSession('p1', { wordCount: 3, date: '2026-10-22' }, 'c', '2026-10-22T10:00:00.000Z'),
      createSession('p1', { wordCount: 4, date: '2026-10-21' }, 'd', '2026-10-23T09:00:00.000Z'),
    ]
    expect(sortSessionHistory(sessions).map((session) => session.id)).toEqual(['c', 'b', 'd', 'a'])
  })
})
