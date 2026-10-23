import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProjectForm } from './ProjectForm'

describe('ProjectForm', () => {
  it('creates a trimmed project with a default starting count', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<ProjectForm onCancel={vi.fn()} onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText(/title/i), '  First draft  ')
    await user.click(screen.getByRole('button', { name: 'Save project' }))

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'First draft',
      startingWordCount: 0,
      deadline: null,
      synopsis: null,
      notes: null,
    })
  })

  it('blocks invalid title and starting-count values', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<ProjectForm onCancel={vi.fn()} onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText(/title/i), '   ')
    await user.type(screen.getByLabelText(/starting word count/i), '1000001')
    await user.click(screen.getByRole('button', { name: 'Save project' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Enter a project title.')).toBeInTheDocument()
    expect(screen.getByText(/whole number from 0 to 1,000,000/i)).toBeInTheDocument()
  })

  it('blocks a malformed starting count instead of saving it as zero', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<ProjectForm onCancel={vi.fn()} onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText(/title/i), 'Typo draft')
    await user.type(screen.getByLabelText(/starting word count/i), '1-')
    await user.click(screen.getByRole('button', { name: 'Save project' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/whole number from 0 to 1,000,000/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/starting word count/i)).toHaveValue('1-')
  })

  it('reports persistence failures without clearing form input', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValue(new Error('Storage is unavailable.'))

    render(<ProjectForm onCancel={vi.fn()} onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText(/title/i), 'Keep this draft')
    await user.click(screen.getByRole('button', { name: 'Save project' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Storage is unavailable.')
    expect(screen.getByLabelText(/title/i)).toHaveValue('Keep this draft')
  })
})