import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { resolveDeployment, resolveUiDeployment } from './deployments/registry';
import { ALLURE_CATEGORIES, allureEnvironment } from './report/allure';

dotenv.config({ quiet: true });

// The two project targets are named, not spelled out: `deployments/registry.ts` is the one place a
// name becomes a URL, and it is what the `deployment` fixture reads too. So a project and a test
// can never disagree about where `conduit-gate` is, and repointing one repoints both.
//
// `resolveDeployment` applies the trailing slash. It is not cosmetic: without it the /api segment
// is dropped from every request. See deployments/url.ts for the four spellings and why only one works.
const GATE_URL = resolveDeployment('conduit-gate');

// The defects project keeps its own default target — the deployment D-1 to D-5 are about. Tests
// that reproduce a defect on a *different* deployment do not rely on this: they name theirs with
// the `deployment` fixture. See spec/FINDINGS.md, "Switching targets".
const DEFECTS_URL = resolveDeployment('conduit-unsound');

// The UI gate is a different deployment from the API gate, and deliberately so. conduit-gate has
// no browser UI at all — realworld.habsida.net answers 404 — and conduit-unsound would colour
// browser tests with its own backend defects, D-5 above all: a write invisible to everyone but
// its author turns "publish an article, then find it in the feed" red for a reason that has
// nothing to do with the page. conduit-overstrict is what is left, and its one deviation (a
// username over 20 characters is rejected) is out of reach of a browser test.
//
// resolveUiDeployment, not resolveDeployment: asking a deployment with no UI for one throws here,
// at config load, rather than starting a browser against a JSON endpoint.
// See spec/FINDINGS.md, "UI reconnaissance".
const UI_URL = resolveUiDeployment('conduit-overstrict');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Three reporters, three readers, and none of them is decoration.
  //
  //   list      the person watching the run right now
  //   html      the person debugging one failure — the trace viewer is not replaceable
  //   allure    the person asking what keeps happening, across runs and across suites
  //
  // Allure is not a prettier html report. It is here for the one question the other two cannot
  // answer: **which of these failures were ever about our code**. This repository runs a suite
  // that is red on purpose, so "7 failed" is meaningless until the reader knows which seven, and
  // report/allure.ts answers that with categories instead of leaving it to whoever remembers.
  //
  // It runs locally too, not only on CI. History is what makes it worth having, and history that
  // only exists on CI cannot be looked at while writing the test that would have shown up in it.
  reporter: [
    ['list'],
    ...(process.env.CI ? [['html', { open: 'never' }] as const] : []),
    [
      'allure-playwright',
      {
        resultsDir: 'allure-results',
        // Playwright's own steps become Allure steps, so a page-object action wrapped in
        // `test.step` reads as one line in the report instead of six locator calls.
        detail: true,
        environmentInfo: allureEnvironment(),
        categories: ALLURE_CATEGORIES,
      },
    ],
  ],
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
      name: 'ui',
      testDir: './tests/ui',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: UI_URL,
        // The API base URL above sets this header for every request, which is right for a client
        // and wrong for a browser: it would be sent on document navigations too. The UI project
        // states its own `use` block rather than inheriting one written for APIRequestContext.
        extraHTTPHeaders: {},
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
      },
    },
    {
      name: 'defects',
      testDir: './tests/defects',
      // Its own baseURL, so the two targets can never collide: moving the gate leaves this alone.
      use: { baseURL: DEFECTS_URL },
    },
  ],
});
