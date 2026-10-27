import { expect, test, type Page } from '@playwright/test'

test.use({ timezoneId: 'America/Los_Angeles' })

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime('2026-10-23T12:00:00-07:00')
})

async function createProject(page: Page, title: string, startingCount = '') {
  await page.goto('./')
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByLabel('Title').fill(title)
  if (startingCount) await page.getByLabel('Starting word count').fill(startingCount)
  await page.getByRole('button', { name: 'Save project' }).click()
  // Navigation is complete once focus has moved to the new page's heading.
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeFocused()
}

async function logSession(page: Page, words: string, date?: string) {
  await page.getByRole('button', { name: 'Log session' }).click()
  await page.getByLabel('Words written', { exact: true }).fill(words)
  if (date) await page.getByLabel('Date written', { exact: true }).fill(date)
  await page.getByRole('button', { name: 'Log session' }).click()
  await expect(page.locator('.session-form')).toHaveCount(0)
}

function activeList(page: Page) {
  return page.locator('.project-list-column > .project-list')
}

function completedList(page: Page) {
  return page.locator('.completed-list')
}

function overallChart(page: Page) {
  return page.getByRole('img', { name: /^Daily words across all projects/ })
}

function metadataValue(page: Page, term: string) {
  return page.locator('.project-metadata > div').filter({ has: page.getByText(term, { exact: true }) }).locator('dd')
}

async function storedRecords(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ projects: { title: string; deletedAt: string | null }[]; sessions: { wordCount: number }[] }>(
        (resolve, reject) => {
          const request = indexedDB.open('wordstead')
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const database = request.result
            const transaction = database.transaction(['projects', 'sessions'])
            const projects = transaction.objectStore('projects').getAll()
            const sessions = transaction.objectStore('sessions').getAll()
            transaction.oncomplete = () => {
              database.close()
              resolve({ projects: projects.result, sessions: sessions.result })
            }
          }
        },
      ),
  )
}

async function seedTwoProjects(page: Page) {
  await createProject(page, 'Harbor Song', '2000')
  await logSession(page, '400', '2026-10-21')
  await logSession(page, '150')
  await createProject(page, 'Orchard Letters')
  await logSession(page, '90', '2026-10-21')
  await page.getByRole('button', { name: 'All projects' }).click()
  await expect(overallChart(page)).toHaveAccessibleName(/640 words written from Oct 21, 2026 to Oct 23, 2026, on 2 of 3 days/)
}

test('completing a project moves it to Completed without changing totals or history', async ({ page }) => {
  await seedTwoProjects(page)
  const overallBefore = await overallChart(page).getAttribute('aria-label')

  await activeList(page).getByRole('button', { name: /Harbor Song/ }).click()
  await page.getByRole('button', { name: 'Mark complete' }).click()
  await expect(page.getByText('Completed Oct 23, 2026')).toBeVisible()
  await expect(metadataValue(page, 'Word count')).toHaveText('2,550')
  await expect(page.locator('.session-list > li')).toHaveCount(2)

  await page.getByRole('button', { name: 'All projects' }).click()
  await expect(activeList(page).getByRole('button', { name: /Harbor Song/ })).toHaveCount(0)
  const completedRow = completedList(page).getByRole('button', { name: /Harbor Song/ })
  await expect(completedRow).toContainText('2,550')
  await expect(completedRow.locator('.chart-marker')).toHaveCount(2)
  await expect(page.getByRole('heading', { name: 'Completed' }).locator('..')).toContainText('1')
  await expect(overallChart(page)).toHaveAttribute('aria-label', overallBefore!)

  await page.reload()
  await expect(completedList(page).getByRole('button', { name: /Harbor Song/ })).toBeVisible()
  await expect(overallChart(page)).toHaveAttribute('aria-label', overallBefore!)
})

