import { expect, test } from '@playwright/test'

test.use({ timezoneId: 'America/Los_Angeles' })

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime('2026-10-26T12:00:00-07:00')
})

test('navigation updates the tab title and moves focus to the new page heading', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveTitle('Wordstead')

  await page.getByRole('button', { name: 'New project' }).click()
  await expect(page).toHaveTitle('New project · Wordstead')
  // The title field autofocuses, which is more useful than the heading here.
  await expect(page.getByLabel('Title')).toBeFocused()
  await page.getByLabel('Title').fill('Harbor Song')
  await page.getByRole('button', { name: 'Save project' }).click()

  await expect(page).toHaveTitle('Harbor Song · Wordstead')
  await expect(page.getByRole('heading', { level: 1, name: 'Harbor Song' })).toBeFocused()

  await page.getByRole('button', { name: 'All projects' }).click()
  await expect(page).toHaveTitle('Wordstead')
  await expect(page.getByRole('heading', { level: 1, name: 'In progress' })).toBeFocused()

  await page.goto('./#/project/missing')
  await expect(page).toHaveTitle('Project not found · Wordstead')
})

test('a rejected submit moves focus to the first invalid field', async ({ page }) => {
  await page.goto('./#/new')
  await page.getByLabel('Starting word count').fill('12abc')
  await page.getByRole('button', { name: 'Save project' }).click()
  // Title is blank and comes first, so it receives focus with its error described.
  await expect(page.getByLabel('Title')).toBeFocused()
  await expect(page.getByLabel('Title')).toHaveAccessibleDescription('Enter a project title.')

  await page.getByLabel('Title').fill('Focus draft')
  await page.getByRole('button', { name: 'Save project' }).click()
  await expect(page.getByLabel('Starting word count')).toBeFocused()
  await expect(page.getByLabel('Starting word count')).toHaveAccessibleDescription('Enter a whole number from 0 to 1,000,000.')

  await page.getByLabel('Starting word count').fill('')
  await page.getByRole('button', { name: 'Save project' }).click()
  await page.getByRole('button', { name: 'Log session' }).click()
  await page.getByLabel('Words written', { exact: true }).fill('5')
  await page.getByLabel('Date written', { exact: true }).fill('2026-10-27')
  await page.getByRole('button', { name: 'Log session' }).click()
  await expect(page.getByLabel('Date written', { exact: true })).toBeFocused()
  await expect(page.getByLabel('Date written', { exact: true })).toHaveAccessibleDescription('Choose today or an earlier date.')
})

test('closing the edit form returns focus to the pencil and announces the save', async ({ page }) => {
  await page.goto('./#/new')
  await page.getByLabel('Title').fill('Edit focus draft')
  await page.getByRole('button', { name: 'Save project' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Edit focus draft' })).toBeFocused()

  const pencil = page.getByRole('button', { name: 'Edit project' })
  await pencil.click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(pencil).toBeFocused()

  await pencil.press('Enter')
  await page.getByLabel('Synopsis').fill('Now with a synopsis.')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(pencil).toBeFocused()
  await expect(page.locator('.project-summary').getByRole('status')).toHaveText('Changes saved.')
})

test('import works with the keyboard alone, from file picker to resolved merge', async ({ page }) => {
  await page.goto('./#/new')
  await page.getByLabel('Title').fill('Keyboard import draft')
  await page.getByRole('button', { name: 'Save project' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Keyboard import draft' })).toBeFocused()
  await page.getByRole('button', { name: 'Log session' }).click()
  await page.getByLabel('Words written', { exact: true }).fill('300')
  await page.getByRole('button', { name: 'Log session' }).click()
  await expect(page.locator('.session-list > li')).toHaveCount(1)

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).focus()
  await page.keyboard.press('Enter')
  const stream = await (await download).createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  const backup = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  backup.sessions[0].wordCount = 360

  // Enter on "Import backup" opens the native file picker.
  const importButton = page.getByRole('button', { name: 'Import backup' })
  await importButton.focus()
  const chooser = page.waitForEvent('filechooser')
  await page.keyboard.press('Enter')
  await (await chooser).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })

  const dialog = page.getByRole('dialog', { name: 'Replace or merge?' })
  // The modal focuses its first control: the first choice, which isn't selected by focusing.
  await expect(dialog.getByRole('radio', { name: /Replace all data/ })).toBeFocused()
  await expect(dialog.getByRole('radio', { name: /Replace all data/ })).not.toBeChecked()
  await page.keyboard.press('ArrowDown')
  await expect(dialog.getByRole('radio', { name: /Merge/ })).toBeChecked()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Review conflicts' })).toBeFocused()
  await page.keyboard.press('Enter')

  const keepBackup = page.getByRole('radio', { name: 'Use the backup’s version' })
  await keepBackup.focus()
  await page.keyboard.press('Space')
  await expect(keepBackup).toBeChecked()
  await page.getByRole('button', { name: 'Merge data' }).focus()
  await page.keyboard.press('Enter')

  // Import started from the project page; wait for the move to the dashboard before checking.
  await expect(page.getByRole('heading', { level: 1, name: 'In progress' })).toBeFocused()
  await expect(page.locator('.app-notice-region')).toContainText('kept your choice for 1 conflict')
  await expect(page.getByRole('button', { name: /Keyboard import draft/ })).toContainText('360')
})
