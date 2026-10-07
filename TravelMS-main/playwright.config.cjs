const { defineConfig } = require('@playwright/test');
const database = `waypoint_e2e_${process.pid}_${Date.now()}`;
const port = 4211;
module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: 'node tests/e2e-server.cjs',
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 30000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 },
    env: {
      WAYPOINT_E2E_DB: database,
      WAYPOINT_E2E_PORT: String(port),
      FRONTEND_ORIGIN: `http://127.0.0.1:${port}`,
    },
  },
});
