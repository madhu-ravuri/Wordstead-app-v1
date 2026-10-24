import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createSession } from '../../domain/sessions'
import { SessionHistory } from './SessionHistory'

const today = '2026-10-23'

function renderHistory(overrides: Partial<Parameters<typeof SessionHistory>[0]> = {}) {
  const props = {
    sessions: [],
    onSessionRemoved: vi.fn(),
    today,
    canChangeSessions: true,
    isLogging: false,
    onLogClose: vi.fn(),
    onLog: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    storageUnavailable: false,
    ...overrides,
  }
  render(<SessionHistory {...props} />)
  return props
}

describe('SessionHistory', () => {
  it('logs a session dated today by default', async () => {
    const user = userEvent.setup()
    const props = renderHistory({ isLogging: true })

    expect(screen.getByLabelText('Words written')).toHaveFocus()
    expect(screen.getByLabelText('Date written')).toHaveValue(today)
    expect(screen.getByLabelText('Date written')).toHaveAttribute('max', today)
    await user.type(screen.getByLabelText('Words written'), '650')
    await user.click(screen.getByRole('button', { name: 'Log session' }))

    expect(props.onLog).toHaveBeenCalledWith({ wordCount: 650, date: today })
    expect(props.onLogClose).toHaveBeenCalledOnce()
    expect(await screen.findByRole('status')).toHaveTextContent('Logged 650 words for Oct 23, 2026.')
  })

  it('accepts a late entry for a past date', async () => {
    const user = userEvent.setup()
    const props = renderHistory({ isLogging: true })

    await user.type(screen.getByLabelText('Words written'), '120')
    fireEvent.change(screen.getByLabelText('Date written'), { target: { value: '2026-10-02' } })
    await user.click(screen.getByRole('button', { name: 'Log session' }))

    expect(props.onLog).toHaveBeenCalledWith({ wordCount: 120, date: '2026-10-02' })
  })

  it('rejects invalid counts and future dates without saving', async () => {
    const user = userEvent.setup()
    const props = renderHistory({ isLogging: true })

    await user.type(screen.getByLabelText('Words written'), '0')
    fireEvent.change(screen.getByLabelText('Date written'), { target: { value: '2026-10-24' } })
    await user.click(screen.getByRole('button', { name: 'Log session' }))

    expect(props.onLog).not.toHaveBeenCalled()
    expect(props.onLogClose).not.toHaveBeenCalled()
    expect(screen.getByText('Enter a whole number from 1 to 1,000,000.')).toBeInTheDocument()
    expect(screen.getByText('Choose today or an earlier date.')).toBeInTheDocument()
    expect(screen.getByLabelText('Words written')).toHaveAttribute('aria-invalid', 'true')
  })

  it('keeps the form open and shows the error when saving fails', async () => {
    const user = userEvent.setup()
    const props = renderHistory({
      isLogging: true,
      onLog: vi.fn().mockRejectedValue(new Error('Wordstead could not save this session.')),
    })

    await user.type(screen.getByLabelText('Words written'), '80')
    await user.click(screen.getByRole('button', { name: 'Log session' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Wordstead could not save this session.')
    expect(screen.getByLabelText('Words written')).toHaveValue('80')
    expect(props.onLogClose).not.toHaveBeenCalled()
  })

  it('cancelling the log form asks the page to close it', async () => {
    const user = userEvent.setup()
    const props = renderHistory({ isLogging: true })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onLogClose).toHaveBeenCalledOnce()
  })

  it('lists same-day sessions separately and corrects one of them', async () => {
    const user = userEvent.setup()
    const first = createSession('p1', { wordCount: 300, date: '2026-10-20' }, 's1', '2026-10-20T09:00:00.000Z')
    const second = createSession('p1', { wordCount: 200, date: '2026-10-20' }, 's2', '2026-10-20T15:00:00.000Z')
    const props = renderHistory({ sessions: [first, second] })

    const entries = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(entries).toHaveLength(2)
    expect(entries[0]).toHaveTextContent('Oct 20, 2026200 words')
    expect(entries[1]).toHaveTextContent('Oct 20, 2026300 words')

    await user.click(screen.getByRole('button', { name: 'Edit session on Oct 20, 2026, 300 words' }))
    const countField = screen.getByLabelText('Words written')
    expect(countField).toHaveValue('300')
    await user.clear(countField)
    await user.type(countField, '350')
    fireEvent.change(screen.getByLabelText('Date written'), { target: { value: '2026-10-19' } })
    await user.click(screen.getByRole('button', { name: 'Save session' }))

    expect(props.onUpdate).toHaveBeenCalledWith(first, { wordCount: 350, date: '2026-10-19' })
  })

  it('asks for confirmation before deleting a session', async () => {
    const user = userEvent.setup()
    const session = createSession('p1', { wordCount: 300, date: '2026-10-20' }, 's1')
    const props = renderHistory({ sessions: [session] })

    await user.click(screen.getByRole('button', { name: 'Delete session on Oct 20, 2026, 300 words' }))
    expect(screen.getByRole('button', { name: 'Keep' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Keep' }))
    expect(props.onDelete).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete session on Oct 20, 2026, 300 words' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(props.onDelete).toHaveBeenCalledWith(session)
    expect(await screen.findByRole('status')).toHaveTextContent('Deleted the Oct 20, 2026 session.')
    expect(props.onSessionRemoved).toHaveBeenCalledOnce()
  })

  it('never shows the log form when sessions are read-only', () => {
    renderHistory({ canChangeSessions: false, isLogging: true, readOnlyMessage: 'Reopen it to change sessions.' })
    expect(screen.queryByLabelText('Words written')).not.toBeInTheDocument()
    expect(screen.getByText('Reopen it to change sessions.')).toBeInTheDocument()
    expect(screen.getByText('No sessions recorded yet.')).toBeInTheDocument()
  })

  it('lists sessions without edit or delete actions when sessions are read-only', () => {
    const sessions = [
      createSession('p1', { wordCount: 300, date: '2026-10-20' }, 's1'),
      createSession('p1', { wordCount: 120, date: '2026-10-21' }, 's2'),
    ]
    renderHistory({ sessions, canChangeSessions: false })
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /^Edit session/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Delete session/ })).not.toBeInTheDocument()
  })

  it('opening an edit closes the log form so only one form shows', async () => {
    const user = userEvent.setup()
    const session = createSession('p1', { wordCount: 300, date: '2026-10-20' }, 's1')
    const props = renderHistory({ sessions: [session], isLogging: true })

    await user.click(screen.getByRole('button', { name: 'Edit session on Oct 20, 2026, 300 words' }))
    expect(props.onLogClose).toHaveBeenCalledOnce()
  })
})
