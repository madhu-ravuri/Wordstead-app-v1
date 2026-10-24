// Local calendar dates are stored as `YYYY-MM-DD` strings. Arithmetic on them
// uses UTC day numbers so daylight-saving transitions can never shift a date.

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

export function getLocalCalendarDate(dateTime: string | Date): string {
  const date = typeof dateTime === 'string' ? new Date(dateTime) : dateTime
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTodayLocalDate(now: Date = new Date()): string {
  return getLocalCalendarDate(now)
}

function toDayNumber(date: string): number {
  const match = DATE_PATTERN.exec(date)
  if (!match) return NaN
  const utc = new Date(0)
  utc.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Math.floor(utc.getTime() / MS_PER_DAY)
}

function fromDayNumber(dayNumber: number): string {
  const utc = new Date(dayNumber * MS_PER_DAY)
  const year = String(utc.getUTCFullYear()).padStart(4, '0')
  const month = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const day = String(utc.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isLocalDate(value: string): boolean {
  const dayNumber = toDayNumber(value)
  return !Number.isNaN(dayNumber) && fromDayNumber(dayNumber) === value
}

export function addDays(date: string, days: number): string {
  return fromDayNumber(toDayNumber(date) + days)
}

export function daysBetween(start: string, end: string): number {
  return toDayNumber(end) - toDayNumber(start)
}

export function listDates(start: string, end: string): string[] {
  const dates: string[] = []
  for (let day = toDayNumber(start); day <= toDayNumber(end); day += 1) {
    dates.push(fromDayNumber(day))
  }
  return dates
}

export function formatCalendarDate(
  date: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
): string {
  const [year, month, day] = date.split('-').map(Number)
  // Local noon avoids zones where DST skips midnight.
  return new Intl.DateTimeFormat(undefined, options).format(new Date(year, month - 1, day, 12))
}
