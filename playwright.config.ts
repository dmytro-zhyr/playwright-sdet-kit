import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { resolveDeployment, resolveUiDeployment } from '@deployments/registry';
import { ALLURE_CATEGORIES, allureEnvironment } from '@report/allure';

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

/**
 * What a browser project uses, shared by `ui` and `defects-ui` so the two cannot drift apart.
 *
 * ⚠️ `extraHTTPHeaders: {}` is load-bearing. The API base URL sets `Content-Type: application/json`
 * on every request, which is right for a client and wrong for a browser — it would be sent on
 * document navigations too. A browser project states its own block rather than inheriting one
 * written for `APIRequestContext`.
 */
const BROWSER = {
  ...devices['Desktop Chrome'],
  baseURL: UI_URL,
  extraHTTPHeaders: {},
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
} as const;

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
  //   json      a machine, and only when one asks — see PLAYWRIGHT_JSON_REPORT below
  reporter: [
    ['list'],
    ...(process.env.CI ? [['html', { open: 'never' }] as const] : []),
    // 🔑 Off unless a caller names an output file, and there is exactly one caller: the `defects`
    // job, which has to decide whether a run is news. That suite is red on purpose, so a red job
    // says nothing — the job needs to know *how many* tests passed, and `stats.expected > 0` is
    // that number. `.last-run.json` cannot answer it: it lists failures and not the total.
    //
    // ⛔ Not added to the list unconditionally. A reporter every run writes and nobody reads is
    // the definition of decoration, and this file opens by saying none of the three are that.
    ...(process.env.PLAYWRIGHT_JSON_REPORT
      ? [['json', { outputFile: process.env.PLAYWRIGHT_JSON_REPORT }] as const]
      : []),
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
      use: BROWSER,
    },
    {
      name: 'defects',
      testDir: './tests/defects',
      // Its own baseURL, so the two targets can never collide: moving the gate leaves this alone.
      use: { baseURL: DEFECTS_URL },
    },
    // 🔑 A fourth project, and the reason is the same one that made `defects` a project rather than
    // a folder inside `contract`: these tests assert what the application *should* do and are red
    // until somebody else fixes it, so they must not stand in a gate. What they could not do is
    // live in `defects` — that project's `use` is written for an API client, and the comment on
    // BROWSER above is exactly why the two cannot share one block.
    //
    // ⛔ Not solved with `test.fail()` inside the `ui` suite instead. That would put a
    // known-broken assertion inside the gate and give this repository a second vocabulary for a
    // thing it already has one for: a defect is a test that asserts the specification and goes
    // green the day the defect is fixed.
    {
      name: 'defects-ui',
      testDir: './tests/defects-ui',
      use: BROWSER,
    },
  ],
});
