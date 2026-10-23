import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dashboard } from './Dashboard'

describe('Dashboard', () => {
  it('shows the empty project and activity states', () => {
    render(
      <Dashboard
        activeProjects={[]}
        completedProjects={[]}
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
        onCreate={onCreate}
        onOpen={vi.fn()}
        storageUnavailable={false}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'New project' }))
    expect(onCreate).toHaveBeenCalledOnce()
  })
})