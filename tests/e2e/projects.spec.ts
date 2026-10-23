import { expect, test } from '@playwright/test'

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
  await expect(page.getByText('1,400')).toBeVisible()
  await expect(page.getByText('A cartographer follows a vanished shoreline.')).toBeVisible()
  await expect(page.getByText('Keep the lighthouse scene quiet.')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Lanterns at Low Tide' })).toBeVisible()
  await expect(page.getByText('1,400')).toBeVisible()

  await page.getByRole('button', { name: 'Edit project' }).click()
  await page.getByLabel('Title').fill('Lanterns at High Tide')
  await page.getByLabel('Starting word count').fill('1800')
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(page.getByRole('heading', { name: 'Lanterns at High Tide' })).toBeVisible()
  await expect(page.getByText('1,800')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Lanterns at High Tide' })).toBeVisible()
  await expect(page.getByText('1,800')).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'Keyboard focus draft' })).toBeVisible()

  const backButton = page.getByRole('button', { name: 'All projects' })
  const editButton = page.getByRole('button', { name: 'Edit project' })
  await backButton.focus()
  await page.keyboard.press('Tab')
  await expect(editButton).toBeFocused()
  await expect(editButton).toHaveCSS('outline-style', 'solid')
})