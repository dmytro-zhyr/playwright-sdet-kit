// Builds the Allure report, carrying the previous run's history forward.
//
// 🔑 The history copy is the whole script. `allure generate --clean` wipes the output directory,
// and the trend and retry data live inside it — so generating twice without this leaves a report
// that has forgotten every run before the last one. Trends are the one thing Allure offers that
// Playwright's own HTML report does not, and a two-line omission is enough to lose them silently:
// the report still builds, still looks complete, and simply shows a trend of length one.
//
// It runs the same way locally and on CI, which is the point. A report that only assembles
// correctly inside a workflow cannot be checked while writing the test that would appear in it.
//
// 📌 The two clean commands sit either side of this script, and the difference is the history:
// `allure:clean` moves it to `allure-results/history/` and deletes everything else, so the trend
// survives; `allure:hard-clean` removes both directories outright and the trend goes with them.

import { cpSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import allure from 'allure-commandline';

const RESULTS = 'allure-results';
const REPORT = 'allure-report';

if (!existsSync(RESULTS)) {
  console.error(
    `No ${RESULTS}/ directory. Run a suite first — npm run test:unit, test:contract or test:ui.`
  );
  process.exit(1);
}

const previousHistory = join(REPORT, 'history');
const carriedHistory = join(RESULTS, 'history');

// Three cases, and they must not be reported as two. An earlier version printed "no previous
// report, so this run starts the history" whenever allure-report/ was absent — which is exactly
// what `allure:clean` leaves behind, history and all. The trend grew anyway and the message said
// it had not: a report that misdescribes its own inputs is the smallest possible version of the
// thing this repository exists to refuse.
if (existsSync(previousHistory)) {
  rmSync(carriedHistory, { recursive: true, force: true });
  cpSync(previousHistory, carriedHistory, { recursive: true });
  console.log(`Carried history forward from ${previousHistory}`);
} else if (existsSync(carriedHistory)) {
  console.log(`Using the history ${carriedHistory}, left in place by npm run allure:clean.`);
} else {
  console.log('No history anywhere, so this run starts the trend.');
}

// `--clean` is deliberate and safe *because of the copy above*: without it a stale result from a
// deleted test lingers in the report forever, and with it — but without the copy — the history
// goes too.
const generation = allure(['generate', RESULTS, '--clean', '-o', REPORT]);

generation.on('exit', (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }

  console.log(`\nReport written to ${REPORT}/. Open it with: npm run allure:open`);
  console.log('Opening the files directly will not work — the report needs to be served.');
});
