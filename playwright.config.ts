import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import { resolveDeployment } from './api/deployments';

dotenv.config({ quiet: true });

// The two project targets are named, not spelled out: `api/deployments.ts` is the one place a
// name becomes a URL, and it is what the `deployment` fixture reads too. So a project and a test
// can never disagree about where `conduit-gate` is, and repointing one repoints both.
//
// `resolveDeployment` applies the trailing slash. It is not cosmetic: without it the /api segment
// is dropped from every request. See api/url.ts for the four spellings and why only one works.
const GATE_URL = resolveDeployment('conduit-gate');

// The defects project keeps its own default target — the deployment D-1 to D-5 are about. Tests
// that reproduce a defect on a *different* deployment do not rely on this: they name theirs with
// the `deployment` fixture. See spec/FINDINGS.md, "Switching targets".
const DEFECTS_URL = resolveDeployment('conduit-unsound');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: GATE_URL,
    extraHTTPHeaders: { 'Content-Type': 'application/json' },
  },
  // Worker counts are not set here. `contract` is pinned to one worker by `--workers=1` in the
  // `test:contract` script in package.json, because of defect D-4 in spec/FINDINGS.md.
  // The full reasoning lives in CONVENTIONS.md, "How the suites run" — a JSON script cannot
  // carry a comment, so do not look for that setting in this file.
  projects: [
    { name: 'unit', testDir: './tests/unit' },
    { name: 'contract', testDir: './tests/contract' },
    {
      name: 'defects',
      testDir: './tests/defects',
      // Its own baseURL, so the two targets can never collide: moving the gate leaves this alone.
      use: { baseURL: DEFECTS_URL },
    },
  ],
});
