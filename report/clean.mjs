// Clears the Allure working directories, keeping the trend.
//
// 🔑 Two intentions hide under the word "clean" and they are not the same:
//
//   allure:clean       start a fresh set of results, keep knowing what happened before
//   allure:hard-clean  forget everything, including the trend
//
// The second is one line of rimraf in package.json. This file is the first, and it exists because
// the history lives *inside* the generated report — `allure-report/history/` — so any command that
// removes the report removes the trend with it, quietly and completely.
//
// What it leaves behind is deliberate: `allure-results/history/` and nothing else, with
// `allure-report/` gone entirely. That end state is better than pruning the report in place,
// because a directory called `allure-report` that no longer contains a report is exactly the kind
// of stale artifact that gets opened and believed. Removing it is safe — it is a build output, and
// `allure:generate` rebuilds it whole — while the history moves to where the generator looks for
// it anyway.

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const RESULTS = 'allure-results';
const REPORT = 'allure-report';

const reportHistory = join(REPORT, 'history');
const resultsHistory = join(RESULTS, 'history');

// Read the surviving history before anything is deleted. It may already be in the results
// directory — from a previous clean that was never followed by a generate — and that copy is the
// one to keep if the report has no history of its own.
const source = existsSync(reportHistory)
  ? reportHistory
  : existsSync(resultsHistory)
    ? resultsHistory
    : null;

let carried = null;

if (source) {
  // Staged outside both directories, because the next step deletes the one it came from.
  carried = join(process.cwd(), '.allure-history-carry');
  rmSync(carried, { recursive: true, force: true });
  cpSync(source, carried, { recursive: true });
}

rmSync(RESULTS, { recursive: true, force: true });
rmSync(REPORT, { recursive: true, force: true });

if (carried) {
  mkdirSync(RESULTS, { recursive: true });
  cpSync(carried, resultsHistory, { recursive: true });
  rmSync(carried, { recursive: true, force: true });
  console.log(`Cleared results and report. History kept in ${resultsHistory}.`);
} else {
  console.log('Cleared results and report. There was no history to keep.');
}

console.log(
  'Run a suite, then npm run allure:generate. To drop the trend too: npm run allure:hard-clean'
);
