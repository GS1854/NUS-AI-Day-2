import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  use: { baseURL: 'http://localhost:3000', timezoneId: 'Asia/Singapore', ...devices['Desktop Chrome'] },
  webServer: {
    command: 'cross-env NODE_ENV=development SESSION_SECRET=playwright-local-secret-0123456789012345 npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    env: {
      NODE_ENV: 'development',
      SESSION_SECRET: 'playwright-local-secret-0123456789012345',
      TODO_DB_PATH: path.join(os.tmpdir(), `singapore-todo-e2e-${process.pid}.db`),
    },
  },
});
