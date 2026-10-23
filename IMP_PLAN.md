# Wordstead Implementation Plan

## Specification Gaps and Proposed Changes

Gaps 1-5 are resolved by the user's decisions below and recorded in `SPEC.md`.

1. **RESOLVED: Backdated sessions and “date last edited”** — A session logged on October 15 for October 10 contributes its words to October 10 activity, while “Date last edited” uses October 15. The display compares the local calendar date of the latest project-field/status edit with the latest session log date (`createdAt`); correcting a session does not reset its log date, and deleting it removes it from the comparison. Recorded in `SPEC.md` §4, §5.4 AC 8, and §7.3.
2. **RESOLVED: Project-detail chart bars** — Bars are purely decorative in the initial version; the project daily activity line and star markers are the only data. Future versions may explore encoding real data in those bars. Recorded in `SPEC.md` §5.7 AC 9 and §8.
3. **RESOLVED: Future-dated sessions** — Users cannot select or save a session date later than the current local date. Recorded in `SPEC.md` §5.3 AC 2 and §6.
4. **RESOLVED: Duplicate identifiers in imports** — Project and session IDs must each be unique within a backup file; any duplicate within that file invalidates it. During merge, collisions between a valid imported file and existing records follow §5.8 AC 6: identical records deduplicate and differing content requires a user choice. Recorded in `SPEC.md` §5.8 AC 3, 6 and §6.
5. **RESOLVED: Maximum word-count value** — Each entered starting count and individual session count must be an integer from 0/1 through 1,000,000 inclusive, respectively. A derived project total may exceed 1,000,000 because it sums entries. Recorded in `SPEC.md` §4, §5.2 AC 3, and §5.3 AC 3.

## Delivery Approach

Build a small React + TypeScript static application with Vite, IndexedDB persistence, versioned JSON backups, Vitest for domain/data tests, React Testing Library for component behavior, and Playwright for browser workflows. Keep totals, date bucketing, chart-series generation, and import merge rules in pure or isolated modules so they can be exhaustively tested without rendering the UI. Use bundled assets and client-side storage only; no runtime API or analytics service.

Use hash-based navigation or an equivalent GitHub Pages-safe route strategy so a project detail link does not require server rewrite support. Each phase ends with a runnable, buildable app that preserves the complete working functionality of earlier phases. Do not begin any implementation until the user approves this plan and resolves the spec questions that affect the behavior.

### Verification command contract

From the repository root, Phase 1 establishes these npm scripts and keeps them available in every later phase:

```sh
npm ci
npx playwright install chromium
npm run test:unit
npm run test:e2e
npm run lint
npm run typecheck
npm run build
```

`test:unit` runs Vitest once; `test:e2e` runs Playwright against the local built app or its managed dev server; `lint`, `typecheck`, and `build` run ESLint, TypeScript, and Vite respectively. File-targeted commands below use the same scripts with Vitest/Playwright paths after the corresponding tests are added. Run the browser-install command once per machine/CI image as needed.

## Phase 1: Usable Project Tracker

**Outcome:** A deployable, responsive app in which a user can create, view, edit, and persist projects. It includes the dashboard and project-detail visual shells, but no session logging yet. Existing project data survives reloads. The app remains useful at this milestone rather than being only a configured toolchain.

### Tasks

