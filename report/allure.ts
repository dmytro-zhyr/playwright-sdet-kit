import { Status } from 'allure-js-commons';
import type { Category, EnvironmentInfo } from 'allure-js-commons/sdk';
import { DEPLOYMENTS, resolveDeployment, resolveUiDeployment } from '@api/deployments';

/**
 * What Allure is here for, and what it is not.
 *
 * Playwright's own HTML report already answers "what happened in this run", and it does it better
 * than Allure does — the trace viewer is not replaceable. Allure answers a different question:
 * **what keeps happening**, across runs and across suites, and *which of these failures were ever
 * about our code*. That second half is the reason this file exists.
 *
 * ⛔ Neither report is decoration. A repository whose `defects` suite is red on purpose produces a
 * report where "7 failed" means nothing at all until the reader knows which seven. Categories are
 * how that question is answered by the report rather than by whoever remembers.
 */

/**
 * Failure categories.
 *
 * 📌 The three below name the failures this project already knows how to explain. Anything outside
 * them is a failure nobody has explained yet, which is exactly what a reader should be looking at.
 *
 * 🔑 **How they combine, measured rather than assumed — 30 August 2026.** The report generator adds
 * two buckets of its own no matter what is declared here: `Product defects` for `failed` and
 * `Test defects` for `broken`. A result lands in the **first** category that matches, and the
 * declared ones are matched first — a run with 9 known defects and 9 genuine failures produced
 * `Known defect of the target: 9`, `Product defects: 5`, `Test defects: 4`, with nothing counted
 * twice.
 *
 * ⚠️ **This corrects the comment that first stood here**, which claimed there was "deliberately no
 * catch-all" and that a category defined too loosely would dilute every other one. Neither holds:
 * a catch-all is supplied whether or not it is wanted, and first-match means a loose category
 * *steals* results rather than duplicating them. The intent survived the correction — an
 * unexplained failure must stay visible — but the mechanism was the opposite of the one described,
 * and the difference decides how a new category should be written: **narrow, and ordered before
 * the ones it must not be swallowed by.**
 */
export const ALLURE_CATEGORIES: Category[] = [
  {
    name: 'Known defect of the target',
    // Matched on the stack trace rather than on a message: every test under tests/defects/ asserts
    // the specification against a deployment documented as violating it, so the *location* is what
    // makes it expected, not anything it says. Message matching would need each test to phrase its
    // failure a particular way, which is a convention, and conventions are not enforced.
    traceRegex: '.*[\\\\/]tests[\\\\/]defects[\\\\/].*',
    matchedStatuses: [Status.FAILED, Status.BROKEN],
    description:
      'A test in tests/defects/ that is red because the deployment it names is still broken. ' +
      'Red here is the expected state and green is the news — it would mean the defect was fixed. ' +
      'These never belong in a count of things wrong with our code.',
  },
  {
    name: 'Target unavailable',
    // Somebody else's uptime. The contract suite talks to a live third-party deployment, and the
    // README's whole argument for splitting the suites is that our gate must not go red because
    // their server went down. This category is that argument, made visible in the report.
    messageRegex:
      '(?s).*(ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|net::ERR_|apiRequestContext: Timeout|Target page, context or browser has been closed).*',
    matchedStatuses: [Status.FAILED, Status.BROKEN],
    description:
      'The target could not be reached at all. Not a defect in this repository and not a defect ' +
      'in the target either — it says only that the network or somebody else’s host was down ' +
      'while the suite ran. Re-run before reading anything into it.',
  },
  {
    name: 'Setup failed before the subject',
    // The failures this project deliberately made loud: registerUser throws with the status and
    // body, and EditorPage.open throws when the auth guard redirected instead of letting a
    // locator time out on a field. Both exist so a report names the cause; this category is what
    // stops that naming from being lost again one level up.
    messageRegex:
      '(?s).*(Could not register the test user|The registration response carried no user\\.token|The editor redirected to).*',
    matchedStatuses: [Status.BROKEN, Status.FAILED],
    description:
      'The test never reached what it was about. Setup broke first — an account that could not ' +
      'be created, a session that was never seeded — so nothing here says anything about the ' +
      'behaviour under test.',
  },
];

/**
 * What the run was pointed at, written into the report beside the results.
 *
 * A named deployment is only useful while the name can be resolved back to a host. Six months from
 * now, "conduit-gate" in an archived report means nothing unless the report also says where
 * conduit-gate was that day — and these URLs are overridable per environment, so the default in
 * the registry is not the answer either.
 */
export function allureEnvironment(): EnvironmentInfo {
  const info: EnvironmentInfo = {
    node: process.version,
    playwright: process.env.npm_package_devDependencies__playwright_test ?? 'see package.json',
    ci: process.env.CI ? 'yes' : 'no',
    'ui gate': resolveUiDeployment('conduit-overstrict'),
  };

  for (const deployment of DEPLOYMENTS) {
    info[deployment.name] = resolveDeployment(deployment.name);
  }

  return info;
}
