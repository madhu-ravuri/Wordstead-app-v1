import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Dataset, ParseResult } from '../../data/backup'
import { applyMerge, planMerge, type Conflict, type Resolution } from '../../data/merge'
import { formatCalendarDate } from '../../domain/dates'
import type { Project, WritingSession } from '../../domain/projects'
import { describeDataset, plural } from './describeDataset'

interface ImportDialogProps {
  fileName: string
  result: ParseResult
  current: Dataset
  onCancel: () => void
  /** Writes the final dataset atomically; rejects if nothing was saved. */
  onApply: (data: Dataset, summary: string) => Promise<void>
  storageUnavailable: boolean
}

type Mode = 'replace' | 'merge'

const PROJECT_FIELDS: [keyof Project, string][] = [
  ['title', 'Title'],
  ['startingWordCount', 'Starting word count'],
  ['deadline', 'Deadline'],
  ['synopsis', 'Synopsis'],
  ['notes', 'Notes'],
  ['completedAt', 'Completed'],
  ['deletedAt', 'Deleted'],
  ['createdAt', 'Created'],
  ['updatedAt', 'Last edited'],
]

const SESSION_FIELDS: [keyof WritingSession, string][] = [
  ['date', 'Date written'],
  ['wordCount', 'Words written'],
  ['projectId', 'Project'],
  ['createdAt', 'Logged'],
  ['updatedAt', 'Last corrected'],
]

const DATE_FIELDS = new Set(['deadline', 'date'])
const TIMESTAMP_FIELDS = new Set(['completedAt', 'deletedAt', 'createdAt', 'updatedAt'])

function formatValue(field: string, value: unknown, projectTitle: (id: string) => string): string {
  if (value === null || value === undefined || value === '') {
    if (field === 'completedAt') return 'Not completed'
    if (field === 'deletedAt') return 'Not deleted'
    return '—'
  }
  if (typeof value === 'number') return new Intl.NumberFormat().format(value)
  if (DATE_FIELDS.has(field)) return formatCalendarDate(String(value))
  if (TIMESTAMP_FIELDS.has(field)) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(String(value)))
  }
  if (field === 'projectId') return `“${projectTitle(String(value))}”`
  const text = String(value)
  return text.length > 80 ? `${text.slice(0, 79)}…` : text
}

function conflictDetails(conflict: Conflict, projectTitle: (id: string) => string) {
  const fields = conflict.kind === 'project' ? PROJECT_FIELDS : SESSION_FIELDS
  const existing = conflict.existing as unknown as Record<string, unknown>
  const incoming = conflict.incoming as unknown as Record<string, unknown>
  const differences = fields
    .filter(([field]) => existing[field] !== incoming[field])
    .map(([field, label]) => ({
      label,
      mine: formatValue(field, existing[field], projectTitle),
      theirs: formatValue(field, incoming[field], projectTitle),
    }))
  const title =
    conflict.kind === 'project'
      ? `Project “${conflict.existing.title}”`
      : `Session on ${formatCalendarDate(conflict.existing.date)} in “${projectTitle(conflict.existing.projectId)}”`
  return { title, differences }
}

