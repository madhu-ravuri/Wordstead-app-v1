import { expect, test, type Page } from '@playwright/test'

async function createProject(page: Page, title: string, startingCount = '') {
  await page.goto('./')
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByLabel('Title').fill(title)
  if (startingCount) await page.getByLabel('Starting word count').fill(startingCount)
  await page.getByRole('button', { name: 'Save project' }).click()
  // Navigation is complete once focus has moved to the new page's heading.
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeFocused()
}

function metadataValue(page: Page, term: string) {
  return page.locator('.project-metadata > div').filter({ has: page.getByText(term, { exact: true }) }).locator('dd')
}

test('creates a project, persists it across reload, and edits its fields', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'In progress' })).toBeVisible()
  await expect(page.getByText('No projects on your desk yet.')).toBeVisible()

  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByLabel('Title').fill('Lanterns at Low Tide')
  await page.getByLabel('Starting word count').fill('1400')
  await page.getByLabel('Deadline').fill('2027-02-14')
  await page.getByLabel('Synopsis').fill('A cartographer follows a vanished shoreline.')
  await page.getByLabel('Notes').fill('Keep the lighthouse scene quiet.')
  await page.getByRole('button', { name: 'Save project' }).click()
  await expect(page.getByRole('heading', { name: 'Lanterns at Low Tide' })).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'All projects' }).click()
  const row = page.getByRole('button', { name: /Lanterns at Low Tide/ })
  await expect(row).toBeVisible()
  await expect(row).toContainText('1,400')

  await row.click()
  await expect(metadataValue(page, 'Word count')).toHaveText('1,400')
  await expect(metadataValue(page, 'Deadline')).toHaveText('Feb 14, 2027')
  await expect(page.getByText('A cartographer follows a vanished shoreline.')).toBeVisible()
  await expect(metadataValue(page, 'Notes')).toHaveText('Keep the lighthouse scene quiet.')

  await page.getByRole('button', { name: 'Edit project' }).click()
  await page.getByLabel('Title').fill('Lanterns at High Tide')
  await page.getByLabel('Starting word count').fill('1800')
  await page.getByLabel('Deadline').fill('2025-06-01')
  await page.getByLabel('Synopsis').fill('The shoreline returns.')
  await page.getByLabel('Notes').fill('First line\n<b>not bold</b>')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('heading', { name: 'Lanterns at High Tide' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Lanterns at High Tide' })).toBeVisible()
  await expect(metadataValue(page, 'Word count')).toHaveText('1,800')
  await expect(metadataValue(page, 'Deadline')).toHaveText('Jun 1, 2025')
  await expect(page.getByText('The shoreline returns.')).toBeVisible()
  await expect(metadataValue(page, 'Notes')).toHaveText('First line\n<b>not bold</b>')
  await expect(metadataValue(page, 'Notes').locator('b')).toHaveCount(0)

  await page.getByRole('button', { name: 'All projects' }).click()
  await expect(page.getByRole('button', { name: /Lanterns at High Tide/ })).toContainText('1,800')
})

test('rejects a malformed starting count instead of saving zero', async ({ page }) => {
  await page.goto('./#/new')
  await page.getByLabel('Title').fill('Typo draft')
  for (const value of ['1-', '--5', 'e', '1e3']) {
    await page.getByLabel('Starting word count').fill(value)
    await page.getByRole('button', { name: 'Save project' }).click()
    await expect(page.getByText('Enter a whole number from 0 to 1,000,000.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'New project' })).toBeVisible()
  }
})

test('lists the most recently edited project first, including after reload', async ({ page }) => {
  await createProject(page, 'First made')
  await createProject(page, 'Second made')
  await createProject(page, 'Third made')

  const titles = page.locator('.project-list-column > .project-list .project-row-title')
  await page.goto('./')
  await expect(titles).toHaveText(['Third made', 'Second made', 'First made'])

  await page.getByRole('button', { name: /First made/ }).click()
  await page.getByRole('button', { name: 'Edit project' }).click()
  await page.getByLabel('Synopsis').fill('Touched last.')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Touched last.')).toBeVisible()

  await page.getByRole('button', { name: 'All projects' }).click()
  await expect(titles).toHaveText(['First made', 'Third made', 'Second made'])
  await page.reload()
  await expect(titles).toHaveText(['First made', 'Third made', 'Second made'])
})

test('long project titles wrap on phone-width dashboard rows without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 })
  const title = 'A remarkably long working title for a novel about tides'
  await createProject(page, title, '1000000')
  await page.getByRole('button', { name: 'All projects' }).click()

  const rowTitle = page.locator('.project-row-title', { hasText: title })
  await expect(rowTitle).toHaveText(title)
  const isClipped = await rowTitle.evaluate((element) => element.scrollWidth > element.clientWidth)
  expect(isClipped).toBe(false)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('opens and cancels project creation from the empty-state action', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Start a project' }).click()
  await expect(page.getByRole('heading', { name: 'New project' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('heading', { name: 'In progress' })).toBeVisible()
})

test('project form fields and actions follow a keyboard tab sequence', async ({ page }) => {
  await page.goto('./#/new')
  const title = page.getByLabel('Title')
  const startingCount = page.getByLabel('Starting word count')
  const deadline = page.getByLabel('Deadline')
  const synopsis = page.getByLabel('Synopsis')
  const notes = page.getByLabel('Notes')
  const cancel = page.getByRole('button', { name: 'Cancel' })
  const save = page.getByRole('button', { name: 'Save project' })

  await title.focus()
  await expect(title).toBeFocused()
  for (const next of [startingCount, deadline, synopsis, notes, cancel, save]) {
    let isFocused = false
    for (let tabCount = 0; tabCount < 5 && !isFocused; tabCount += 1) {
      await page.keyboard.press('Tab')
      isFocused = await next.evaluate((element) => element === document.activeElement)
    }
    expect(isFocused).toBe(true)
  }
})

test('project detail pencil control receives visible keyboard focus', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByLabel('Title').fill('Keyboard focus draft')
  await page.getByRole('button', { name: 'Save project' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Keyboard focus draft' })).toBeFocused()

  const backButton = page.getByRole('button', { name: 'All projects' })
  const logButton = page.getByRole('button', { name: 'Log session' })
  const editButton = page.getByRole('button', { name: 'Edit project' })
  await backButton.focus()
  // Toolbar order: back link, then Log session beside the pencil.
  await page.keyboard.press('Tab')
  await expect(logButton).toBeFocused()
  await expect(logButton).toHaveCSS('outline-style', 'solid')
  await page.keyboard.press('Tab')
  await expect(editButton).toBeFocused()
  await expect(editButton).toHaveCSS('outline-style', 'solid')
})