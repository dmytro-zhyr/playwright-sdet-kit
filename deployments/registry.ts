import { withTrailingSlash } from '@deployments/url';

/**
 * Named deployments.
 *
 * A test that talks to a network target names **which** deployment it is about, instead of
 * inheriting whichever one its project happened to be pointed at. That distinction stopped being
 * academic the day defects were documented on two deployments at once: a defect test pinned to
 * "the defects target" can no longer say what it reproduces, and a gate carrying somebody else's
 * defect is not a gate.
 *
 * A name is not an abbreviation of a host. It is the one thing about that deployment a reader
 * needs in order to understand why a test names it:
 *
 * - `conduit-gate` is the deployment the `contract` suite is measured against.
 * - `conduit-unsound` is the deployment whose answers cannot be trusted.
 * - `conduit-overstrict` is the deployment that validates more than the contract states.
 *
 * A deployment has an API and, separately, may or may not have a **browser UI**. Those are two
 * addresses rather than one with a suffix, and the gate is why they had to be modelled apart: it
 * has an API and no UI at all. See `ui` below.
 *
 * The registry is a list rather than a switch on purpose: adding the second product in stage 5
 * is appending entries, not editing resolution logic. Nothing here knows the word "Conduit"
 * except the data.
 */

/**
 * One addressable surface of a deployment — its API, or its UI. Both are repointed the same way,
 * so both resolve through the same code and neither can grow a rule the other lacks.
 */
type Endpoint = {
  /** The variable that overrides the default. A surface is repointed, never re-hardcoded. */
  readonly envVar: string;
  /** Used when the variable is unset, so the repository runs with no `.env` at all. */
  readonly defaultUrl: string;
};

/**
 * How many accounts a deployment lets one caller create, and over what window.
 *
 * `null` is a fact about the world, like `ui: null` below — it means *measured, none found*, not
 * *nobody has looked*. Every value here was probed on 15 September 2026 by registering accounts one
 * at a time until the target refused; the probe and its numbers are in spec/FINDINGS.md.
 */
export type RegistrationQuota = {
  readonly limit: number;
  readonly windowMs: number;
};

export type Deployment = {
  /** How a test asks for this deployment. Meaningful to a reader; never a host abbreviation. */
  readonly name: string;
  /** The variable that overrides the API default. A deployment is repointed, never re-hardcoded. */
  readonly envVar: string;
  /** Used when the variable is unset, so the repository runs with no `.env` at all. */
  readonly defaultUrl: string;
  /** Why this deployment is worth naming — the fact a test author needs before choosing it. */
  readonly description: string;
  /**
   * The browser UI in front of this API, or `null` when the deployment has none.
   *
   * `null` is a fact about the world, not an omission to be filled in later. It is modelled
   * explicitly so that asking a UI-less deployment for a UI throws by name, instead of resolving
   * to the API URL and running a browser suite against JSON.
   */
  readonly ui: Endpoint | null;
  /**
   * What the target will accept before it starts answering 429 to `POST /users`.
   *
   * ⛔ Registration only. Login is not limited on any of the three — 40 logins in 49 seconds
   * against the deployment that refuses a sixth registration.
   */
  readonly registrationQuota: RegistrationQuota | null;
};

export const DEPLOYMENTS = [
  {
    name: 'conduit-gate',
    envVar: 'CONDUIT_API_URL',
    defaultUrl: 'https://realworld.habsida.net/api',
    description:
      'the deployment the contract gate is measured against; conforms broadly, and D-6 to D-11 in spec/FINDINGS.md are its',
    // The gate publishes an API and nothing else: https://realworld.habsida.net/ answers 404,
    // checked 30 August 2026. So the deployment the whole contract suite is measured against
    // cannot host a single UI test, and stage 3 had to name a different one.
    // See spec/FINDINGS.md, "The gate has no UI".
    ui: null,
    // Measured 15 September 2026: five registrations, then 429 with `Retry-After: 173`. The same
    // suite ran green here on 10 September with all 31 registrations, so this limit is new.
    // ⚠️ The window carries a two-second margin over the header the server sent — whether its
    // window is fixed or sliding is not observable from outside.
    registrationQuota: { limit: 5, windowMs: 175_000 },
  },
  {
    name: 'conduit-unsound',
    envVar: 'CONDUIT_DEFECTS_API_URL',
    defaultUrl: 'https://api.realworld.show/api',
    description:
      'uniqueness, identity and visibility all fail here; D-1 to D-5 in spec/FINDINGS.md are its',
    // Has a UI, and it is still the wrong place to measure one: D-5 hides a write from everyone
    // but its author, so "publish an article, then find it in the global feed" fails here for a
    // reason that has nothing to do with the page. Registered all the same, because reproducing a
    // known defect through the UI is what tests/defects/ is for.
    ui: { envVar: 'CONDUIT_DEFECTS_UI_URL', defaultUrl: 'https://demo.realworld.show' },
    // Probed 15 September 2026: 40 registrations in 43.8 seconds, all accepted, and the fastest
    // of the three at ~60ms a request. No limit found.
    registrationQuota: null,
  },
  {
    name: 'conduit-overstrict',
    envVar: 'CONDUIT_OVERSTRICT_API_URL',
    defaultUrl: 'https://conduit-api.bondaracademy.com/api',
    description:
      'conforms, but rejects a username longer than 20 characters — a limit the specification never states',
    // The UI gate, reached by elimination rather than preference: conduit-gate has no UI, and
    // conduit-unsound would colour browser tests with backend defects. Its one known deviation
    // does not reach a browser test — data/userFactory.ts emits `qa_` plus 10 characters, 13 in
    // all, so the 20-character ceiling is never approached.
    ui: { envVar: 'CONDUIT_OVERSTRICT_UI_URL', defaultUrl: 'https://conduit.bondaracademy.com' },
    // Probed 15 September 2026: 40 registrations in 52.4 seconds, all accepted. No limit found.
    registrationQuota: null,
  },
] as const satisfies readonly Deployment[];

