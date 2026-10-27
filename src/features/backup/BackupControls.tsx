import { useRef, useState, type ChangeEvent } from 'react'
import { MAX_BACKUP_BYTES, parseBackup, type Dataset, type ParseResult } from '../../data/backup'
import { ImportDialog } from './ImportDialog'

interface BackupControlsProps {
  current: Dataset
  onExport: () => Promise<void>
  onApplyImport: (data: Dataset, summary: string) => Promise<void>
  disabled: boolean
}

// Low-prominence footer actions (§5.8 AC 1); the primary actions stay project and session focused.
export function BackupControls({ current, onExport, onApplyImport, disabled }: BackupControlsProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const importButton = useRef<HTMLButtonElement>(null)
  const [pending, setPending] = useState<{ fileName: string; result: ParseResult } | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    // Reset so choosing the same file again still triggers a change.
    input.value = ''
    if (!file) return

    let result: ParseResult
    if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
      result = { ok: false, problems: ['Choose a Wordstead backup file ending in .json.'] }
    } else if (file.size > MAX_BACKUP_BYTES) {
      result = { ok: false, problems: ['This file is too large to be a Wordstead backup.'] }
    } else {
      try {
        result = parseBackup(await file.text())
      } catch {
        result = { ok: false, problems: ['This file couldn’t be read.'] }
      }
    }
    setPending({ fileName: file.name, result })
  }

  const closeDialog = () => {
    setPending(null)
    importButton.current?.focus()
  }

  return (
    <div className="backup-controls">
      <button
        className="footer-link"
        type="button"
        disabled={disabled}
        onClick={() => {
          setExportError(null)
          onExport().catch((error: unknown) =>
            setExportError(error instanceof Error ? error.message : 'The backup could not be exported.'),
          )
        }}
      >
        Export backup
      </button>
      <span aria-hidden="true">·</span>
      <button
        ref={importButton}
        className="footer-link"
        type="button"
        disabled={disabled}
        onClick={() => fileInput.current?.click()}
      >
        Import backup
      </button>
      <input
        ref={fileInput}
        className="visually-hidden"
        type="file"
        accept=".json,application/json"
        tabIndex={-1}
        aria-label="Backup file to import"
        onChange={(event) => void handleFile(event)}
      />
      {exportError && <p className="form-error" role="alert">{exportError}</p>}
      {pending && (
        <ImportDialog
          fileName={pending.fileName}
          result={pending.result}
          current={current}
          onCancel={closeDialog}
          onApply={async (data, summary) => {
            await onApplyImport(data, summary)
            setPending(null)
          }}
          storageUnavailable={disabled}
        />
      )}
    </div>
  )
}
