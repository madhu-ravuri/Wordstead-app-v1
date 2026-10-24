import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { completeProject } from '../../domain/projectLifecycle'
import { createProject } from '../../domain/projects'
import { createSession } from '../../domain/sessions'
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
        sessions={[]}
        today="2026-10-23"
        onLogSession={vi.fn()}
        onUpdateSession={vi.fn()}
        onDeleteSession={vi.fn()}
        onComplete={vi.fn()}
        onReopen={vi.fn()}
        onDelete={vi.fn()}
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
    expect(screen.getByText(/No sessions recorded yet/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Daily words for A Story With Notes\. No writing sessions/ })).toBeInTheDocument()
  })

  it('opens the edit form from the pencil control', async () => {
    const user = userEvent.setup()
    render(
      <ProjectDetail
        project={project}
        sessions={[]}
        today="2026-10-23"
        onLogSession={vi.fn()}
        onUpdateSession={vi.fn()}
        onDeleteSession={vi.fn()}
        onComplete={vi.fn()}
        onReopen={vi.fn()}
        onDelete={vi.fn()}
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
        sessions={[]}
        today="2026-10-23"
        onLogSession={vi.fn()}
        onUpdateSession={vi.fn()}
        onDeleteSession={vi.fn()}
        onComplete={vi.fn()}
        onReopen={vi.fn()}
        onDelete={vi.fn()}
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

  it('adds session words to the total and dates last edited by the latest session log', () => {
    const sessions = [
      createSession('detail-project', { wordCount: 400, date: '2026-10-10' }, 's1', '2026-10-25T12:00:00.000Z'),
      createSession('detail-project', { wordCount: 250, date: '2026-10-24' }, 's2', '2026-10-24T12:00:00.000Z'),
    ]
    render(
      <ProjectDetail
        project={project}
        sessions={sessions}
        today="2026-10-26"
        onLogSession={vi.fn()}
        onUpdateSession={vi.fn()}
        onDeleteSession={vi.fn()}
        onComplete={vi.fn()}
        onReopen={vi.fn()}
        onDelete={vi.fn()}
        onBack={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        storageUnavailable={false}
      />,
    )

    expect(screen.getByText('3,000')).toBeInTheDocument()
    // Backdated session logged on Oct 25 sets the last-edited date, not its Oct 10 activity date.
    expect(screen.getByText('Date last edited').nextElementSibling).toHaveTextContent('Oct 25, 2026')
    expect(screen.getByRole('img', { name: /250 words written from .+, on 1 of 7 days/ })).toBeInTheDocument()
  })

  function renderDetail(overrides: Partial<Parameters<typeof ProjectDetail>[0]> = {}) {
    const props = {
      project,
      sessions: [],
      today: '2026-10-23',
      onBack: vi.fn(),
      onSave: vi.fn().mockResolvedValue(undefined),
      onLogSession: vi.fn().mockResolvedValue(undefined),
      onUpdateSession: vi.fn().mockResolvedValue(undefined),
      onDeleteSession: vi.fn().mockResolvedValue(undefined),
      onComplete: vi.fn().mockResolvedValue(undefined),
      onReopen: vi.fn().mockResolvedValue(undefined),
      onDelete: vi.fn().mockResolvedValue(undefined),
      storageUnavailable: false,
      ...overrides,
    }
    render(<ProjectDetail {...props} />)
    return props
  }

  it('marks an active project complete', async () => {
    const user = userEvent.setup()
    const props = renderDetail()

    expect(screen.getByRole('button', { name: 'Log session' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mark complete' }))
    expect(props.onComplete).toHaveBeenCalledOnce()
    expect(await screen.findByText('Project marked complete. It’s now in your completed projects.')).toBeInTheDocument()
  })

  it('shows a completed project as complete with read-only sessions until reopened', async () => {
    const user = userEvent.setup()
    const props = renderDetail({
      project: completeProject(project, '2026-10-22T18:00:00.000Z'),
      sessions: [createSession('detail-project', { wordCount: 400, date: '2026-10-20' }, 's1')],
    })

    expect(screen.getByText('400 words')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Edit session/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Delete session/ })).not.toBeInTheDocument()

    expect(screen.getByText(/^Completed Oct 2[23], 2026$/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log session' })).not.toBeInTheDocument()
    expect(screen.getByText('This project is complete. Reopen it to log, correct, or delete sessions.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark complete' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reopen project' }))
    expect(props.onReopen).toHaveBeenCalledOnce()
  })

  it('reports a failed status change without claiming success', async () => {
    const user = userEvent.setup()
    renderDetail({ onComplete: vi.fn().mockRejectedValue(new Error('Wordstead could not save this project.')) })

    await user.click(screen.getByRole('button', { name: 'Mark complete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Wordstead could not save this project.')
    expect(screen.queryByText(/Project marked complete/)).not.toBeInTheDocument()
  })

  it('confirms deletion in a dialog that names the project and explains retained history', async () => {
    const user = userEvent.setup()
    const sessions = [
      createSession('detail-project', { wordCount: 400, date: '2026-10-20' }, 's1'),
      createSession('detail-project', { wordCount: 850, date: '2026-10-21' }, 's2'),
    ]
    const props = renderDetail({ sessions })

    await user.click(screen.getByRole('button', { name: 'Delete project' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete “A Story With Notes”?' })
    expect(dialog).toHaveAccessibleDescription(
      /2 writing sessions \(1,250 words\) will stay in your overall daily chart and in your backup data\./,
    )

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(props.onDelete).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete project' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete project' }))
    expect(props.onDelete).toHaveBeenCalledOnce()
  })

  it('keeps the dialog open with an error when deletion fails', async () => {
    const user = userEvent.setup()
    renderDetail({ onDelete: vi.fn().mockRejectedValue(new Error('Wordstead could not save this project.')) })

    await user.click(screen.getByRole('button', { name: 'Delete project' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleDescription(/no writing sessions, so your overall chart won’t change/)
    await user.click(within(dialog).getByRole('button', { name: 'Delete project' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Wordstead could not save this project.')
  })

  it('opens the log form from the toolbar beside the edit button and returns focus after saving', async () => {
    const user = userEvent.setup()
    const props = renderDetail()

    const toolbar = screen.getByRole('button', { name: 'Edit project' }).parentElement!
    const logButton = within(toolbar).getByRole('button', { name: 'Log session' })
    await user.click(logButton)
    expect(screen.getByLabelText('Words written')).toHaveFocus()
    expect(within(toolbar).queryByRole('button', { name: 'Log session' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Words written'), '500')
    await user.click(screen.getByRole('button', { name: 'Log session' }))
    expect(props.onLogSession).toHaveBeenCalledWith({ wordCount: 500, date: '2026-10-23' })
    expect(await within(toolbar).findByRole('button', { name: 'Log session' })).toHaveFocus()
  })
})
