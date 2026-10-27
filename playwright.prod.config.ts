import { defineConfig, devices } from '@playwright/test'

// Runs against the production build served from the GitHub Pages subpath, not the dev server.
const PORT = 4180

export default defineConfig({
  testDir: './tests/production',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}/Wordstead-app-v1/`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/Wordstead-app-v1/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
