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