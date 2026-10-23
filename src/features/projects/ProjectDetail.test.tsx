import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createProject } from '../../domain/projects'
import { ProjectDetail } from './ProjectDetail'

const project = createProject(
  {
    title: 'A Story With Notes',
    startingWordCount: 2350,
    deadline: '2026-12-31',
    synopsis: 'A quiet mystery.',
    notes: 'Keep the ending gentle.',
  },
  'detail-project',
  '2026-10-23T12:00:00.000Z',
)

describe('ProjectDetail', () => {
  it('shows project details and an empty session history', () => {
    render(
      <ProjectDetail
        project={project}
        onBack={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        storageUnavailable={false}
      />,
    )

    expect(screen.getByRole('heading', { name: project.title })).toBeInTheDocument()
    expect(screen.getByText('A quiet mystery.')).toBeInTheDocument()
    expect(screen.getByText('Keep the ending gentle.')).toBeInTheDocument()
    expect(screen.getByText('2,350')).toBeInTheDocument()
    expect(screen.getByText('No sessions recorded')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'No writing sessions recorded for this project' })).toBeInTheDocument()
  })

  it('opens the edit form from the pencil control', async () => {
    const user = userEvent.setup()
    render(
      <ProjectDetail
        project={project}
        onBack={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        storageUnavailable={false}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Edit project' }))
    expect(screen.getByRole('heading', { name: 'Edit project' })).toBeInTheDocument()
    expect(screen.getByLabelText(/title/i)).toHaveValue(project.title)
  })
})