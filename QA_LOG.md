# QA Log

## 2026-10-23

- **Phase:** Phase 1
  - **What went wrong:** The interactive Vite scaffold prompt was cancelled after terminal arrow-key input did not select “Ignore files and continue.” No project files were created or removed.
  - **How it was caught:** During scaffold setup in the terminal.
  - **Fix:** Rerun the scaffold with its non-interactive option so it can create the app while preserving existing specification and mockup files.
  - **Spec change needed:** No.

- **Phase:** Phase 1
  - **What went wrong:** The terminal printed a zsh `compinit` insecure-directories warning and aborted completion initialization; subsequent shell commands still executed.
  - **How it was caught:** During scaffold/environment checks and again when starting the Vite dev and preview servers.
  - **Fix:** No app change required; continue with non-interactive commands. The warning did not prevent repository inspection, server startup, or browser checks.
  - **Spec change needed:** No.

- **Phase:** Phase 1
  - **What went wrong:** Vite's non-interactive mode also cancelled because it does not scaffold directly into a non-empty directory, even when existing files are to be kept.
  - **How it was caught:** During scaffold setup in the terminal.
  - **Fix:** Generate the Vite scaffold in an empty temporary directory and copy only its generated files into the repository, preserving the existing spec, plan, mockups, Git metadata, and QA log.
  - **Spec change needed:** No.

- **Phase:** Phase 1
  - **What went wrong:** The temporary scaffold path resolved inside the repository, and the attempted copy did not place scaffold files in the repository root.
  - **How it was caught:** Immediate worktree and generated-file inspection after scaffolding.
  - **Fix:** Copy from the verified generated directory explicitly, then remove only that generated scratch directory.
  - **Spec change needed:** No.

- **Phase:** Phase 1
  - **What went wrong:** Vite used the temporary directory name as the generated package name and HTML page title.
  - **How it was caught:** Review of generated `package.json` and `index.html` before application implementation.
  - **Fix:** Set the package name and page metadata to Wordstead.
  - **Spec change needed:** No.

- **Phase:** Phase 1
  - **What went wrong:** TypeScript inferred the default UUID parameter as a UUID template-literal type, rejecting deterministic string IDs in tests.
  - **How it was caught:** Phase 1 typecheck after adding the IndexedDB repository.
  - **Fix:** Explicitly type the project ID parameter as `string`.
  - **Spec change needed:** No.

- **Phase:** Phase 1
  - **What went wrong:** The unavailable-IndexedDB test found that `idb.openDB` can throw synchronously before its promise rejection handler is attached.
  - **How it was caught:** Automated repository test `src/data/database.test.ts`.
  - **Fix:** Defer `openDB` into a promise chain so synchronous and asynchronous failures are normalized to `StorageError`.
  - **Spec change needed:** No.

- **Phase:** Phase 1
  - **What went wrong:** The first full component suite leaked rendered DOM between tests, causing role queries to find duplicate controls and four assertions to fail.
  - **How it was caught:** Automated test run `npm run test:unit`.
  - **Fix:** Register explicit Testing Library cleanup in the Vitest setup after each test.
  - **Spec change needed:** No.

- **Phase:** Phase 1
  - **What went wrong:** Both Playwright tests failed to launch because the Chromium browser binary was not installed on this machine; application assertions did not run.
  - **How it was caught:** Automated test run `npm run test:e2e -- tests/e2e/projects.spec.ts`.
  - **Fix:** Install the required browser with `npx playwright install chromium`, then rerun the same E2E file.
  - **Spec change needed:** No.

- **Phase:** Phase 1
  - **What went wrong:** Manual dashboard review found visible explanatory copy about chart behavior that belongs in the specification, not the product UI; the empty-state doodle also used a decorative Unicode character.
  - **How it was caught:** Manual browser check against the dashboard visual requirements.
  - **Fix:** Remove the chart explanation and use a Lucide icon for the empty-state accent.
  - **Spec change needed:** No.

- **Phase:** Phase 1
  - **What went wrong:** The integrated browser's generic `:focus` locator timed out during a manual keyboard-sequence probe, making that probe inconclusive despite the page snapshot showing an active form field.
  - **How it was caught:** Manual browser accessibility check.
  - **Fix:** Replace the generic focus probe with deterministic Playwright assertions on each labeled form field and action in tab order.
  - **Spec change needed:** No.

