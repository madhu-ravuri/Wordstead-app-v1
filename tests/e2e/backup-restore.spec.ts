import { readFile } from 'node:fs/promises'
import { expect, test, type Browser, type Page } from '@playwright/test'

test.use({ timezoneId: 'America/Los_Angeles' })

const NOW = '2026-10-26T12:00:00-07:00'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW)
})

interface BackupJson {
  format: string
  schemaVersion: number
  exportedAt: string
  projects: { id: string; title: string; completedAt: string | null; deletedAt: string | null; startingWordCount: number }[]
  sessions: { id: string; projectId: string; date: string; wordCount: number }[]
}

async function createProject(page: Page, title: string, startingCount = '') {
  await page.goto('./')
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByLabel('Title').fill(title)
  if (startingCount) await page.getByLabel('Starting word count').fill(startingCount)
  await page.getByRole('button', { name: 'Save project' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
}

async function logSession(page: Page, words: string, date: string) {
  await page.getByRole('button', { name: 'Log session' }).click()
  await page.getByLabel('Words written', { exact: true }).fill(words)
  await page.getByLabel('Date written', { exact: true }).fill(date)
  await page.getByRole('button', { name: 'Log session' }).click()
  await expect(page.locator('.session-form')).toHaveCount(0)
}

// Active, completed, and deleted projects, with a same-day pair and a DST-night date.
async function seed(page: Page) {
  await createProject(page, 'Harbor Song', '1200')
  await logSession(page, '400', '2026-10-24')
  await logSession(page, '150', '2026-10-24')
  await createProject(page, 'Orchard Letters')
  await logSession(page, '90', '2026-10-25')
  await page.getByRole('button', { name: 'Mark complete' }).click()
  await expect(page.getByText('Completed Oct 26, 2026')).toBeVisible()
  await createProject(page, 'Lighthouse Notes', '50')
  await logSession(page, '700', '2026-10-01')
  await page.getByRole('button', { name: 'Delete project' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete project' }).click()
  await expect(page.getByRole('heading', { name: 'In progress' })).toBeVisible()
}

async function exportBackup(page: Page): Promise<{ text: string; fileName: string }> {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const file = await download
  return { text: await readFile((await file.path())!, 'utf8'), fileName: file.suggestedFilename() }
}

async function chooseFile(page: Page, text: string, name = 'wordstead-backup.json', mimeType = 'application/json') {
  await page.getByLabel('Backup file to import').setInputFiles({ name, mimeType, buffer: Buffer.from(text) })
}

function overallChart(page: Page) {
  return page.getByRole('img', { name: /^Daily words across all projects/ })
}

async function storedRecords(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ projects: unknown[]; sessions: unknown[] }>((resolve, reject) => {
        const request = indexedDB.open('wordstead')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction(['projects', 'sessions'])
          const projects = transaction.objectStore('projects').getAll()
          const sessions = transaction.objectStore('sessions').getAll()
          transaction.oncomplete = () => {
            database.close()
            const byId = (records: { id: string }[]) => [...records].sort((a, b) => a.id.localeCompare(b.id))
            resolve({ projects: byId(projects.result), sessions: byId(sessions.result) })
          }
        }
      }),
  )
}

async function freshPage(browser: Browser, timezoneId = 'America/Los_Angeles'): Promise<Page> {
  const context = await browser.newContext({ timezoneId })
  const page = await context.newPage()
  await page.clock.setFixedTime(NOW)
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'In progress' })).toBeVisible()
  return page
}

test('exports one versioned file with every project and session, including deleted ones', async ({ page }) => {
  await seed(page)
  const { text, fileName } = await exportBackup(page)
  expect(fileName).toBe('wordstead-backup-2026-10-26.json')
  await expect(page.getByRole('status')).toContainText('Downloaded wordstead-backup-2026-10-26.json with 3 projects (1 completed, 1 deleted) and 4 writing sessions.')

  const backup: BackupJson = JSON.parse(text)
  expect(backup.format).toBe('wordstead-backup')
  expect(backup.schemaVersion).toBe(1)
  expect(backup.projects.map((project) => project.title).sort()).toEqual(['Harbor Song', 'Lighthouse Notes', 'Orchard Letters'])
  expect(backup.projects.find((project) => project.title === 'Lighthouse Notes')?.deletedAt).toBeTruthy()
  expect(backup.projects.find((project) => project.title === 'Orchard Letters')?.completedAt).toBeTruthy()
  expect(backup.sessions.map((session) => session.date).sort()).toEqual(['2026-10-01', '2026-10-24', '2026-10-24', '2026-10-25'])
})

