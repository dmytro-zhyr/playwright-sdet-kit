import { withTrailingSlash } from '@/api/url';

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
 * The registry is a list rather than a switch on purpose: adding the second product in stage 5
 * is appending entries, not editing resolution logic. Nothing here knows the word "Conduit"
 * except the data.
 */
export type Deployment = {
  /** How a test asks for this deployment. Meaningful to a reader; never a host abbreviation. */
  readonly name: string;
  /** The variable that overrides the default. A deployment is repointed, never re-hardcoded. */
  readonly envVar: string;
  /** Used when the variable is unset, so the repository runs with no `.env` at all. */
  readonly defaultUrl: string;
  /** Why this deployment is worth naming — the fact a test author needs before choosing it. */
  readonly description: string;
};

export const DEPLOYMENTS = [
  {
    name: 'conduit-gate',
    envVar: 'CONDUIT_API_URL',
    defaultUrl: 'https://realworld.habsida.net/api',
    description:
      'the deployment the contract gate is measured against; conforms broadly, and D-6 to D-9 in spec/FINDINGS.md are its',
  },
  {
    name: 'conduit-unsound',
    envVar: 'CONDUIT_DEFECTS_API_URL',
    defaultUrl: 'https://api.realworld.show/api',
    description:
      'uniqueness, identity and visibility all fail here; D-1 to D-5 in spec/FINDINGS.md are its',
  },
  {
    name: 'conduit-overstrict',
    envVar: 'CONDUIT_OVERSTRICT_API_URL',
    defaultUrl: 'https://conduit-api.bondaracademy.com/api',
    description:
      'conforms, but rejects a username longer than 20 characters — a limit the specification never states',
  },
] as const satisfies readonly Deployment[];

/** The names a test may ask for. A typo is a compile error before it is a runtime one. */
export type DeploymentName = (typeof DEPLOYMENTS)[number]['name'];

/** Every known name, in registry order — what an error message offers instead of a guess. */
export function deploymentNames(): DeploymentName[] {
  return DEPLOYMENTS.map((deployment) => deployment.name);
}

/**
 * Resolves a name to a base URL, ready to hand to `APIRequestContext`.
 *
 * The trailing slash is applied here and nowhere else. Without it `new URL('tags', base)` drops
 * the `/api` segment and every request goes to the wrong path — quietly, with plausible-looking
 * 404s. See `api/url.ts` for the four spellings and why only one of them works.
 *
 * ⛔ An unknown name throws. It does not fall back to a default: a fallback would turn a typo
 * into a suite that ran green against a deployment nobody chose, which is the exact class of
 * silent failure this repository exists to refuse.
 *
 * ⛔ A variable that is set but empty throws too, for the same reason: `''` would resolve to a
 * base URL of `/` and every request would leave for nowhere.
 */
export function resolveDeployment(
  name: string,
  env: Record<string, string | undefined> = process.env
): string {
  const deployment = DEPLOYMENTS.find((candidate) => candidate.name === name);

  if (!deployment) {
    throw new Error(
      `Unknown deployment "${name}". Known deployments: ${deploymentNames().join(', ')}. ` +
        `A name is never guessed and never falls back to a default — fix the name, or add the ` +
        `deployment to api/deployments.ts.`
    );
  }

  const override = env[deployment.envVar];

  if (override === undefined) {
    return withTrailingSlash(deployment.defaultUrl);
  }

  const url = override.trim();

  if (url === '') {
    throw new Error(
      `${deployment.envVar} is set but empty, so deployment "${name}" has no base URL. ` +
        `Give it a URL, or unset it to use the default ${deployment.defaultUrl}.`
    );
  }

  return withTrailingSlash(url);
}

/** The one-line reason a deployment is named, for an error message or a report. */
export function describeDeployment(name: DeploymentName): string {
  const deployment = DEPLOYMENTS.find((candidate) => candidate.name === name);
  return deployment ? deployment.description : '';
}
