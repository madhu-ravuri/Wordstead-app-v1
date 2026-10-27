import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Automated WCAG 2.1 A/AA checks for every screen at desktop and phone widths.
// Manual keyboard and screen-reader passes remain release gates; this is not a substitute.

test.use({ timezoneId: 'America/Los_Angeles' })

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 375, height: 740 },
]

async function scan(page: Page, screen: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const summary = results.violations.map(
    (violation) =>
      `${screen}: [${violation.id}] ${violation.help}\n` +
      violation.nodes.map((node) => `    ${node.target.join(' ')} — ${node.failureSummary?.split('\n')[1] ?? ''}`).join('\n'),
  )
  expect(summary, summary.join('\n')).toEqual([])
}

async function createProject(page: Page, title: string) {
  await page.goto('./')
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByLabel('Title').fill(title)
  await page.getByLabel('Synopsis').fill('A cartographer follows a vanished shoreline.')
  await page.getByLabel('Notes').fill('Keep the lighthouse scene quiet.')
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

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} accessibility`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test.beforeEach(async ({ page }) => {
      await page.clock.setFixedTime('2026-10-26T12:00:00-07:00')
    })

    test('empty dashboard and new-project form, including validation errors', async ({ page }) => {
      await page.goto('./')
      await expect(page.getByRole('heading', { name: 'In progress' })).toBeVisible()
      await scan(page, 'empty dashboard')

      await page.getByRole('button', { name: 'New project' }).click()
      await scan(page, 'new project form')
      await page.getByLabel('Starting word count').fill('-4')
      await page.getByRole('button', { name: 'Save project' }).click()
      await expect(page.getByText('Enter a project title.')).toBeVisible()
      await scan(page, 'new project form with errors')
    })

    test('project detail, session forms, completion, and delete dialog', async ({ page }) => {
      await createProject(page, 'Harbor Song')
      await logSession(page, '400', '2026-10-24')
      await logSession(page, '150', '2026-10-25')
      await scan(page, 'project detail with sessions')

      await page.getByRole('button', { name: 'Log session' }).click()
      await page.getByRole('button', { name: 'Log session' }).click()
      await expect(page.getByText('Enter how many words you wrote.')).toBeVisible()
      await scan(page, 'log session form with errors')
      await page.getByRole('button', { name: 'Cancel' }).click()

      await page.getByRole('button', { name: /^Delete session on Oct 24/ }).click()
      await scan(page, 'session delete confirmation')
      await page.getByRole('button', { name: 'Keep' }).click()

      await page.getByRole('button', { name: 'Edit project' }).click()
      await scan(page, 'edit project form')
      await page.getByRole('button', { name: 'Cancel' }).click()

      await page.getByRole('button', { name: 'Mark complete' }).click()
      await expect(page.getByText(/^Completed /)).toBeVisible()
      await scan(page, 'completed project detail')

      await page.getByRole('button', { name: 'Delete project' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await scan(page, 'delete project dialog')
      await page.getByRole('dialog').getByRole('button', { name: 'Delete project' }).click()
      await expect(page.getByRole('heading', { name: 'In progress' })).toBeVisible()
      await expect(page.locator('.app-notice')).toBeVisible()
      await scan(page, 'dashboard after deletion with notice')
    })

    test('dashboard with data, import dialogs, and not-found page', async ({ page }) => {
      await createProject(page, 'Harbor Song')
      await logSession(page, '400', '2026-10-24')
      await createProject(page, 'Orchard Letters')
      await logSession(page, '90', '2026-10-25')
      await page.getByRole('button', { name: 'Mark complete' }).click()
      await expect(page.getByText(/^Completed /)).toBeVisible()
      await page.getByRole('button', { name: 'All projects' }).click()
      await scan(page, 'dashboard with active and completed projects')

      const download = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Export backup' }).click()
      const text = await (await download).createReadStream().then(async (stream) => {
        const chunks: Buffer[] = []
        for await (const chunk of stream) chunks.push(chunk as Buffer)
        return Buffer.concat(chunks).toString('utf8')
      })
      const backup = JSON.parse(text)
      backup.sessions[0].wordCount = 480
      const input = page.getByLabel('Backup file to import')
      await input.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
      await expect(page.getByRole('dialog', { name: 'Replace or merge?' })).toBeVisible()
      await scan(page, 'import mode choice')
      await page.getByRole('radio', { name: /Merge/ }).check()
      await page.getByRole('button', { name: 'Review conflicts' }).click()
      await scan(page, 'import conflicts')
      await page.getByRole('button', { name: 'Cancel' }).click()

      await input.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{') })
      await expect(page.getByRole('dialog', { name: 'This backup can’t be imported' })).toBeVisible()
      await scan(page, 'import error')
      await page.getByRole('button', { name: 'Close' }).click()

      await page.goto('./#/project/missing')
      await expect(page.getByRole('heading', { name: 'Project not found' })).toBeVisible()
      await scan(page, 'project not found')
    })
  })
}
