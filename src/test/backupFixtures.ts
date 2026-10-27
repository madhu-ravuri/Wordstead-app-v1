import type { Dataset } from '../data/backup'
import { completeProject, softDeleteProject } from '../domain/projectLifecycle'
import { createProject } from '../domain/projects'
import { createSession } from '../domain/sessions'

const fields = { deadline: null, synopsis: null, notes: null }

// Active, completed, and soft-deleted projects with sessions, including DST-boundary dates.
export function sampleDataset(): Dataset {
  const active = createProject(
    { ...fields, title: 'Harbor Song', startingWordCount: 1200, deadline: '2027-02-14', synopsis: 'A shoreline.', notes: 'Line one\nLine two' },
    'harbor',
    '2026-10-01T16:00:00.000Z',
  )
  const completed = completeProject(
    createProject({ ...fields, title: 'Orchard Letters', startingWordCount: 0 }, 'orchard', '2026-09-01T16:00:00.000Z'),
    '2026-10-20T16:00:00.000Z',
  )
  const deleted = softDeleteProject(
    createProject({ ...fields, title: 'Lighthouse Notes', startingWordCount: 50 }, 'lighthouse', '2026-09-15T16:00:00.000Z'),
    '2026-10-22T16:00:00.000Z',
  )
  return {
    projects: [active, completed, deleted],
    sessions: [
      createSession('harbor', { wordCount: 400, date: '2026-10-21' }, 's1', '2026-10-21T18:00:00.000Z'),
      createSession('harbor', { wordCount: 150, date: '2026-10-21' }, 's2', '2026-10-21T22:00:00.000Z'),
      createSession('orchard', { wordCount: 90, date: '2026-03-08' }, 's3', '2026-03-09T06:30:00.000Z'),
      createSession('lighthouse', { wordCount: 700, date: '2026-11-01' }, 's4', '2026-11-02T04:30:00.000Z'),
    ],
  }
}
