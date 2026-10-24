import type { WritingSession } from './projects'

export interface DailyActivity {
  words: number
  sessionCount: number
}

// Sums session words per local calendar date. Starting word counts are never included.
// Without a project ID this is overall activity across every project record,
// including completed and soft-deleted projects.
export function getDailyActivity(
  sessions: readonly WritingSession[],
  projectId?: string,
): Map<string, DailyActivity> {
  const activity = new Map<string, DailyActivity>()
  for (const session of sessions) {
    if (projectId !== undefined && session.projectId !== projectId) continue
    const day = activity.get(session.date) ?? { words: 0, sessionCount: 0 }
    activity.set(session.date, {
      words: day.words + session.wordCount,
      sessionCount: day.sessionCount + 1,
    })
  }
  return activity
}