- **Phase:** Phase 1
  - **What went wrong:** The deterministic keyboard test expected one Tab press per control, but Chromium's native date input uses additional Tab stops for its internal date segments.
  - **How it was caught:** Automated Playwright test `project form fields and actions follow a keyboard tab sequence`.
  - **Fix:** Assert that each next control is reachable in logical order while allowing native date-input segment stops.
  - **Spec change needed:** No.

- **Phase:** Phase 1
  - **What went wrong:** The project-detail focus test assumed a project created in another Playwright test would exist, but each test runs in an isolated browser context.
  - **How it was caught:** Automated Playwright test `project detail pencil control receives visible keyboard focus` timed out looking for a project row.
  - **Fix:** Create the required project inside the focus test before checking the pencil control.
  - **Spec change needed:** No.

## 2026-10-23 — Independent Phase 1 verification

Re-ran the full verification contract after a clean `npm ci` (unit 20/20, E2E 4/4, lint, typecheck, build all pass), then walked the Phase 1 manual checklist in Chromium at 1440×900 and 375×740. The issues below were found and resolved with the user's decisions before Phase 2. After the fixes: unit 34/34, E2E 7/7, and lint, typecheck, and build all pass.

- **Phase:** Phase 1
  - **What went wrong:** Malformed starting word counts are saved as 0 with no error. The field is `type="number"`. When the browser can't parse what was typed (for example `1-`, `--5`, `e`), it reports the value as `""`, and `validateProjectForm` treats `""` as "omitted" and defaults it to 0. Separately, `1e3` is accepted and stored as 1,000. This violates §5.2 AC 3, which says invalid input must block saving and show a validation message.
  - **How it was caught:** Manual browser probe, typing each value into the field and pressing Save.
  - **Fix:** The field is now `type="text"` with `inputMode="numeric"`, so the app sees exactly what was typed. `validateProjectForm` accepts digits only (`/^\d+$/` after trimming) and still treats blank as 0. Added unit, component, and E2E cases for `1-`, `--5`, `e`, `1e3`, `0x10`, `+5`, `12abc`, and `1 000`.
  - **Spec change needed:** No.

- **Phase:** Phase 1
  - **What went wrong:** The automated tests don't cover everything the plan specifies. The plan's browser test is "create, reload, verify it remains on the dashboard, open details, edit, verify the changed fields persist". The E2E test reloads on the detail page without ever checking the dashboard list, and it only edits the title and starting count, not deadline, synopsis, or notes. The plan's component test for "project edit prefill/save" checks the title prefill only and never saves.
  - **How it was caught:** Comparing `tests/e2e/projects.spec.ts` and `ProjectDetail.test.tsx` against IMP_PLAN.md Phase 1 "Automated verification".
  - **Fix:** The main E2E test now checks the dashboard row after a reload, then edits and reloads all five fields, confirming each value and that notes render as plain text. Added a `ProjectDetail` component test that checks every field is filled in, saves an edit, and confirms the saved values.
  - **Spec change needed:** No.

- **Phase:** Phase 1
  - **What went wrong:** Notes appear as a separate "Notes" heading and paragraph, not as an aligned metadata row. §5.7 AC 8 and the project-page mockup put last edited, word count, deadline, and notes in the same aligned rows.
  - **How it was caught:** Manual comparison of the detail view against `project page mockup.png`.
  - **Fix:** Notes are now a row in the `project-metadata` list (`dd.metadata-notes`, keeping line breaks and wrapping long text). Removed the separate notes block and its styles.
  - **Spec change needed:** No.

- **Phase:** Phase 1
  - **What went wrong:** The dashboard and detail view depart from the mockups in their composition. Both charts sit inside the cream panel; in the mockups they sit on the coral background beside the panel. The masthead is a small serif wordmark with an icon, where the mockups use large script lettering on a torn notebook-paper tab that overlaps the panel. The `+` and pencil buttons are burgundy, not coral. The pill rows have a tan shadow, not the olive edge and burgundy shadow. The dashboard adds "Your writing desk / In progress" headings that the mockup doesn't have. The checklist item "Check the detail page against the project-page mockup" was ticked anyway. See §5.9 AC 1, 2 and §5.7 AC 6.
  - **How it was caught:** Side-by-side comparison of screenshots with `mockup.png` and `project page mockup.png`.
  - **Fix:** No code change. The user reviewed the screenshots and chose to keep the current "postcard" layout, since the color scheme matches.
  - **Spec change needed:** Yes. Recorded as an approved layout deviation in `SPEC.md` §1, so the Phase 5 mockup comparison keeps this layout.

