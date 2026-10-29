import { defineConfig, devices } from '@playwright/test';
// Automatic DOM error snapshots can contain entered credentials. Keep diagnostics secret-safe.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      // Transport diagnostic only: keeps HTTPS, assertions and wallet safety intact.
      args: process.env.E2E_HTTP1 === '1' ? ['--disable-http2'] : [],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: [['./tests/credential-redaction-reporter.ts'], ['list'], ['html', { open: 'never' }]],
});
