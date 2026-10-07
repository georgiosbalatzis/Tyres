import { defineConfig, devices } from '@playwright/test';

/** Runs against the production build served under a GitHub Pages-style base path. */
const PORT = Number(process.env.E2E_PORT ?? 4173);
export const BASE = '/Tyres/';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `BASE_PATH=${BASE} npm run build && npx vite preview --port ${PORT} --strictPort --base ${BASE}`,
    url: `http://localhost:${PORT}${BASE}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
