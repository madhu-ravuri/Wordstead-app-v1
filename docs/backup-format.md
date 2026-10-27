# Wordstead backup format

Wordstead exports a single UTF-8 JSON file named `wordstead-backup-YYYY-MM-DD.json`, where the date is the local calendar date of the export. The file contains every stored project and writing session, including completed and soft-deleted projects, so a restore reproduces the overall daily chart exactly.

## Schema version 1

```json
{
  "format": "wordstead-backup",
  "schemaVersion": 1,
  "exportedAt": "2026-10-26T19:00:00.000Z",
  "projects": [
    {
      "id": "9c1f…",
      "title": "Harbor Song",
      "startingWordCount": 1200,
      "deadline": "2027-02-14",
      "synopsis": "A cartographer follows a vanished shoreline.",
      "notes": "Keep the lighthouse scene quiet.",
      "createdAt": "2026-10-01T16:00:00.000Z",
      "updatedAt": "2026-10-23T18:30:00.000Z",
      "completedAt": null,
      "deletedAt": null
    }
  ],
  "sessions": [
    {
      "id": "4b7e…",
      "projectId": "9c1f…",
      "date": "2026-10-24",
      "wordCount": 400,
      "createdAt": "2026-10-24T18:00:00.000Z",
      "updatedAt": "2026-10-24T18:00:00.000Z"
    }
  ]
}
```

### Project fields

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | Non-empty; unique among projects in the file. |
| `title` | string | Non-empty after trimming. |
| `startingWordCount` | integer | 0 to 1,000,000 inclusive. |
| `deadline` | `YYYY-MM-DD` or `null` | A real calendar date. |
| `synopsis`, `notes` | string or `null` | Plain text. |
| `createdAt`, `updatedAt` | ISO 8601 timestamp | With a `Z` or `±hh:mm` offset. |
| `completedAt`, `deletedAt` | ISO 8601 timestamp or `null` | Non-null while completed / after soft deletion. |

### Session fields

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | Non-empty; unique among sessions in the file. |
| `projectId` | string | Must match a project `id` in the same file. |
| `date` | `YYYY-MM-DD` | The local calendar date the writing happened. Stored and restored as text, never converted through UTC. |
| `wordCount` | integer | 1 to 1,000,000 inclusive. |
| `createdAt`, `updatedAt` | ISO 8601 timestamp | `createdAt` is when the session was logged. |

Unknown extra fields are ignored on import and never exported.

## Import rules

1. The file must be a `.json` file under 20 MB, parse as JSON, have `"format": "wordstead-backup"`, and use a supported `schemaVersion`. Files from a newer version are rejected rather than partially read.
2. Every record is validated, IDs must be unique within the file (an exact duplicate still invalidates it), and every session must reference a project in the file. Any problem rejects the whole file and nothing is changed.
3. Into an empty browser, a valid backup is restored after a confirmation.
4. Into a browser with data, the user chooses:
   - **Replace**: the backup becomes the complete dataset, including its soft-deleted records.
   - **Merge**: records with new IDs are added; records whose ID and content match are skipped; records whose ID matches but content differs are conflicts, and the user picks which version to keep for each before anything is written. Cancelling makes no changes.
5. The final dataset is written in a single IndexedDB transaction, so a failed import never leaves partial data.

## Changing the format

Increase `CURRENT_SCHEMA_VERSION` in `src/data/backup.ts`, add a migration step from the previous version to `MIGRATIONS`, and document the new version here. Older backups are upgraded one step at a time on import.