test('a completed project must be reopened before logging or changing sessions, and reopening adds no activity', async ({ page }) => {
  await seedTwoProjects(page)
  const overallBefore = await overallChart(page).getAttribute('aria-label')

  await activeList(page).getByRole('button', { name: /Orchard Letters/ }).click()
  await page.getByRole('button', { name: 'Mark complete' }).click()
  await expect(page.getByRole('button', { name: 'Log session' })).toHaveCount(0)
  await expect(page.getByText('This project is complete. Reopen it to log, correct, or delete sessions.')).toBeVisible()

  // Completed projects' sessions are read-only: no corrections or deletions until reopened.
  await expect(page.locator('.session-list > li')).toHaveCount(1)
  await expect(page.getByRole('button', { name: /^Edit session/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Delete session/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Reopen project' }).click()
  await expect(page.getByText(/^Completed /)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Log session' })).toBeVisible()
  await expect(page.locator('.session-list > li')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Edit session on Oct 21, 2026, 90 words' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete session on Oct 21, 2026, 90 words' })).toBeVisible()

  await page.getByRole('button', { name: 'All projects' }).click()
  await expect(activeList(page).getByRole('button', { name: /Orchard Letters/ })).toBeVisible()
  await expect(completedList(page)).toHaveCount(0)
  await expect(page.getByText('Finished projects will gather here.')).toBeVisible()
  await expect(overallChart(page)).toHaveAttribute('aria-label', overallBefore!)

  await page.reload()
  await expect(activeList(page).getByRole('button', { name: /Orchard Letters/ })).toBeVisible()
})

test('cancelling deletion, by button or Escape, changes nothing', async ({ page }) => {
  await seedTwoProjects(page)
  const before = await storedRecords(page)

  await activeList(page).getByRole('button', { name: /Harbor Song/ }).click()
  await page.getByRole('button', { name: 'Delete project' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete “Harbor Song”?' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Its 2 writing sessions (550 words) will stay in your overall daily chart and in your backup data.')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)

  await page.getByRole('button', { name: 'Delete project' }).click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete project' })).toBeVisible()

  expect(await storedRecords(page)).toEqual(before)
  await page.getByRole('button', { name: 'All projects' }).click()
  await expect(activeList(page).getByRole('button', { name: /Harbor Song/ })).toBeVisible()
})

test('confirming deletion hides the project but keeps its records and overall history', async ({ page }) => {
  await seedTwoProjects(page)
  const overallBefore = await overallChart(page).getAttribute('aria-label')

  await activeList(page).getByRole('button', { name: /Harbor Song/ }).click()
  const projectUrl = page.url()
  await page.getByRole('button', { name: 'Delete project' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete project' }).click()

  await expect(page.getByRole('heading', { name: 'In progress' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText(
    'Deleted “Harbor Song”. Its writing sessions still count in your overall daily words.',
  )
  await expect(page.getByRole('button', { name: /Harbor Song/ })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Projects', exact: true }).locator('..')).toContainText('1')
  await expect(overallChart(page)).toHaveAttribute('aria-label', overallBefore!)

  const stored = await storedRecords(page)
  expect(stored.projects.find((project) => project.title === 'Harbor Song')?.deletedAt).toBeTruthy()
  expect(stored.sessions.map((session) => session.wordCount).sort((a, b) => a - b)).toEqual([90, 150, 400])

  await page.reload()
  await expect(page.getByRole('button', { name: /Harbor Song/ })).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveText('')
  await expect(overallChart(page)).toHaveAttribute('aria-label', overallBefore!)

  await page.goto(projectUrl)
  await expect(page.getByRole('heading', { name: 'Project not found' })).toBeVisible()
})

test('a completed project can be deleted and disappears from the Completed section', async ({ page }) => {
  await seedTwoProjects(page)
  const overallBefore = await overallChart(page).getAttribute('aria-label')

  await activeList(page).getByRole('button', { name: /Orchard Letters/ }).click()
  await page.getByRole('button', { name: 'Mark complete' }).click()
  await expect(page.getByText('Completed Oct 23, 2026')).toBeVisible()
  await page.getByRole('button', { name: 'Delete project' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete project' }).click()

  await expect(page.getByText('Finished projects will gather here.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Orchard Letters/ })).toHaveCount(0)
  await expect(overallChart(page)).toHaveAttribute('aria-label', overallBefore!)
})

test('the delete dialog keeps keyboard focus inside until it closes', async ({ page }) => {
  await createProject(page, 'Focus draft')
  const trigger = page.getByRole('button', { name: 'Delete project' })
  await trigger.focus()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'Delete “Focus draft”?' })
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  // The page behind a modal dialog is inert: Tab cycles through the dialog and the browser's
  // own UI (reported as <body>), never reaching page content.
  const visited = new Set<string>()
  for (let press = 0; press < 6; press += 1) {
    await page.keyboard.press('Tab')
    const focus = await dialog.evaluate((element) => {
      const active = document.activeElement
      if (!active || active === document.body) return 'browser'
      return element.contains(active) ? `dialog:${active.textContent}` : `page:${active.textContent}`
    })
    expect(focus).not.toMatch(/^page:/)
    visited.add(focus)
  }
  expect(visited).toContain('dialog:Delete project')
  expect(visited).toContain('dialog:Cancel')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('lifecycle controls and the dialog fit a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 })
  await createProject(page, 'A long-titled phone project that needs to wrap inside the dialog')
  await page.getByRole('button', { name: 'Mark complete' }).click()
  await page.getByRole('button', { name: 'Delete project' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  const box = (await dialog.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(375)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
})

test('the completed badge sits on its own line above the title at every width', async ({ page }) => {
  await createProject(page, 'Badge placement draft')
  await page.getByRole('button', { name: 'Mark complete' }).click()
  const badge = page.getByText('Completed Oct 23, 2026')
  const title = page.getByRole('heading', { level: 1, name: 'Badge placement draft' })
  await expect(badge).toBeVisible()

  for (const width of [1440, 1024, 375]) {
    await page.setViewportSize({ width, height: 900 })
    const badgeBox = (await badge.boundingBox())!
    const titleBox = (await title.boundingBox())!
    expect(badgeBox.y + badgeBox.height).toBeLessThanOrEqual(titleBox.y)
    expect(Math.abs(badgeBox.x - titleBox.x)).toBeLessThan(2)
  }
})