1. Scaffold Vite + React + TypeScript; add Vitest, Testing Library, Playwright, ESLint, and scripts named in the verification contract. Configure static output and GitHub Pages-safe navigation. **Traceability:** §1; §5.1 AC 1, 4; §5.9 AC 6, 7.
2. Define versioned Project/Session types and IndexedDB schema/repository boundaries, including upgrade handling and non-destructive storage errors. Create both stores even though session UI arrives in Phase 2. **Traceability:** §4; §5.1 AC 1, 2, 3.
3. Implement project validation and create/edit operations: trimmed required title, optional fields, default starting count, integer range 0-1,000,000 inclusive, and timestamps/status metadata. **Traceability:** §4 Project; §5.2 AC 2-8.
4. Build the dashboard shell and active/completed list sections against `mockup.png`, including the `+` action and useful empty states. Show each created project's title and starting-count total. **Traceability:** §3 stories 1, 2, 10; §5.2 AC 1, 6; §5.7 AC 4, 5; §5.9 AC 1-3.
5. Build the project detail shell against `project page mockup.png`: masthead, paper panel, title pill, synopsis and metadata, accessible pencil edit button, and an empty session-history state. **Traceability:** §5.7 AC 1, 3, 5-8, 10; §5.9 AC 4-7.
6. Add responsive layout and keyboard/focus/label behavior for the implemented forms and controls. **Traceability:** §5.9 AC 5-7.

### Automated verification

- Unit tests: project title trimming/blank rejection, optional defaults, starting-count boundaries (0 and 1,000,000 accepted; negative, fractional, and 1,000,001 rejected), metadata updates on edit, and total equal to starting count when there are no sessions. Verify derived totals may exceed 1,000,000 through session accumulation. Add IndexedDB repository tests for initial empty state, persistence after reopening the database, and storage errors.
- Component tests: create form validation and submission, project edit prefill/save, dashboard empty state, and project-detail empty state/edit button accessible name.
- Browser test: create a project, reload, verify it remains on the dashboard, open details, edit it, and verify the changed fields persist.

Commands:

```sh
npm run test:unit
npm run test:e2e -- tests/e2e/projects.spec.ts
npm run lint
npm run typecheck
npm run build
```

### Manual completion checklist

- [x] Open the empty dashboard and create a project from `+`. **§5.2 AC 1, 6; §5.9 AC 3**
- [x] Try a whitespace-only title and invalid/negative/fractional/1,000,001 starting counts; confirm saving is blocked. Confirm 0 and 1,000,000 are accepted. **§5.2 AC 3, 4**
- [x] Create a project with omitted count and another with a nonzero count; confirm totals start at zero and the entered value respectively. **§5.2 AC 2, 3, 6**
- [x] Edit title, starting count, deadline, synopsis, and notes; confirm values persist after reload and notes are plain text. **§5.2 AC 5, 7, 8; §5.1 AC 2**
- [x] Check the detail page against the project-page mockup, including pencil control, information hierarchy, focus state, and no-session state. **§5.7 AC 1, 5-8, 10**
- [x] Resize to phone width and verify the implemented dashboard, form, and detail view do not horizontally overflow. **§5.9 AC 5, 7**

## Phase 2: Session Logging and Accurate Activity Charts

**Outcome:** A user can record, edit, and delete sessions and see correct project totals, project sparklines, and the overall daily-activity chart. This is the first complete writing-tracking workflow.

### Tasks

1. Implement date-only local calendar utilities and session validation/persistence. Default new sessions to today; enforce the approved future-date rule. Keep date parsing and formatting independent from UTC timestamp conversion. **Traceability:** §4 Writing session; §5.1 AC 3; §5.3 AC 1-4, 8.
2. Implement pure selectors for project totals, project daily totals, and overall daily totals across project IDs. Starting counts affect project totals only. **Traceability:** §4 Derived values; §5.3 AC 5-7; §5.4 AC 1-5; §5.5 AC 1-4.
3. Implement individual session history, add/edit/delete flows, validation feedback, and immediate recalculation after each mutation. **Traceability:** §3 stories 3, 4; §5.3 AC 1-7; §5.7 AC 2, 3, 10.
4. Generate chart series with explicit date/value/activity points. Apply seven-day project and 30-day overall windows, new-project/early-activity range rules, zero-filled days, and one star per date with at least one session. **Traceability:** §5.4 AC 3-7; §5.5 AC 1-7; §5.7 AC 9.
5. Render responsive lightweight SVG line charts. Use the project's line/star-marker rules in project sparklines and dashboard rows. On the dashboard, keep its decorative bars subdued and non-data-bearing. **Traceability:** §5.4 AC 6, 7; §5.5 AC 5, 7; §5.7 AC 6, 9; §5.9 AC 1, 2, 5-7.
6. Add an accessible no-session chart state and non-color chart description. **Traceability:** §5.5 AC 7; §5.9 AC 6.