- **Phase:** Phase 1
  - **What went wrong:** Project order is effectively random and changes after a reload. `listProjects` returns IndexedDB key order (random UUIDs), while a newly created project is appended to the end of the in-memory list. So a new project shows last, then moves somewhere else on the next load.
  - **How it was caught:** Code review of `WordsteadRepository.listProjects` and `App.handleCreate`.
  - **Fix:** Added `getLastEditedAt` and `sortByLastEdited` in `src/domain/projects.ts`. Lists sort by latest edit, then newest creation, then id. Latest edit already counts session log times (§4), so Phase 2 only needs to pass in sessions. Both the active and completed lists use it. Covered by unit tests and an E2E test that edits an older project and confirms the order before and after a reload.
  - **Spec change needed:** Yes. The user chose most recently edited first, recorded as `SPEC.md` §5.7 AC 4a.

- **Phase:** Phase 1
  - **What went wrong:** Minor wording and UI issues. The footer says "Your writing stays in this browser" but doesn't say the data is not synchronized across devices (§5.1 AC 4 asks for both). The edit form shows the eyebrow "A new page", which is meant for new projects. On phone width, long project titles on dashboard rows are cut off with an ellipsis (§5.9 AC 7: no clipped text). The detail view wraps them correctly.
  - **How it was caught:** Manual browser walkthrough and screenshots.
  - **Fix:** The footer now reads "Your writing stays in this browser and isn't synced to other devices". The edit form's eyebrow now reads "Revising the page". Dashboard row titles now wrap instead of being cut off. An E2E test checks a long title at 375px for clipping and sideways scrolling.
  - **Spec change needed:** No.

## 2026-10-23 — Phase 2: Session logging and activity charts

Verification at completion: unit 89/89, E2E 20/20 (stable over three consecutive runs), and lint, typecheck, and build all pass. The plan's targeted Phase 2 commands also pass (35 domain tests, 13 session/chart E2E tests). Manual checklist walked in Chromium at 1440×900 and 375×740 with seeded data; no horizontal overflow.

- **Phase:** Phase 2
  - **What went wrong:** In two component tests and one E2E assertion, my expected chart range was wrong. A project younger than seven days starts its chart at its earliest session, so moving or backdating sessions changes the range length (for example, 17 days instead of 7, or 2 days instead of 3 after a session moved).
  - **How it was caught:** Failing assertions in `ProjectDetail.test.tsx`, plus a manual re-trace of the E2E correction scenario before running it.
  - **Fix:** Corrected the expectations to match §5.4 AC 4. The implementation was already right.
  - **Spec change needed:** No (but see the young-project range question below).

- **Phase:** Phase 2
  - **What went wrong:** E2E lookups for the "Words written" field matched two elements, because the chart's accessible summary also contains "words written".
  - **How it was caught:** Playwright strict-mode violation in five session E2E tests.
  - **Fix:** Use exact label matching for session form fields in E2E tests.
  - **Spec change needed:** No.

- **Phase:** Phase 2
  - **What went wrong:** With the browser clock frozen, sessions logged in a row share an identical log time, so same-day history order (and the dashboard order) fall back to a random ID tie-break. This only happens with a frozen clock; with a real clock the log times differ.
  - **How it was caught:** One E2E assertion on same-day history order failed.
  - **Fix:** That assertion now checks both entries are present instead of their order. Order rules are covered by unit tests with distinct timestamps.
  - **Spec change needed:** No.

- **Phase:** Phase 2
  - **What went wrong:** After deleting a session with the keyboard, focus was lost because the focused row disappeared.
  - **How it was caught:** Writing the keyboard-only E2E test.
  - **Fix:** Focus moves to "Log session" after a successful delete. The keyboard E2E test asserts it.
  - **Spec change needed:** No.

- **Phase:** Phase 2
  - **What went wrong:** A spec rule produces surprising charts. §5.4 AC 4 says a project younger than seven days starts its chart at its earliest session, with no limit. A brand-new project whose existing work was backdated (for example, a session three weeks ago) therefore shows a 21+ day chart, while an 8-day-old project shows only 7 days. In a dashboard row, a long range crowds the stars together.
  - **How it was caught:** Manual review of seeded-data screenshots.
  - **Fix:** The user decided the project chart always caps at 7 days. `getProjectChartRange` now starts at the later of (today − 6) and the earlier of creation/earliest session. Updated the unit, component, and E2E tests, including a backdated session inside the window and one older than it (counted in the total and the overall chart, but outside the project chart).
  - **Spec change needed:** Yes. Updated `SPEC.md` §5.4 AC 4, the §6 backdated-session edge case, and §7 assumption 8.

