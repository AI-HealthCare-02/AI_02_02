import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    // 다른 워크트리에서 3002를 쓰고 있으면 PLAYWRIGHT_BASE_URL=http://localhost:3003 등으로 override 가능.
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // dev server 가 이미 떠있으면 webServer 옵션 생략, 떠있지 않으면 다음 줄 활성화:
  // webServer: { command: 'npm run dev', port: 3002, reuseExistingServer: true },
});