### Automated verification

- Unit-test exact arithmetic: starting count plus sessions; sessions across multiple dates; multiple sessions on one project/date; overall daily sum across multiple projects; starting counts excluded from both chart selectors; 1 and 1,000,000 accepted as session counts, while 0, negative, fractional, and 1,000,001 are rejected. Verify accumulated project totals may exceed 1,000,000.
- Unit-test session edits that change count and/or date, and deletion of one of multiple same-day sessions and the last session on a day. Assert project total, project daily series, and overall daily series after each mutation.
- Unit-test sparkline selectors for current date plus six/29 prior days, young-project range including a session earlier than creation, overall start at earliest session when under 30 days, zero-filled days, no-session state, and exactly one activity marker for a date with multiple sessions.
- Unit-test daylight-saving boundaries and date-only import/round-trip utility behavior under representative timezone IDs; add Playwright contexts with a configured timezone for local-date UI checks.
- Unit-test that a future local calendar date is rejected while today's date and past dates remain valid; verify the date field does not offer future dates and invalid submission creates no record.
- Component/browser-test session validation, late entry, correction, and chart labels/accessible descriptions.

Commands:

```sh
npm run test:unit -- src/domain/projectTotals.test.ts src/domain/dailyActivity.test.ts src/domain/sessions.test.ts src/domain/sparkline.test.ts
npm run test:e2e -- tests/e2e/sessions-and-charts.spec.ts
npm run lint
npm run typecheck
npm run build
```

### Manual completion checklist

- [ ] Verify session counts of 1 and 1,000,000 are accepted and 0, negative, fractional, or 1,000,001 are rejected; confirm project totals can exceed 1,000,000 through accumulation. **§5.3 AC 3, 5; §5.4 AC 2**
- [ ] Log two sessions for one project on the same date; verify separate history rows, a summed daily point, and one star. **§5.3 AC 4, 5, 7; §5.4 AC 3, 6**
- [ ] Verify a starting count contributes to the project total but not either chart or activity markers. **§5.2 AC 6; §5.4 AC 2, 5; §5.5 AC 4**
- [ ] Log sessions on two projects for the same date; verify the overall point is their sum and each project point remains project-specific. **§5.4 AC 3; §5.5 AC 1, 3**
- [ ] Edit a session's count and date, then delete it; verify affected totals/points change and unaffected dates/projects do not. **§5.3 AC 5-7; §5.5 AC 6**
- [ ] Enter a forgotten session for a past date and inspect the resulting range/point. **§5.3 AC 2; §5.4 AC 4; §5.5 AC 2**
- [ ] Attempt to select and submit a future session date; verify it is unavailable or rejected and no session is saved. **§5.3 AC 2; §6**
- [ ] Confirm zero days are present, the project and overall chart windows follow their date rules, and chart geometry follows actual counts. **§5.4 AC 3, 4, 7; §5.5 AC 2, 3**
- [ ] Confirm the dashboard bars look decorative and do not imply a second series; inspect chart meaning with keyboard/screen-reader-accessible text. **§5.5 AC 5, 7; §5.9 AC 6**

## Phase 3: Completion, Reopening, and Retained Deletion History

**Outcome:** Active and completed work are distinct, projects can be reopened, and deleting a project does not erase historical overall activity. The app is now complete for the core project lifecycle.

### Tasks

