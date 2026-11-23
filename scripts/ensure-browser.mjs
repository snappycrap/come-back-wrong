// Runs before `npm test`: downloads the test browser the first time only.
import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (!existsSync(chromium.executablePath())) {
  console.log('Downloading the test browser (first time only)...');
  execSync('npx playwright install chromium', { stdio: 'inherit' });
}
