import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addDays,
  daysBetween,
  formatCalendarDate,
  getLocalCalendarDate,
  getTodayLocalDate,
  isLocalDate,
  listDates,
} from './dates'

function setTimeZone(timeZone: string) {
  vi.stubEnv('TZ', timeZone)
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('local calendar dates', () => {
  it('validates date-only strings', () => {
    expect(isLocalDate('2026-10-23')).toBe(true)
    expect(isLocalDate('2028-02-29')).toBe(true)
    for (const value of ['2026-02-29', '2026-13-01', '2026-10-32', '2026-1-5', '10/23/2026', '', '2026-10-23T00:00']) {
      expect(isLocalDate(value)).toBe(false)
    }
  })

  it('adds days and lists inclusive ranges across month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-10-17', '2026-10-23')).toBe(6)
    expect(listDates('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ])
  })

  it.each(['America/New_York', 'Europe/London', 'Australia/Sydney', 'America/Santiago'])(
    'treats daylight-saving days as one calendar day in %s',
    (timeZone) => {
      setTimeZone(timeZone)
      // Each range spans that zone's 2026 DST transitions.
      expect(listDates('2026-03-07', '2026-03-10')).toHaveLength(4)
      expect(listDates('2026-03-28', '2026-04-06')).toHaveLength(10)
      expect(listDates('2026-10-24', '2026-11-02')).toHaveLength(10)
      expect(listDates('2026-09-04', '2026-09-08')).toHaveLength(5)
      expect(listDates('2026-10-02', '2026-10-06')).toHaveLength(5)
      expect(daysBetween('2026-03-01', '2026-03-31')).toBe(30)
      expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
    },
  )

  it('reads today and timestamps in the local time zone, not UTC', () => {
    setTimeZone('America/Los_Angeles')
    // 03:30 UTC on Oct 24 is still the evening of Oct 23 in Los Angeles.
    expect(getTodayLocalDate(new Date('2026-10-24T03:30:00.000Z'))).toBe('2026-10-23')
    expect(getLocalCalendarDate('2026-10-24T03:30:00.000Z')).toBe('2026-10-23')

    setTimeZone('Asia/Tokyo')
    expect(getLocalCalendarDate('2026-10-23T16:30:00.000Z')).toBe('2026-10-24')
  })

  it('reads the local date correctly on both sides of a DST change', () => {
    setTimeZone('America/New_York')
    // DST ends 2026-11-01 at 02:00 local; this day has 25 hours.
    expect(getLocalCalendarDate('2026-11-01T04:30:00.000Z')).toBe('2026-11-01') // 00:30 EDT
    expect(getLocalCalendarDate('2026-11-02T04:30:00.000Z')).toBe('2026-11-01') // 23:30 EST
    expect(getLocalCalendarDate('2026-11-02T05:30:00.000Z')).toBe('2026-11-02') // 00:30 EST
  })

  it('formats a stored date without shifting it in any time zone', () => {
    for (const timeZone of ['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/Santiago', 'UTC']) {
      setTimeZone(timeZone)
      expect(formatCalendarDate('2026-09-06', { day: 'numeric' })).toBe('6')
      expect(getLocalCalendarDate(new Date(2026, 8, 6, 12))).toBe('2026-09-06')
    }
  })
})