1. Implement completion/reopen state transitions and completed-project navigation. Require reopening before logging sessions to a completed project, per §7.4. **Traceability:** §4 Project; §5.6 AC 1-4; §5.7 AC 3-5.
2. Implement project soft deletion with a project-specific confirmation dialog. Retain the project and sessions in IndexedDB and remove the project from active/completed UI. **Traceability:** §4 Project and Derived values; §5.6 AC 5-7; §5.3 AC 8.
3. Update overall activity selection to include completed and soft-deleted project sessions, and ensure deletion does not change chart history. Do not expose a deleted-project history UI. **Traceability:** §2 Non-goals; §4 Derived values; §5.5 AC 1, 6; §5.6 AC 3, 6.
4. Add persistence and transaction coverage for status changes and soft deletion. **Traceability:** §5.1 AC 2; §5.6 AC 1-7.

### Automated verification

- Unit-test complete/reopen transitions as non-activity events; test that completed projects still contribute session totals, and soft-deleted projects continue contributing to overall daily values.
- Unit-test deletion does not remove session records and does not alter the chart series; test project rows disappear from both visible sections after confirmation.
- Browser-test cancel and confirm branches of deletion, reopen, persistence after reload, and inability to add a session until a completed project is reopened.

Commands:

```sh
npm run test:unit -- src/domain/projectLifecycle.test.ts src/domain/dailyActivity.test.ts
npm run test:e2e -- tests/e2e/project-lifecycle.spec.ts
npm run lint
npm run typecheck
npm run build
```

### Manual completion checklist

- [ ] Complete a project and verify it leaves active projects, appears in completed projects, and retains total/history. **§5.6 AC 1; §5.7 AC 4**
- [ ] Reopen it and verify it returns to active projects without adding chart activity. **§5.6 AC 2, 4**
- [ ] Attempt to log while complete; verify the project must be reopened first. **§7 Assumption 4; §5.3 AC 1**
- [ ] Cancel a delete confirmation and verify no data or chart values change. **§5.6 AC 5, 7**
- [ ] Confirm deletion and verify the project is hidden, retained data remains stored, and overall historical values remain unchanged. **§5.6 AC 5, 6; §5.5 AC 1, 6**

## Phase 4: Complete Data Backup and Restore

**Outcome:** Users can export a complete backup and restore it using replace or merge, with validation and conflict handling that never partially overwrites local data.

### Tasks

1. Define and document a versioned JSON backup schema containing all project/session fields, timestamps, and soft-deleted records. Implement export/download. **Traceability:** §4; §5.8 AC 1, 2, 8.
2. Implement strict import parsing/validation and migrations for supported schema versions. Validate record values, date-only strings, references, and unique project/session IDs within each file. **Traceability:** §4; §5.8 AC 3; §6 import edge case.
3. Implement replace import and merge import, including ID deduplication, differing-content conflict choices, and cancel-with-no-mutation. Apply changes atomically. **Traceability:** §5.8 AC 4-7.
4. Add unobtrusive backup controls and explicit confirmation/feedback for selected import mode and failures. **Traceability:** §5.8 AC 1, 3, 7; §5.9 AC 3.
5. Verify export/import preserves local calendar dates and all records, including retained deleted-project history. **Traceability:** §5.8 AC 2, 5, 8; §5.6 AC 6.

### Automated verification

- Unit-test export/import round trips for active, completed, and soft-deleted projects; multiple sessions; optional fields; stable IDs; and date-only values.
- Unit-test invalid JSON/schema/version, malformed dates, invalid or over-limit counts (including 1,000,001), missing project references, duplicate IDs inside a file, and unsupported versions. Assert the existing database is unchanged on every failure.
- Unit-test replace, merge with unique IDs, identical-ID deduplication, differing-ID conflicts, user choice, and cancel. Assert failed/cancelled operations are atomic.
- Browser-test download and file upload with Playwright; verify confirmation text and restored dashboard/detail/chart state.

Commands:

```sh
npm run test:unit -- src/data/backup.test.ts src/data/import.test.ts
npm run test:e2e -- tests/e2e/backup-restore.spec.ts
npm run lint
npm run typecheck
npm run build
```

### Manual completion checklist

