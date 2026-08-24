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
  // `contract` is run with a single worker — see the npm script, which cannot carry a comment
  // of its own. Not a workaround: under concurrency the target hands a token holder somebody
  // else's account (spec/FINDINGS.md, D-4), and a gate must not go red on somebody else's
  // defect. `defects` keeps the concurrency, because that is the only configuration in which
  // D-4 exists at all. The day D-4 is fixed, the defects test turns green and this goes away.
  projects: [
    { name: 'unit', testDir: './tests/unit' },
    { name: 'contract', testDir: './tests/contract' },
    { name: 'defects', testDir: './tests/defects' },
  ],
});
