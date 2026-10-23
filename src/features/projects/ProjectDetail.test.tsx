import { render, screen, within } from '@testing-library/react'
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
    const notesRow = screen.getByText('Notes').closest('div')
    expect(notesRow).not.toBeNull()
    expect(within(notesRow!).getByText('Keep the ending gentle.')).toBeInTheDocument()
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

  it('saves edited fields and returns to the detail view', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <ProjectDetail
        project={project}
        onBack={vi.fn()}
        onSave={onSave}
        storageUnavailable={false}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Edit project' }))
    expect(screen.getByLabelText(/starting word count/i)).toHaveValue('2350')
    expect(screen.getByLabelText(/deadline/i)).toHaveValue('2026-12-31')
    expect(screen.getByLabelText(/synopsis/i)).toHaveValue('A quiet mystery.')
    expect(screen.getByLabelText(/notes/i)).toHaveValue('Keep the ending gentle.')

    await user.clear(screen.getByLabelText(/title/i))
    await user.type(screen.getByLabelText(/title/i), 'A Louder Story')
    await user.clear(screen.getByLabelText(/starting word count/i))
    await user.type(screen.getByLabelText(/starting word count/i), '3000')
    await user.clear(screen.getByLabelText(/deadline/i))
    await user.clear(screen.getByLabelText(/synopsis/i))
    await user.clear(screen.getByLabelText(/notes/i))
    await user.type(screen.getByLabelText(/notes/i), 'New notes')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSave).toHaveBeenCalledWith({
      title: 'A Louder Story',
      startingWordCount: 3000,
      deadline: null,
      synopsis: null,
      notes: 'New notes',
    })
    expect(await screen.findByRole('button', { name: 'Edit project' })).toBeInTheDocument()
  })
})