- [ ] Export data containing active, completed, and deleted projects; verify the downloaded file is versioned and includes all sessions. **§5.8 AC 1, 2**
- [ ] Import into empty storage and verify dates and values restore unchanged. **§5.8 AC 3, 8**
- [ ] Import into non-empty storage and test both replace and merge. **§5.8 AC 4-6**
- [ ] Import a file with duplicate project IDs and another with duplicate session IDs; reject both without changing local data. Then test identical-ID and differing-ID collisions between a valid file and existing data, including cancelling a conflict. **§5.8 AC 3, 6, 7; §6 import edge case**
- [ ] Try malformed and unsupported files and verify an error is shown while existing data remains intact. **§5.8 AC 3, 7**

## Phase 5: Responsive, Accessible, and GitHub Pages Release

**Outcome:** The complete app is polished against both mockups, works at phone and desktop sizes, meets the specified accessibility behavior, and is deployable as a static site on GitHub Pages.

### Tasks

1. Compare dashboard and project detail against their respective mockups and tune typography, palette, paper/shadow treatment, hierarchy, spacing, and chart styling without altering data semantics. **Traceability:** §5.7 AC 6-9; §5.9 AC 1-5.
2. Complete phone layouts for dashboard, detail, forms, dialogs, session history, completed list, and import/export. Verify no horizontal overflow and all primary controls remain reachable. **Traceability:** §5.9 AC 5, 7.
3. Complete keyboard operation, visible focus, accessible labels/names, non-color chart descriptions, validation messaging, and status announcements for state-changing actions. **Traceability:** §5.7 AC 7; §5.9 AC 6, 7.
4. Verify there are no runtime data/network requests to a backend or analytics service; ensure all dependencies needed at runtime are bundled as static assets. **Traceability:** §1; §5.1 AC 4.
5. Configure GitHub Pages build/deployment with the correct base path and test a deployed nested project route/refresh behavior. **Traceability:** §1; §5.9 AC 5, 7.
6. Run the complete regression suite, production build, and manual acceptance pass; fix only release-blocking issues in scope. **Traceability:** all applicable §5 acceptance criteria.

### Automated verification

- Run all unit and browser tests, including the domain regressions from Phases 2-4.
- Run automated accessibility checks for critical screens and Playwright layout checks at desktop and phone viewports. Keep manual keyboard/screen-reader checks as release gates; automated scans are not a substitute.
- Inspect the production build for static assets and verify deployment path configuration. Do not treat a successful local dev server as proof that GitHub Pages routing works.

Commands:

```sh
npm run test:unit
npm run test:e2e
npm run lint
npm run typecheck
npm run build
```

### Manual completion checklist

- [ ] Compare the dashboard to `mockup.png` and project detail to `project page mockup.png`; verify chart bars are not mistaken for data. **§5.5 AC 5; §5.7 AC 6-9; §5.9 AC 1, 2, 4**
- [ ] Complete create, edit, log, correct, delete-session, complete, reopen, delete-project, export, and import workflows at desktop and phone sizes. **§5.2 AC 1-8; §5.3 AC 1-8; §5.6 AC 1-7; §5.8 AC 1-8**
- [ ] Use keyboard only through navigation, forms, chart descriptions, confirmation, and import controls; confirm visible focus and usable accessible names. **§5.7 AC 7; §5.9 AC 6**
- [ ] Inspect empty, invalid-input, storage-error, and import-error states. **§5.1 AC 1, 2; §5.2 AC 3, 4; §5.5 AC 7; §6**
- [ ] Test the deployed GitHub Pages URL on phone and desktop, including direct navigation/refresh on a project detail route. **§1; §5.9 AC 5, 7**
- [ ] Confirm no login is requested, no user content is sent to a server, and the UI indicates data is local to this browser/device. **§5.1 AC 1, 4**

## Release Gate

Do not proceed to the next phase until the current phase's automated commands pass, its manual checklist is complete, and the app still runs and builds. Before the first implementation phase, obtain approval for this plan and resolve the five spec gaps above; update `SPEC.md` only after approval, then update this plan's traceability if the approved decisions differ from the provisional choices.
