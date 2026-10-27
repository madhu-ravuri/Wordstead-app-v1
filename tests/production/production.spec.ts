import { expect, test, type Page, type Request } from '@playwright/test'

test.use({ timezoneId: 'America/Los_Angeles' })

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime('2026-10-26T12:00:00-07:00')
})

async function createProjectWithSession(page: Page, title: string) {
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Save project' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await page.getByRole('button', { name: 'Log session' }).click()
  await page.getByLabel('Words written', { exact: true }).fill('420')
  await page.getByRole('button', { name: 'Log session' }).click()
  await expect(page.locator('.session-list > li')).toHaveCount(1)
}

test('the production build makes no requests beyond its own static assets', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  const requests: Request[] = []
  const failures: string[] = []
  page.on('request', (request) => requests.push(request))
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`)
  })

  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'In progress' })).toBeVisible()
  await createProjectWithSession(page, 'Network check draft')
  await page.getByRole('button', { name: 'Mark complete' }).click()
  await page.getByRole('button', { name: 'Reopen project' }).click()
  await page.getByRole('button', { name: 'All projects' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  await download

  const external = requests.filter((request) => {
    const url = new URL(request.url())
    return !['blob:', 'data:'].includes(url.protocol) && url.origin !== origin
  })
  expect(external.map((request) => request.url())).toEqual([])
  // Only static asset loads: no API calls, form posts, or analytics beacons.
  expect(requests.filter((request) => request.method() !== 'GET').map((request) => `${request.method()} ${request.url()}`)).toEqual([])
  expect(requests.filter((request) => ['xhr', 'fetch', 'websocket', 'eventsource'].includes(request.resourceType()))).toEqual([])
  expect(failures).toEqual([])
  // Every asset is served from the Pages subpath.
  for (const request of requests.filter((item) => item.url().startsWith(origin))) {
    expect(new URL(request.url()).pathname).toMatch(/^\/Wordstead-app-v1\//)
  }
})

test('a project link opened directly and refreshed loads that project', async ({ page, context }) => {
  await page.goto('./')
  await createProjectWithSession(page, 'Direct link draft')
  const projectUrl = page.url()
  expect(projectUrl).toMatch(/\/Wordstead-app-v1\/#\/project\//)

  const direct = await context.newPage()
  await direct.clock.setFixedTime('2026-10-26T12:00:00-07:00')
  await direct.goto(projectUrl)
  await expect(direct.getByRole('heading', { level: 1, name: 'Direct link draft' })).toBeVisible()
  await expect(direct).toHaveTitle('Direct link draft · Wordstead')
  await direct.reload()
  await expect(direct.getByRole('heading', { level: 1, name: 'Direct link draft' })).toBeVisible()
  await expect(direct.locator('.session-list > li')).toHaveCount(1)
})

test('core workflows keep working offline once the app has loaded', async ({ page, context }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'In progress' })).toBeVisible()
  await context.setOffline(true)

  await createProjectWithSession(page, 'Offline draft')
  await page.getByRole('button', { name: 'Edit session on Oct 26, 2026, 420 words' }).click()
  await page.getByLabel('Words written', { exact: true }).fill('450')
  await page.getByRole('button', { name: 'Save session' }).click()
  await expect(page.locator('.session-list > li')).toContainText('450 words')
  await page.getByRole('button', { name: 'Mark complete' }).click()
  await expect(page.getByText('Completed Oct 26, 2026')).toBeVisible()
  await page.getByRole('button', { name: 'All projects' }).click()
  await expect(page.locator('.completed-list').getByRole('button', { name: /Offline draft/ })).toContainText('450')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  expect((await download).suggestedFilename()).toBe('wordstead-backup-2026-10-26.json')
})

test('the built app uses the bundled fonts and favicon from the subpath', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'In progress' })).toBeVisible()
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts].filter((font) => font.status === 'loaded').map((font) => font.family.replaceAll('"', ''))
  })
  expect(fonts).toEqual(expect.arrayContaining(['Fraunces', 'DM Sans']))
  const icon = await page.locator('link[rel="icon"]').getAttribute('href')
  expect(icon).toBe('/Wordstead-app-v1/wordstead.svg')
})
