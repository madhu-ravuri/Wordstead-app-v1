# Development

Wordstead is a static React + TypeScript app built with Vite. Data lives in the browser's IndexedDB; there is no backend.

## Run locally

```sh
npm ci
npm run dev
```

The dev server runs at `http://127.0.0.1:5173/Wordstead-app-v1/`. It uses the same `/Wordstead-app-v1/` base path as GitHub Pages, so links behave the same locally and when deployed.

## Verification

```sh
npm run test:unit       # Vitest: domain, data, and component tests
npm run test:e2e        # Playwright against the dev server
npm run test:e2e:prod   # Playwright against the production build, served from the Pages subpath
npm run lint
npm run typecheck       # app, Vite config, and Playwright tests/configs
npm run build
```

Install the Playwright browser once on a new machine or CI image:

```sh
npx playwright install chromium
```

`test:e2e` reuses a dev server already running on port 5173, or starts one. `test:e2e:prod` always builds `dist/` and serves it on port 4180. It checks that the app only requests its own static assets, that direct project links survive a refresh, and that core workflows work offline once loaded.

`tests/e2e/accessibility.spec.ts` runs axe-core WCAG 2.1 A/AA scans of every screen at desktop and phone widths. Automated scans don't replace a manual keyboard and screen-reader pass before a release.

## GitHub Pages

The production build is static and uses hash-based navigation (`#/project/<id>`), so direct links and refreshes work without server-side route rewrites. Vite's `base` is `/Wordstead-app-v1/` to match the repository name. If the repository is renamed, update `base` in `vite.config.ts` and the URLs in both Playwright configs.

`.github/workflows/deploy.yml` runs lint, typecheck, unit tests, and both Playwright suites on every push and pull request. It then builds and deploys `dist/` to `https://madhu-ravuri.github.io/Wordstead-app-v1/` on pushes to `master`.

One-time setup: in the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.

## Project references

- [`SPEC.md`](../SPEC.md): the product specification.
- [`IMP_PLAN.md`](../IMP_PLAN.md): the phased implementation plan.
- [`QA_LOG.md`](../QA_LOG.md): issues found during implementation and verification, and how each was fixed.
- [`docs/backup-format.md`](backup-format.md): the versioned backup file format and import rules.
- [`docs/mockup.png`](mockup.png): the original dashboard design reference.
- [`docs/project page mockup.png`](<project page mockup.png>): the original project detail design reference.
