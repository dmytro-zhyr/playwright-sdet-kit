import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import { withTrailingSlash } from './api/url';

dotenv.config({ quiet: true });

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    // The trailing slash is not cosmetic: without it the /api segment is dropped from every
    // request. See api/url.ts for the four spellings and why only one of them works.
    baseURL: withTrailingSlash(process.env.CONDUIT_API_URL ?? 'https://api.realworld.show/api'),
    extraHTTPHeaders: { 'Content-Type': 'application/json' },
  },
  projects: [
    { name: 'unit', testDir: './tests/unit' },
    { name: 'contract', testDir: './tests/contract' },
    { name: 'defects', testDir: './tests/defects' },
  ],
});
