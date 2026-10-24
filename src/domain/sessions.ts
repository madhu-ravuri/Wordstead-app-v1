import { isLocalDate } from './dates'
import { MAX_WORD_COUNT, parseWholeNumber, type WritingSession } from './projects'

export interface SessionFormValues {
  wordCount: string
  date: string
}

export interface SessionFields {
  wordCount: number
  date: string
}

export type SessionFieldErrors = Partial<Record<keyof SessionFormValues, string>>

export function validateSessionForm(
  values: SessionFormValues,
  today: string,
): { fields: SessionFields | null; errors: SessionFieldErrors } {
  const errors: SessionFieldErrors = {}
  const wordCount = parseWholeNumber(values.wordCount)
  const date = values.date.trim()

  if (values.wordCount.trim() === '') {
    errors.wordCount = 'Enter how many words you wrote.'
  } else if (wordCount === null || wordCount < 1 || wordCount > MAX_WORD_COUNT) {
    errors.wordCount = `Enter a whole number from 1 to ${MAX_WORD_COUNT.toLocaleString()}.`
  }

  if (date === '') {
    errors.date = 'Choose the date you wrote.'
  } else if (!isLocalDate(date)) {
    errors.date = 'Enter a valid date.'
  } else if (date > today) {
    errors.date = 'Choose today or an earlier date.'
  }

  if (wordCount === null || Object.keys(errors).length > 0) {
    return { fields: null, errors }
  }

  return { fields: { wordCount, date }, errors }
}

export function createSession(
  projectId: string,
  fields: SessionFields,
  id: string = crypto.randomUUID(),
  now = new Date().toISOString(),
): WritingSession {
  return { id, projectId, ...fields, createdAt: now, updatedAt: now }
}

// Corrections keep the original log time (`createdAt`), so they never change "date last edited".
export function updateSession(
  session: WritingSession,
  fields: SessionFields,
  now = new Date().toISOString(),
): WritingSession {
  return { ...session, ...fields, updatedAt: now }
}

// Newest activity date first; same-day sessions newest logged first.
export function sortSessionHistory(sessions: readonly WritingSession[]): WritingSession[] {
  return [...sessions].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.createdAt.localeCompare(a.createdAt) ||
      a.id.localeCompare(b.id),
  )
}
