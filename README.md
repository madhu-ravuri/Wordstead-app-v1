# Wordstead

Wordstead is a local-first writing project tracker. Phase 1 provides project creation, editing, a dashboard, and project details. Project records are stored in this browser with IndexedDB; there are no accounts or cloud sync. Session logging, live activity charts, completion actions, and backup/restore are planned for later phases.

## Development

```sh
npm ci
npm run dev
```

The Vite development server uses the GitHub Pages project path `/Wordstead-app-v1/`.

## Verification

```sh
npm run test:unit
npm run test:e2e
npm run lint
npm run typecheck
npm run build
```

Install the Playwright browser once on a new machine or CI image:

```sh
npx playwright install chromium
```

## GitHub Pages

The production build is static and uses hash-based navigation so refreshing a project detail page does not require server-side route rewrites. Build with `npm run build` and publish the generated `dist/` directory through GitHub Pages. The current Vite base path is `/Wordstead-app-v1/`.

## Product references

- `SPEC.md` is the product specification.
- `IMP_PLAN.md` is the phased implementation plan.
- `mockup.png` is the dashboard visual reference.
- `project page mockup.png` is the project detail visual reference.
- `QA_LOG.md` records issues found during implementation and verification.