test('restores into an empty browser with the same records and calendar dates, even in another time zone', async ({ page, browser }) => {
  await seed(page)
  const overallBefore = await overallChart(page).getAttribute('aria-label')
  const original = await storedRecords(page)
  const { text } = await exportBackup(page)

  const restored = await freshPage(browser, 'Asia/Tokyo')
  await chooseFile(restored, text)
  const dialog = restored.getByRole('dialog', { name: 'Restore this backup?' })
  await expect(dialog).toContainText('3 projects (1 completed, 1 deleted) and 4 writing sessions')
  await dialog.getByRole('button', { name: 'Import backup' }).click()

  await expect(restored.getByRole('status')).toContainText('Restored 3 projects')
  expect(await storedRecords(restored)).toEqual(original)
  await expect(restored.getByRole('button', { name: /Harbor Song/ })).toContainText('1,750')
  await expect(restored.locator('.completed-list').getByRole('button', { name: /Orchard Letters/ })).toBeVisible()
  await expect(restored.getByRole('button', { name: /Lighthouse Notes/ })).toHaveCount(0)
  // Tokyo is a day ahead of Los Angeles at this instant, so "today" differs, but every
  // stored session date is unchanged.
  await expect(overallChart(restored)).toHaveAccessibleName(/1,340 words written from Oct 1, 2026 to Oct 27, 2026/)
  expect(overallBefore).toMatch(/1,340 words written from Oct 1, 2026 to Oct 26, 2026/)

  await restored.getByRole('button', { name: /Harbor Song/ }).click()
  await expect(restored.locator('.session-list > li').first()).toContainText('Oct 24, 2026')

  await restored.reload()
  expect(await storedRecords(restored)).toEqual(original)
})

test('replace makes the backup the complete dataset', async ({ page, browser }) => {
  await createProject(page, 'Only in the backup')
  await logSession(page, '321', '2026-10-25')
  const { text } = await exportBackup(page)

  const target = await freshPage(browser)
  await seed(target)
  await chooseFile(target, text)
  const dialog = target.getByRole('dialog', { name: 'Replace or merge?' })
  await expect(dialog).toContainText('This browser already has 3 projects (1 completed, 1 deleted) and 4 writing sessions')
  await dialog.getByRole('radio', { name: /Replace all data/ }).check()
  await dialog.getByRole('button', { name: 'Replace all data' }).click()

  await expect(target.getByRole('status')).toContainText('Replaced this browser’s data with the backup: 1 project and 1 writing session.')
  const stored = await storedRecords(target)
  expect(stored.projects).toHaveLength(1)
  expect(stored.sessions).toHaveLength(1)
  await expect(target.getByRole('button', { name: /Only in the backup/ })).toBeVisible()
  await expect(target.getByRole('button', { name: /Harbor Song/ })).toHaveCount(0)
  await expect(overallChart(target)).toHaveAccessibleName(/321 words written/)
})

