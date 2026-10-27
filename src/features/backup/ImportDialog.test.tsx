import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Dataset, ParseResult } from '../../data/backup'
import { sampleDataset } from '../../test/backupFixtures'
import { ImportDialog } from './ImportDialog'

const empty: Dataset = { projects: [], sessions: [] }

function renderDialog(result: ParseResult, current: Dataset, overrides: Partial<Parameters<typeof ImportDialog>[0]> = {}) {
  const props = {
    fileName: 'wordstead-backup-2026-10-26.json',
    result,
    current,
    onCancel: vi.fn(),
    onApply: vi.fn().mockResolvedValue(undefined),
    storageUnavailable: false,
    ...overrides,
  }
  render(<ImportDialog {...props} />)
  return props
}

describe('ImportDialog', () => {
  it('lists problems for an invalid file and changes nothing', async () => {
    const user = userEvent.setup()
    const props = renderDialog({ ok: false, problems: ['Session 2 has an invalid date (expected YYYY-MM-DD).'] }, sampleDataset())

    const dialog = screen.getByRole('dialog', { name: 'This backup can’t be imported' })
    expect(dialog).toHaveTextContent('Nothing was changed.')
    expect(within(dialog).getByRole('listitem')).toHaveTextContent('Session 2 has an invalid date')
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(props.onCancel).toHaveBeenCalledOnce()
    expect(props.onApply).not.toHaveBeenCalled()
  })

  it('restores into an empty browser without a replace or merge choice', async () => {
    const user = userEvent.setup()
    const backup = sampleDataset()
    const props = renderDialog({ ok: true, data: backup }, empty)

    const dialog = screen.getByRole('dialog', { name: 'Restore this backup?' })
    expect(dialog).toHaveTextContent('3 projects (1 completed, 1 deleted) and 4 writing sessions')
    expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Import backup' }))
    expect(props.onApply).toHaveBeenCalledWith(backup, expect.stringContaining('Restored 3 projects'))
  })

  it('asks whether to replace or merge when data exists, and replaces on request', async () => {
    const user = userEvent.setup()
    const backup: Dataset = { projects: [sampleDataset().projects[0]], sessions: [] }
    const props = renderDialog({ ok: true, data: backup }, sampleDataset())

    const dialog = screen.getByRole('dialog', { name: 'Replace or merge?' })
    expect(dialog).toHaveTextContent('This browser already has 3 projects')
    const confirm = within(dialog).getByRole('button', { name: 'Merge data' })
    expect(confirm).toBeDisabled()

    await user.click(within(dialog).getByRole('radio', { name: /Replace all data/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Replace all data' }))
    expect(props.onApply).toHaveBeenCalledWith(backup, expect.stringContaining('Replaced this browser’s data'))
  })

  it('merges directly when there are no conflicts', async () => {
    const user = userEvent.setup()
    const existing = sampleDataset()
    const backup: Dataset = {
      projects: [existing.projects[0], { ...existing.projects[0], id: 'new', title: 'New Story' }],
      sessions: [],
    }
    const props = renderDialog({ ok: true, data: backup }, existing)

    expect(screen.getByRole('radio', { name: /Merge/ }).closest('label')).toHaveTextContent(
      'adds 1 new project and 0 new sessions; 1 record already matches',
    )
    await user.click(screen.getByRole('radio', { name: /Merge/ }))
    await user.click(screen.getByRole('button', { name: 'Merge data' }))
    const [merged, summary] = vi.mocked(props.onApply).mock.calls[0]
    expect((merged as Dataset).projects).toHaveLength(4)
    expect(summary).toBe('Merged the backup: added 1 project and 0 sessions.')
  })

  it('requires a choice for each conflict before merging', async () => {
    const user = userEvent.setup()
    const existing = sampleDataset()
    const backup: Dataset = {
      projects: [{ ...existing.projects[0], title: 'Harbor Song (revised)' }],
      sessions: [{ ...existing.sessions[0], wordCount: 450 }],
    }
    const props = renderDialog({ ok: true, data: backup }, existing)

    await user.click(screen.getByRole('radio', { name: /Merge/ }))
    await user.click(screen.getByRole('button', { name: 'Review conflicts' }))
    const dialog = screen.getByRole('dialog', { name: 'Choose versions for 2 conflicts' })

    const projectConflict = within(dialog).getByRole('group', { name: 'Project “Harbor Song”' })
    expect(projectConflict).toHaveTextContent('TitleHarbor SongHarbor Song (revised)')
    const sessionConflict = within(dialog).getByRole('group', { name: /^Session on Oct 21, 2026 in “Harbor Song”/ })
    expect(sessionConflict).toHaveTextContent('Words written400450')

    const merge = within(dialog).getByRole('button', { name: 'Merge data' })
    expect(merge).toBeDisabled()
    expect(dialog).toHaveTextContent('2 conflicts still need a choice.')

    await user.click(within(projectConflict).getByRole('radio', { name: 'Use the backup’s version' }))
    expect(merge).toBeDisabled()
    await user.click(within(sessionConflict).getByRole('radio', { name: 'Keep this device’s version' }))
    await user.click(merge)

    const merged = vi.mocked(props.onApply).mock.calls[0][0] as Dataset
    expect(merged.projects.find((project) => project.id === 'harbor')?.title).toBe('Harbor Song (revised)')
    expect(merged.sessions.find((session) => session.id === 's1')?.wordCount).toBe(400)
    expect(vi.mocked(props.onApply).mock.calls[0][1]).toBe('Merged the backup: added 0 projects and 0 sessions; kept your choice for 2 conflicts.')
  })

  it('offers bulk choices and cancelling a conflict review changes nothing', async () => {
    const user = userEvent.setup()
    const existing = sampleDataset()
    const backup: Dataset = { projects: [], sessions: [{ ...existing.sessions[0], wordCount: 450 }] }
    const props = renderDialog({ ok: true, data: backup }, existing)

    await user.click(screen.getByRole('radio', { name: /Merge/ }))
    await user.click(screen.getByRole('button', { name: 'Review conflicts' }))
    await user.click(screen.getByRole('button', { name: 'Use all from the backup' }))
    expect(screen.getByRole('radio', { name: 'Use the backup’s version' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Merge data' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onCancel).toHaveBeenCalledOnce()
    expect(props.onApply).not.toHaveBeenCalled()
  })

  it('keeps the dialog open with the error when saving fails', async () => {
    const user = userEvent.setup()
    renderDialog({ ok: true, data: sampleDataset() }, empty, {
      onApply: vi.fn().mockRejectedValue(new Error('Wordstead could not import this backup. Your data was not changed.')),
    })

    await user.click(screen.getByRole('button', { name: 'Import backup' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your data was not changed.')
    expect(screen.getByRole('button', { name: 'Import backup' })).toBeEnabled()
  })
})