/** The names a test may ask for. A typo is a compile error before it is a runtime one. */
export type DeploymentName = (typeof DEPLOYMENTS)[number]['name'];

/** Every known name, in registry order — what an error message offers instead of a guess. */
export function deploymentNames(): DeploymentName[] {
  return DEPLOYMENTS.map((deployment) => deployment.name);
}

/** The names that actually have a browser UI — what a UI error offers instead of a guess. */
export function uiDeploymentNames(): DeploymentName[] {
  return DEPLOYMENTS.filter((deployment) => deployment.ui !== null).map(
    (deployment) => deployment.name
  );
}

function findDeployment(name: string): (typeof DEPLOYMENTS)[number] {
  const deployment = DEPLOYMENTS.find((candidate) => candidate.name === name);

  if (!deployment) {
    throw new Error(
      `Unknown deployment "${name}". Known deployments: ${deploymentNames().join(', ')}. ` +
        `A name is never guessed and never falls back to a default — fix the name, or add the ` +
        `deployment to deployments/registry.ts.`
    );
  }

  return deployment;
}

/**
 * Turns one surface of a deployment into a base URL.
 *
 * The trailing slash is applied here and nowhere else. Without it `new URL('tags', base)` drops
 * the `/api` segment and every request goes to the wrong path — quietly, with plausible-looking
 * 404s. See `deployments/url.ts` for the four spellings and why only one of them works. A UI base has no
 * path segment today and would survive without it; it is normalised all the same, because "this
 * base happens to have no path" is a property of today's hosts, not a rule.
 *
 * A variable that is set but empty throws: `''` would resolve to a base URL of `/`, and every
 * request would leave for nowhere.
 */
function resolveEndpoint(
  endpoint: Endpoint,
  name: string,
  env: Record<string, string | undefined>
): string {
  const override = env[endpoint.envVar];

  if (override === undefined) {
    return withTrailingSlash(endpoint.defaultUrl);
  }

  const url = override.trim();

  if (url === '') {
    throw new Error(
      `${endpoint.envVar} is set but empty, so deployment "${name}" has no base URL. ` +
        `Give it a URL, or unset it to use the default ${endpoint.defaultUrl}.`
    );
  }

  return withTrailingSlash(url);
}

/**
 * Resolves a name to an API base URL, ready to hand to `APIRequestContext`.
 *
 * An unknown name throws. It does not fall back to a default: a fallback would turn a typo into
 * a suite that ran green against a deployment nobody chose, which is the exact class of silent
 * failure this repository exists to refuse.
 */
export function resolveDeployment(
  name: string,
  env: Record<string, string | undefined> = process.env
): string {
  const deployment = findDeployment(name);

  return resolveEndpoint(
    { envVar: deployment.envVar, defaultUrl: deployment.defaultUrl },
    name,
    env
  );
}

/**
 * The registration quota of whichever deployment currently answers at this base URL.
 *
 * 🔑 By URL rather than by name, because the caller that needs this most does not know the name:
 * the `api` fixture is handed a `baseURL` by the project it runs under. Resolving each deployment
 * and comparing is what makes an environment override work — repoint `CONDUIT_API_URL` at another
 * host and the quota travels with the name, not with the string in this file.
 *
 * Returns `null` for a URL no deployment answers at, which is the same answer as *no limit found*
 * — and deliberately so: an unknown target is not one this repository has measured, so pacing it
 * would be acting on a number nobody produced.
 */
export function quotaAt(baseUrl: string | undefined): RegistrationQuota | null {
  if (baseUrl === undefined) return null;

  const wanted = withTrailingSlash(baseUrl);
  const match = DEPLOYMENTS.find(
    (deployment) => withTrailingSlash(resolveDeployment(deployment.name)) === wanted
  );

  return match?.registrationQuota ?? null;
}

/**
 * Resolves a name to a **browser UI** base URL, ready to hand to `page.goto`.
 *
 * A deployment with no UI throws, and the error names the ones that have one. It does not fall
 * back to the API URL: a browser suite pointed at a JSON endpoint fails on every locator at once,
 * and the report would then read as a hundred broken page objects rather than as one wrong
 * target. `conduit-gate` is that case, and it is not hypothetical — see its entry above.
 */
export function resolveUiDeployment(
  name: string,
  env: Record<string, string | undefined> = process.env
): string {
  const deployment = findDeployment(name);

  if (deployment.ui === null) {
    throw new Error(
      `Deployment "${name}" has no browser UI, so it cannot host a UI test. ` +
        `Deployments with a UI: ${uiDeploymentNames().join(', ')}. ` +
        `This is not a missing entry to be filled in — ${deployment.defaultUrl} publishes an API ` +
        `and nothing else.`
    );
  }

  return resolveEndpoint(deployment.ui, name, env);
}

/** The one-line reason a deployment is named, for an error message or a report. */
export function describeDeployment(name: DeploymentName): string {
  const deployment = DEPLOYMENTS.find((candidate) => candidate.name === name);
  return deployment ? deployment.description : '';
}