test('merge keeps both sides, deduplicates identical records, and resolves conflicts', async ({ page }) => {
  await seed(page)
  const { text } = await exportBackup(page)

  // Re-importing the same backup: everything already matches.
  await chooseFile(page, text)
  await page.getByRole('dialog').getByRole('radio', { name: /Merge/ }).check()
  await expect(page.getByRole('dialog')).toContainText('adds 0 new projects and 0 new sessions; 7 records already match')
  const before = await storedRecords(page)
  await page.getByRole('dialog').getByRole('button', { name: 'Merge data' }).click()
  await expect(page.getByRole('status')).toContainText('Merged the backup: added 0 projects and 0 sessions.')
  expect(await storedRecords(page)).toEqual(before)

  // A backup with one new project and one changed session.
  const backup: BackupJson = JSON.parse(text)
  const harbor = backup.projects.find((project) => project.title === 'Harbor Song')!
  backup.projects.push({ ...harbor, id: 'from-backup', title: 'From the backup' })
  const changed = backup.sessions.find((session) => session.wordCount === 400)!
  changed.wordCount = 480

  await chooseFile(page, JSON.stringify(backup))
  await page.getByRole('dialog').getByRole('radio', { name: /Merge/ }).check()
  await expect(page.getByRole('dialog')).toContainText('1 record differs')
  await page.getByRole('dialog').getByRole('button', { name: 'Review conflicts' }).click()
  const conflict = page.getByRole('group', { name: /^Session on Oct 24, 2026 in “Harbor Song”/ })
  await expect(conflict).toContainText('Words written400480')

  // Cancelling leaves everything as it was.
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await storedRecords(page)).toEqual(before)

  await chooseFile(page, JSON.stringify(backup))
  await page.getByRole('dialog').getByRole('radio', { name: /Merge/ }).check()
  await page.getByRole('dialog').getByRole('button', { name: 'Review conflicts' }).click()
  await page.getByRole('radio', { name: 'Use the backup’s version' }).check()
  await page.getByRole('dialog').getByRole('button', { name: 'Merge data' }).click()

  await expect(page.getByRole('status')).toContainText('added 1 project and 0 sessions; kept your choice for 1 conflict')
  await expect(page.getByRole('button', { name: /From the backup/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Harbor Song/ })).toContainText('1,830')
  await page.reload()
  await expect(page.getByRole('button', { name: /Harbor Song/ })).toContainText('1,830')
})

test('rejects invalid files and leaves existing data intact', async ({ page }) => {
  await seed(page)
  const { text } = await exportBackup(page)
  const before = await storedRecords(page)
  const backup: BackupJson = JSON.parse(text)

  const cases: [string, string, RegExp, string?][] = [
    ['duplicate project IDs', JSON.stringify({ ...backup, projects: [...backup.projects, backup.projects[0]] }), /More than one project has the ID/],
    ['duplicate session IDs', JSON.stringify({ ...backup, sessions: [...backup.sessions, backup.sessions[0]] }), /More than one session has the ID/],
    ['malformed JSON', '{ "format": "wordstead-backup", ', /isn’t valid JSON/],
    ['unsupported version', JSON.stringify({ ...backup, schemaVersion: 7 }), /schema version 7, which is newer/],
    ['bad session date', JSON.stringify({ ...backup, sessions: [{ ...backup.sessions[0], date: '2026-02-30' }] }), /invalid date/],
    ['wrong file type', text, /ending in \.json/, 'notes.txt'],
  ]

  for (const [, contents, problem, name] of cases) {
    await chooseFile(page, contents, name, name ? 'text/plain' : 'application/json')
    const dialog = page.getByRole('dialog', { name: 'This backup can’t be imported' })
    await expect(dialog).toContainText('Nothing was changed.')
    await expect(dialog).toContainText(problem)
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toHaveCount(0)
    expect(await storedRecords(page)).toEqual(before)
  }
  await expect(page.getByRole('button', { name: 'Import backup' })).toBeFocused()
})

test('backup controls are low-key footer actions that work by keyboard', async ({ page }) => {
  await createProject(page, 'Keyboard backup draft')
  await page.getByRole('button', { name: 'All projects' }).click()

  const exportButton = page.getByRole('button', { name: 'Export backup' })
  const footer = page.locator('footer')
  await expect(footer.getByRole('button', { name: 'Export backup' })).toBeVisible()
  await expect(footer.getByRole('button', { name: 'Import backup' })).toBeVisible()

  await exportButton.focus()
  const download = page.waitForEvent('download')
  await page.keyboard.press('Enter')
  expect((await download).suggestedFilename()).toBe('wordstead-backup-2026-10-26.json')

  await page.setViewportSize({ width: 375, height: 740 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
})