export function ImportDialog({ fileName, result, current, onCancel, onApply, storageUnavailable }: ImportDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const [step, setStep] = useState<'choose' | 'conflicts'>('choose')
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({})
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
  }, [])

  const cancel = () => {
    if (isApplying) return
    dialog.current?.close()
    onCancel()
  }

  const apply = async (data: Dataset, summary: string) => {
    setIsApplying(true)
    setError(null)
    try {
      await onApply(data, summary)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The backup could not be imported. Your data was not changed.')
      setIsApplying(false)
    }
  }

  const shell = (title: string, body: ReactNode, actions: ReactNode) => (
    <dialog
      ref={dialog}
      className="confirm-dialog import-dialog"
      aria-labelledby="import-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        cancel()
      }}
    >
      <p className="eyebrow">Import backup</p>
      <h2 id="import-dialog-title">{title}</h2>
      <p className="import-file-name">{fileName}</p>
      {body}
      {error && <p className="form-error form-error-summary" role="alert">{error}</p>}
      <div className="form-actions">{actions}</div>
    </dialog>
  )

  const cancelButton = (
    <button className="secondary-button" type="button" onClick={cancel} disabled={isApplying}>
      Cancel
    </button>
  )

  if (!result.ok) {
    return shell(
      'This backup can’t be imported',
      <div className="confirm-dialog-copy">
        <p>Nothing was changed. Wordstead found these problems:</p>
        <ul className="import-problems">
          {result.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </div>,
      <button className="primary-button" type="button" onClick={cancel}>
        Close
      </button>,
    )
  }

  const backup = result.data
  const isEmpty = current.projects.length === 0 && current.sessions.length === 0

  if (isEmpty) {
    return shell(
      'Restore this backup?',
      <div className="confirm-dialog-copy">
        <p>This will add {describeDataset(backup)} to this browser.</p>
      </div>,
      <>
        {cancelButton}
        <button
          className="primary-button"
          type="button"
          onClick={() => void apply(backup, `Restored ${describeDataset(backup)} from the backup.`)}
          disabled={isApplying || storageUnavailable}
        >
          {isApplying ? 'Importing…' : 'Import backup'}
        </button>
      </>,
    )
  }

  const plan = planMerge(current, backup)
  const projectTitle = (id: string) =>
    current.projects.find((project) => project.id === id)?.title ??
    backup.projects.find((project) => project.id === id)?.title ??
    'Unknown project'
  const mergeSummary = () => {
    const added = `added ${plural(plan.newProjects, 'project')} and ${plural(plan.newSessions, 'session')}`
    const conflicts = plan.conflicts.length ? `; kept your choice for ${plural(plan.conflicts.length, 'conflict')}` : ''
    return `Merged the backup: ${added}${conflicts}.`
  }

  if (step === 'conflicts') {
    const unresolved = plan.conflicts.filter((conflict) => !resolutions[conflict.key]).length
    const chooseAll = (resolution: Resolution) =>
      setResolutions(Object.fromEntries(plan.conflicts.map((conflict) => [conflict.key, resolution])))

    return shell(
      `Choose versions for ${plural(plan.conflicts.length, 'conflict')}`,
      <>
        <div className="confirm-dialog-copy">
          <p>These records exist on this device and in the backup with different content. Nothing changes until you merge.</p>
        </div>
        <div className="conflict-bulk">
          <button className="text-button" type="button" onClick={() => chooseAll('existing')}>
            Keep all from this device
          </button>
          <button className="text-button" type="button" onClick={() => chooseAll('incoming')}>
            Use all from the backup
          </button>
        </div>
        <ol className="conflict-list">
          {plan.conflicts.map((conflict) => {
            const { title, differences } = conflictDetails(conflict, projectTitle)
            return (
              <li key={conflict.key}>
                <fieldset>
                  <legend>{title}</legend>
                  <table className="conflict-table">
                    <thead>
                      <tr>
                        <th scope="col">Field</th>
                        <th scope="col">This device</th>
                        <th scope="col">Backup</th>
                      </tr>
                    </thead>
                    <tbody>
                      {differences.map((difference) => (
                        <tr key={difference.label}>
                          <th scope="row">{difference.label}</th>
                          <td>{difference.mine}</td>
                          <td>{difference.theirs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="conflict-choices">
                    {(['existing', 'incoming'] as const).map((choice) => (
                      <label key={choice}>
                        <input
                          type="radio"
                          name={conflict.key}
                          value={choice}
                          checked={resolutions[conflict.key] === choice}
                          onChange={() => setResolutions((currentChoices) => ({ ...currentChoices, [conflict.key]: choice }))}
                        />
                        {choice === 'existing' ? 'Keep this device’s version' : 'Use the backup’s version'}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </li>
            )
          })}
        </ol>
        {unresolved > 0 && <p className="conflict-remaining">{plural(unresolved, 'conflict')} still need a choice.</p>}
      </>,
      <>
        {cancelButton}
        <button className="secondary-button" type="button" onClick={() => setStep('choose')} disabled={isApplying}>
          Back
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={() => void apply(applyMerge(current, backup, resolutions), mergeSummary())}
          disabled={unresolved > 0 || isApplying || storageUnavailable}
        >
          {isApplying ? 'Merging…' : 'Merge data'}
        </button>
      </>,
    )
  }

  const confirmLabel =
    mode === 'replace' ? 'Replace all data' : mode === 'merge' && plan.conflicts.length ? 'Review conflicts' : 'Merge data'

  return shell(
    'Replace or merge?',
    <>
      <div className="confirm-dialog-copy">
        <p>
          The backup has {describeDataset(backup)}. This browser already has {describeDataset(current)}.
        </p>
      </div>
      <fieldset className="import-mode">
        <legend>How should the backup be imported?</legend>
        <label className="import-mode-option">
          <input type="radio" name="import-mode" value="replace" checked={mode === 'replace'} onChange={() => setMode('replace')} />
          <span>
            <strong>Replace all data</strong>
            <span>Everything currently in this browser is removed and replaced with the backup.</span>
          </span>
        </label>
        <label className="import-mode-option">
          <input type="radio" name="import-mode" value="merge" checked={mode === 'merge'} onChange={() => setMode('merge')} />
          <span>
            <strong>Merge with this browser’s data</strong>
            <span>
              Keeps everything here and adds {plural(plan.newProjects, 'new project')} and{' '}
              {plural(plan.newSessions, 'new session')}
              {plan.identical > 0 && `; ${plural(plan.identical, 'record')} already ${plan.identical === 1 ? 'matches' : 'match'}`}.
              {plan.conflicts.length > 0 &&
                ` ${plural(plan.conflicts.length, 'record')} ${plan.conflicts.length === 1 ? 'differs' : 'differ'}, and you’ll choose which version to keep.`}
            </span>
          </span>
        </label>
      </fieldset>
    </>,
    <>
      {cancelButton}
      <button
        className={mode === 'replace' ? 'primary-button danger-button' : 'primary-button'}
        type="button"
        disabled={mode === null || isApplying || storageUnavailable}
        onClick={() => {
          if (mode === 'replace') {
            void apply(backup, `Replaced this browser’s data with the backup: ${describeDataset(backup)}.`)
          } else if (plan.conflicts.length > 0) {
            setStep('conflicts')
          } else {
            void apply(applyMerge(current, backup, {}), mergeSummary())
          }
        }}
      >
        {isApplying ? 'Importing…' : confirmLabel}
      </button>
    </>,
  )
}
