import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createProject } from '../../domain/projects'
import { createSession } from '../../domain/sessions'
import { Dashboard } from './Dashboard'

function localNoon(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, 12).toISOString()
}

describe('Dashboard', () => {
  it('shows the empty project and activity states', () => {
    render(
      <Dashboard
        activeProjects={[]}
        completedProjects={[]}
        sessions={[]}
        today="2026-10-23"
        onCreate={vi.fn()}
        onOpen={vi.fn()}
        storageUnavailable={false}
      />,
    )

    expect(screen.getByRole('heading', { name: 'In progress' })).toBeInTheDocument()
    expect(screen.getByText('No projects on your desk yet.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'No writing sessions recorded yet' })).toBeInTheDocument()
  })

  it('opens the new-project flow from the primary plus button', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()

    render(
      <Dashboard
        activeProjects={[]}
        completedProjects={[]}
        sessions={[]}
        today="2026-10-23"
        onCreate={onCreate}
        onOpen={vi.fn()}
        storageUnavailable={false}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'New project' }))
    expect(onCreate).toHaveBeenCalledOnce()
  })

  it('shows each project total, sparkline summary, and an overall chart including deleted-project sessions', () => {
    const project = createProject(
      { title: 'Harbor Song', startingWordCount: 1000, deadline: null, synopsis: null, notes: null },
      'harbor',
      localNoon('2026-10-01'),
    )
    const sessions = [
      createSession('harbor', { wordCount: 300, date: '2026-10-21' }, 's1', localNoon('2026-10-21')),
      createSession('harbor', { wordCount: 200, date: '2026-10-21' }, 's2', localNoon('2026-10-22')),
      createSession('deleted-project', { wordCount: 50, date: '2026-10-21' }, 's3', localNoon('2026-10-21')),
    ]

    render(
      <Dashboard
        activeProjects={[project]}
        completedProjects={[]}
        sessions={sessions}
        today="2026-10-23"
        onCreate={vi.fn()}
        onOpen={vi.fn()}
        storageUnavailable={false}
      />,
    )

    const row = screen.getByRole('button', { name: /Harbor Song/ })
    expect(row).toHaveTextContent('1,500')
    expect(row).toHaveTextContent(/Edited Oct 22, 2026/)
    expect(row).toHaveAccessibleName(/500 words written from .+, on 1 of 7 days/)
    expect(row.querySelectorAll('.chart-marker')).toHaveLength(1)
    expect(
      screen.getByRole('img', { name: /^Daily words across all projects\. 550 words written from .+, on 1 of 3 days/ }),
    ).toBeInTheDocument()
  })
})
