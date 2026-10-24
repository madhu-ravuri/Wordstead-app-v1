import { addDays, formatCalendarDate, getLocalCalendarDate, listDates } from './dates'
import { getDailyActivity, type DailyActivity } from './dailyActivity'
import type { Project, WritingSession } from './projects'

export const PROJECT_CHART_DAYS = 7
export const OVERALL_CHART_DAYS = 30

export interface ChartPoint {
  date: string
  words: number
  sessionCount: number
  hasActivity: boolean
}

export interface DateRange {
  start: string
  end: string
}

function earliestDate(sessions: readonly WritingSession[]): string | null {
  return sessions.reduce<string | null>(
    (earliest, session) => (earliest === null || session.date < earliest ? session.date : earliest),
    null,
  )
}

function clampStart(start: string, today: string): DateRange {
  return { start: start > today ? today : start, end: today }
}

// §5.4 AC 4: at most today and the previous six days. Younger projects start at the
// earlier of their creation date and earliest session, if that falls within the window.
export function getProjectChartRange(
  project: Project,
  sessions: readonly WritingSession[],
  today: string,
): DateRange {
  const windowStart = addDays(today, -(PROJECT_CHART_DAYS - 1))
  const createdDate = getLocalCalendarDate(project.createdAt)
  const earliestSession = earliestDate(sessions.filter((session) => session.projectId === project.id))
  const firstActivity = earliestSession !== null && earliestSession < createdDate ? earliestSession : createdDate
  return clampStart(firstActivity > windowStart ? firstActivity : windowStart, today)
}

// §5.5 AC 2: the last 30 days, or from the earliest session if that is more recent.
// Returns null when there are no sessions at all (§5.5 AC 7 empty state).
export function getOverallChartRange(
  sessions: readonly WritingSession[],
  today: string,
): DateRange | null {
  const earliest = earliestDate(sessions)
  if (earliest === null) return null

  const windowStart = addDays(today, -(OVERALL_CHART_DAYS - 1))
  return clampStart(earliest > windowStart ? earliest : windowStart, today)
}

export function buildSeries(range: DateRange, activity: Map<string, DailyActivity>): ChartPoint[] {
  return listDates(range.start, range.end).map((date) => {
    const day = activity.get(date)
    return {
      date,
      words: day?.words ?? 0,
      sessionCount: day?.sessionCount ?? 0,
      hasActivity: (day?.sessionCount ?? 0) > 0,
    }
  })
}

export function getProjectSeries(
  project: Project,
  sessions: readonly WritingSession[],
  today: string,
): ChartPoint[] {
  return buildSeries(
    getProjectChartRange(project, sessions, today),
    getDailyActivity(sessions, project.id),
  )
}

export function getOverallSeries(
  sessions: readonly WritingSession[],
  today: string,
): ChartPoint[] | null {
  const range = getOverallChartRange(sessions, today)
  return range && buildSeries(range, getDailyActivity(sessions))
}

// Plain-language chart meaning for assistive technology (§5.9 AC 6).
export function describeSeries(points: readonly ChartPoint[]): string {
  if (points.length === 0) return 'No writing activity to show.'

  const first = formatCalendarDate(points[0].date)
  const last = formatCalendarDate(points[points.length - 1].date)
  const span = points.length === 1 ? `on ${first}` : `from ${first} to ${last}`
  const activeDays = points.filter((point) => point.hasActivity)

  if (activeDays.length === 0) return `No writing sessions ${span}.`

  const total = activeDays.reduce((sum, point) => sum + point.words, 0)
  const peak = activeDays.reduce((best, point) => (point.words > best.words ? point : best))
  const format = (count: number) => new Intl.NumberFormat().format(count)
  const dayWord = (count: number) => (count === 1 ? 'day' : 'days')

  return (
    `${format(total)} words written ${span}, on ${activeDays.length} of ${points.length} ${dayWord(points.length)}. ` +
    `Most in one day: ${format(peak.words)} words on ${formatCalendarDate(peak.date)}.`
  )
}
