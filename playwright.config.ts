import { defineConfig } from '@playwright/test';

const PORT = 5174;

export default defineConfig({
  testDir: 'tests',
  timeout: 10 * 60 * 1000,
  reporter: 'list',
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 960, height: 540 },
    trace: 'off',
    launchOptions: {
      // Software rendering so the test also runs on machines without a GPU.
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60 * 1000,
  },
});
