import { expect, test, type Page } from '@playwright/test'

// Every test runs with a pinned browser clock and time zone so "today" is deterministic.
test.use({ timezoneId: 'America/Los_Angeles' })

const TODAY_NOON = '2026-10-23T12:00:00-07:00'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY_NOON)
})

async function createProject(page: Page, title: string, startingCount = '') {
  await page.goto('./')
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByLabel('Title').fill(title)
  if (startingCount) await page.getByLabel('Starting word count').fill(startingCount)
  await page.getByRole('button', { name: 'Save project' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
}

async function logSession(page: Page, words: string, date?: string) {
  await page.getByRole('button', { name: 'Log session' }).click()
  await page.getByLabel('Words written', { exact: true }).fill(words)
  if (date) await page.getByLabel('Date written', { exact: true }).fill(date)
  await page.getByRole('button', { name: 'Log session' }).click()
  await expect(page.locator('.session-form')).toHaveCount(0)
}

function metadataValue(page: Page, term: string) {
  return page.locator('.project-metadata > div').filter({ has: page.getByText(term, { exact: true }) }).locator('dd')
}

function sessionStatus(page: Page) {
  return page.locator('.session-history').getByRole('status')
}

function sessionEntries(page: Page) {
  return page.locator('.session-list > li')
}

function detailChart(page: Page) {
  return page.getByRole('img', { name: /^Daily words for / })
}

function overallChart(page: Page) {
  return page.getByRole('img', { name: /^Daily words across all projects/ })
}

test('validates session counts and allows project totals above 1,000,000', async ({ page }) => {
  await createProject(page, 'Boundary draft')

  await page.getByRole('button', { name: 'Log session' }).click()
  for (const value of ['0', '-5', '1.5', '1000001', '']) {
    await page.getByLabel('Words written', { exact: true }).fill(value)
    await page.getByRole('button', { name: 'Log session' }).click()
    await expect(page.locator('.session-form .form-error')).toBeVisible()
  }
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(sessionEntries(page)).toHaveCount(0)

  await logSession(page, '1')
  await logSession(page, '1000000')
  await expect(sessionEntries(page)).toHaveCount(2)
  await expect(metadataValue(page, 'Word count')).toHaveText('1,000,001')
})

test('same-day sessions stay separate in history but form one summed point with one star', async ({ page }) => {
  await createProject(page, 'Same day draft', '2000')
  await logSession(page, '300')
  await logSession(page, '450')

  await expect(sessionEntries(page)).toHaveCount(2)
  // The clock is frozen, so both share a log time; assert content rather than order.
  await expect(sessionEntries(page).filter({ hasText: '450 words' })).toHaveCount(1)
  await expect(sessionEntries(page).filter({ hasText: '300 words' })).toHaveCount(1)
  await expect(metadataValue(page, 'Word count')).toHaveText('2,750')
  await expect(detailChart(page)).toHaveAccessibleName(/750 words written on Oct 23, 2026, on 1 of 1 day\./)
  await expect(page.locator('.activity-chart-detail .chart-marker')).toHaveCount(1)

  await page.reload()
  await expect(sessionEntries(page)).toHaveCount(2)
  await page.getByRole('button', { name: 'All projects' }).click()
  const row = page.getByRole('button', { name: /Same day draft/ })
  await expect(row).toContainText('2,750')
  await expect(row.locator('.chart-marker')).toHaveCount(1)
  await expect(overallChart(page)).toHaveAccessibleName(/750 words written on Oct 23, 2026/)
})

test('starting counts add to the total but never create chart activity', async ({ page }) => {
  await createProject(page, 'Imported manuscript', '50000')

  await expect(metadataValue(page, 'Word count')).toHaveText('50,000')
  await expect(detailChart(page)).toHaveAccessibleName(/No writing sessions on Oct 23, 2026\./)
  await expect(page.locator('.activity-chart-detail .chart-marker')).toHaveCount(0)

  await page.getByRole('button', { name: 'All projects' }).click()
  await expect(page.getByRole('img', { name: 'No writing sessions recorded yet' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Imported manuscript/ }).locator('.chart-marker')).toHaveCount(0)
})

test('the overall chart sums sessions across projects while project charts stay separate', async ({ page }) => {
  await createProject(page, 'Novel')
  await logSession(page, '500')
  await createProject(page, 'Short story')
  await logSession(page, '125')
  await expect(detailChart(page)).toHaveAccessibleName(/125 words written/)

  await page.getByRole('button', { name: 'All projects' }).click()
  await expect(overallChart(page)).toHaveAccessibleName(/625 words written on Oct 23, 2026/)
  await expect(page.getByRole('button', { name: /^Novel/ })).toHaveAccessibleName(/500 words written/)
  await expect(page.getByRole('button', { name: /^Short story/ })).toHaveAccessibleName(/125 words written/)
})

test('correcting and deleting a session recalculates totals and charts', async ({ page }) => {
  await createProject(page, 'Revision draft', '1000')
  await logSession(page, '200', '2026-10-21')
  await logSession(page, '300', '2026-10-22')
  await createProject(page, 'Other project')
  await logSession(page, '40', '2026-10-21')

  await page.getByRole('button', { name: 'All projects' }).click()
  await expect(overallChart(page)).toHaveAccessibleName(/540 words written from Oct 21, 2026 to Oct 23, 2026, on 2 of 3 days/)

  await page.getByRole('button', { name: /Revision draft/ }).click()
  await page.getByRole('button', { name: 'Edit session on Oct 21, 2026, 200 words' }).click()
  await page.getByLabel('Words written', { exact: true }).fill('260')
  await page.getByLabel('Date written', { exact: true }).fill('2026-10-23')
  await page.getByRole('button', { name: 'Save session' }).click()
  await expect(sessionStatus(page)).toContainText('Updated the session to 260 words on Oct 23, 2026.')

  await expect(metadataValue(page, 'Word count')).toHaveText('1,560')
  // The earliest session is now Oct 22, so this young project's range starts there.
  await expect(detailChart(page)).toHaveAccessibleName(/560 words written from Oct 22, 2026 to Oct 23, 2026, on 2 of 2 days/)
  await expect(page.locator('.activity-chart-detail .chart-marker')).toHaveCount(2)

  await page.getByRole('button', { name: 'Delete session on Oct 22, 2026, 300 words' }).click()
  await page.getByRole('button', { name: 'Keep' }).click()
  await expect(sessionEntries(page)).toHaveCount(2)
  await page.getByRole('button', { name: 'Delete session on Oct 22, 2026, 300 words' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(sessionEntries(page)).toHaveCount(1)

  await expect(metadataValue(page, 'Word count')).toHaveText('1,260')
  await expect(page.locator('.activity-chart-detail .chart-marker')).toHaveCount(1)
  await expect(page.locator('.activity-chart-detail .chart-marker[data-date="2026-10-23"]')).toHaveCount(1)
  await expect(detailChart(page)).toHaveAccessibleName(/260 words written on Oct 23, 2026/)

  await page.reload()
  await page.getByRole('button', { name: 'All projects' }).click()
  // Oct 21 keeps the other project's 40 words; Oct 22 is now zero; Oct 23 has 260.
  await expect(overallChart(page)).toHaveAccessibleName(/300 words written from Oct 21, 2026 to Oct 23, 2026, on 2 of 3 days/)
})

test('a forgotten past session is logged on its own date within the seven-day project cap', async ({ page }) => {
  await createProject(page, 'Late entry draft')
  await logSession(page, '250', '2026-10-20')

  // The young project's chart now starts at the backdated session.
  await expect(detailChart(page)).toHaveAccessibleName(/250 words written from Oct 20, 2026 to Oct 23, 2026, on 1 of 4 days/)

  await logSession(page, '700', '2026-10-12')
  await expect(sessionEntries(page).last()).toContainText('Oct 12, 2026')
  // Logged today, so "date last edited" stays today rather than the activity date.
  await expect(metadataValue(page, 'Date last edited')).toHaveText('Oct 23, 2026')
  await expect(metadataValue(page, 'Word count')).toHaveText('950')
  // Older than the window: counted in the total but outside the capped 7-day chart.
  await expect(detailChart(page)).toHaveAccessibleName(/250 words written from Oct 17, 2026 to Oct 23, 2026, on 1 of 7 days/)

  await page.getByRole('button', { name: 'All projects' }).click()
  await expect(overallChart(page)).toHaveAccessibleName(/950 words written from Oct 12, 2026 to Oct 23, 2026, on 2 of 12 days/)
})

test('future session dates are unavailable and rejected', async ({ page }) => {
  await createProject(page, 'Future draft')
  await page.getByRole('button', { name: 'Log session' }).click()
  await expect(page.getByLabel('Date written', { exact: true })).toHaveValue('2026-10-23')
  await expect(page.getByLabel('Date written', { exact: true })).toHaveAttribute('max', '2026-10-23')

  await page.getByLabel('Words written', { exact: true }).fill('100')
  await page.getByLabel('Date written', { exact: true }).fill('2026-10-24')
  await page.getByRole('button', { name: 'Log session' }).click()
  await expect(page.getByText('Choose today or an earlier date.')).toBeVisible()

  await page.reload()
  await expect(page.getByText(/No sessions recorded yet/)).toBeVisible()
})

test('project and overall windows follow their 7-day and 30-day rules with zero days', async ({ page }) => {
  await page.clock.setFixedTime('2026-09-01T12:00:00-07:00')
  await createProject(page, 'Long-running draft')
  await logSession(page, '900', '2026-09-01')

  await page.clock.setFixedTime(TODAY_NOON)
  await page.reload()
  await page.getByRole('button', { name: 'Edit project' }).waitFor()
  await logSession(page, '120', '2026-10-20')

  await expect(detailChart(page)).toHaveAccessibleName(/from Oct 17, 2026 to Oct 23, 2026, on 1 of 7 days/)
  await page.getByRole('button', { name: 'All projects' }).click()
  await expect(overallChart(page)).toHaveAccessibleName(/120 words written from Sep 24, 2026 to Oct 23, 2026, on 1 of 30 days/)
  await expect(page.locator('.activity-chart-overall .chart-marker')).toHaveCount(1)
})

test('chart geometry follows actual counts', async ({ page }) => {
  await createProject(page, 'Shape draft')
  await logSession(page, '100', '2026-10-20')
  await logSession(page, '400', '2026-10-21')
  await logSession(page, '200', '2026-10-22')

  const markerY = async (date: string) =>
    page.locator(`.activity-chart-detail .chart-marker[data-date="${date}"]`).evaluate((marker) => {
      const box = (marker as SVGGraphicsElement).getBBox()
      return box.y + box.height / 2
    })
  const [low, high, middle] = [await markerY('2026-10-20'), await markerY('2026-10-21'), await markerY('2026-10-22')]
  // SVG y grows downward: higher counts sit higher on the chart.
  expect(high).toBeLessThan(middle)
  expect(middle).toBeLessThan(low)
})

test.describe('daylight saving time', () => {
  test.use({ timezoneId: 'America/New_York' })

  test('a session logged late on the 25-hour DST day stays on that local date', async ({ page }) => {
    // 23:30 EST on Nov 1, 2026 (DST ended at 02:00 that morning) is already Nov 2 in UTC.
    await page.clock.setFixedTime('2026-11-02T04:30:00Z')
    await createProject(page, 'Fall back draft')
    await page.getByRole('button', { name: 'Log session' }).click()
    await expect(page.getByLabel('Date written', { exact: true })).toHaveValue('2026-11-01')
    await page.getByLabel('Words written', { exact: true }).fill('333')
    await page.getByRole('button', { name: 'Log session' }).click()

    await expect(sessionEntries(page).first()).toContainText('Nov 1, 2026')
    await expect(detailChart(page)).toHaveAccessibleName(/333 words written on Nov 1, 2026/)

    await page.clock.setFixedTime('2026-11-02T17:00:00Z')
    await page.reload()
    await expect(sessionEntries(page).first()).toContainText('Nov 1, 2026')
    await expect(detailChart(page)).toHaveAccessibleName(/333 words written from Nov 1, 2026 to Nov 2, 2026, on 1 of 2 days/)
  })
})

test.describe('time zone ahead of UTC', () => {
  test.use({ timezoneId: 'Asia/Tokyo' })

  test('defaults to the local date, not the UTC date', async ({ page }) => {
    // 16:30 UTC on Oct 23 is 01:30 on Oct 24 in Tokyo.
    await page.clock.setFixedTime('2026-10-23T16:30:00Z')
    await createProject(page, 'Tokyo draft')
    await page.getByRole('button', { name: 'Log session' }).click()
    await expect(page.getByLabel('Date written', { exact: true })).toHaveValue('2026-10-24')
    await expect(page.getByLabel('Date written', { exact: true })).toHaveAttribute('max', '2026-10-24')
  })
})

test('session history and charts fit a phone viewport without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 })
  await createProject(page, 'Phone draft with a long working title that wraps')
  await logSession(page, '1000000', '2026-10-20')
  await logSession(page, '25')

  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(await overflow()).toBeLessThanOrEqual(0)
  await page.getByRole('button', { name: 'Edit session on Oct 20, 2026, 1,000,000 words' }).click()
  expect(await overflow()).toBeLessThanOrEqual(0)
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: 'All projects' }).click()
  await expect(overallChart(page)).toBeVisible()
  expect(await overflow()).toBeLessThanOrEqual(0)
})

test('sessions can be logged, corrected, and deleted with the keyboard alone', async ({ page }) => {
  await createProject(page, 'Keyboard draft')
  const logButton = page.getByRole('button', { name: 'Log session' })
  await logButton.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Words written', { exact: true })).toBeFocused()
  await page.keyboard.type('410')
  await page.keyboard.press('Enter')
  await expect(sessionEntries(page)).toHaveCount(1)
  await expect(logButton).toBeFocused()

  await page.getByRole('button', { name: 'Edit session on Oct 23, 2026, 410 words' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Words written', { exact: true })).toBeFocused()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('415')
  await page.keyboard.press('Enter')
  await expect(sessionEntries(page).first()).toContainText('415 words')

  const deleteButton = page.getByRole('button', { name: 'Delete session on Oct 23, 2026, 415 words' })
  await deleteButton.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Keep' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(sessionEntries(page)).toHaveCount(0)
  await expect(sessionStatus(page)).toHaveText('Deleted the Oct 23, 2026 session.')
  await expect(logButton).toBeFocused()
})

test('phones stack the overall chart, then the desk heading, then projects; desktop keeps the chart to the right', async ({ page }) => {
  await createProject(page, 'Layout draft')
  await logSession(page, '300')
  await page.getByRole('button', { name: 'All projects' }).click()

  const box = async (locator: ReturnType<Page['locator']>) => (await locator.boundingBox())!
  const chart = overallChart(page)
  const deskHeading = page.getByRole('heading', { name: 'In progress' })
  const createButton = page.getByRole('button', { name: 'New project' })
  const projectsHeading = page.getByRole('heading', { name: 'Projects', exact: true })

  await page.setViewportSize({ width: 375, height: 740 })
  const phoneChart = await box(chart)
  const phoneDesk = await box(deskHeading)
  expect(phoneChart.y + phoneChart.height).toBeLessThan(phoneDesk.y)
  expect((await box(createButton)).y).toBeGreaterThan(phoneChart.y + phoneChart.height)
  expect(phoneDesk.y + phoneDesk.height).toBeLessThan((await box(projectsHeading)).y)

  await page.setViewportSize({ width: 1440, height: 900 })
  const desk = await box(deskHeading)
  const projects = await box(projectsHeading)
  const daily = await box(page.getByRole('heading', { name: 'Daily words' }))
  expect(desk.y + desk.height).toBeLessThan(daily.y)
  expect(desk.y + desk.height).toBeLessThan(projects.y)
  expect(daily.x).toBeGreaterThan(projects.x + projects.width)
})

test('project rows stack a full-width title, then sparkline and count, then a full-width edit date', async ({ page }) => {
  await createProject(page, 'Row layout draft with a fairly long working title', '1200')
  await logSession(page, '300', '2026-10-21')
  await page.getByRole('button', { name: 'All projects' }).click()

  const row = page.locator('.project-row').first()
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 })
    const [rowBox, title, spark, count, date] = await Promise.all(
      [row, row.locator('.project-row-title'), row.locator('.activity-chart-row'), row.locator('.project-row-count'), row.locator('.project-row-date')].map(
        async (locator) => (await locator.boundingBox())!,
      ),
    )
    expect(title.y + title.height).toBeLessThanOrEqual(spark.y)
    expect(title.y + title.height).toBeLessThanOrEqual(count.y)
    expect(spark.y + spark.height).toBeLessThanOrEqual(date.y)
    expect(count.y + count.height).toBeLessThanOrEqual(date.y)
    // Title and date bands span the row's content width, not a narrow column.
    expect(title.width).toBeGreaterThan(rowBox.width * 0.7)
    expect(date.width).toBeGreaterThan(rowBox.width * 0.7)
  }
})

test('Log session sits in the top toolbar beside the edit button on desktop and phone', async ({ page }) => {
  await createProject(page, 'Toolbar draft')
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 800 })
    const log = (await page.getByRole('button', { name: 'Log session' }).boundingBox())!
    const edit = (await page.getByRole('button', { name: 'Edit project' }).boundingBox())!
    const heading = (await page.getByRole('heading', { name: 'Toolbar draft' }).boundingBox())!
    expect(log.x + log.width).toBeLessThanOrEqual(edit.x)
    expect(Math.abs(log.y + log.height / 2 - (edit.y + edit.height / 2))).toBeLessThan(4)
    expect(log.y + log.height).toBeLessThan(heading.y)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
})
