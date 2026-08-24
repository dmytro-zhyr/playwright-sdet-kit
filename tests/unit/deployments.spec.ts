import { test, expect } from '@playwright/test';
import { DEPLOYMENTS, deploymentNames, resolveDeployment } from '@/api/deployments';

// An environment with nothing in it, so a default is exercised as a default rather than as
// whatever the machine running the suite happens to export.
const NO_ENV: Record<string, string | undefined> = {};

test.describe('resolveDeployment — a known name', () => {
  // Turns red if a deployment loses its working default, which would make the repository
  // unrunnable without a .env — the one thing .env.example promises is not required.
  test('every registered name resolves with no environment at all', () => {
    const resolved = deploymentNames().map(
      (name) => `${name} -> ${resolveDeployment(name, NO_ENV)}`
    );

    expect(resolved).toEqual([
      'conduit-gate -> https://realworld.habsida.net/api/',
      'conduit-unsound -> https://api.realworld.show/api/',
      'conduit-overstrict -> https://conduit-api.bondaracademy.com/api/',
    ]);
  });

  // Turns red if withTrailingSlash stops being applied on the way out of resolution. Without it
  // `new URL('tags', base)` drops the /api segment and every request quietly leaves for the wrong
  // path — the failure api/url.ts exists to prevent.
  test('the resolved URL always ends with a slash', () => {
    const missingSlash = deploymentNames()
      .map((name) => resolveDeployment(name, NO_ENV))
      .filter((url) => !url.endsWith('/'));

    expect(missingSlash, 'a base URL without a trailing slash drops its own path').toEqual([]);
  });

  // Turns red if a deployment stops being repointable — the URL hardcoded past its variable, or
  // the variable renamed out from under a .env that still sets the old one.
  test('an environment variable overrides the default', () => {
    const url = resolveDeployment('conduit-gate', {
      CONDUIT_API_URL: 'https://elsewhere.test/api/',
    });

    expect(url).toBe('https://elsewhere.test/api/');
  });

  // Turns red if an override skips the normalisation the default gets. A URL typed into a .env is
  // exactly where the trailing slash goes missing, so this is the case that matters most.
  test('an override without a trailing slash is given one', () => {
    const url = resolveDeployment('conduit-unsound', {
      CONDUIT_DEFECTS_API_URL: 'https://elsewhere.test/api',
    });

    expect(url).toBe('https://elsewhere.test/api/');
  });

  // Turns red if each deployment stops reading its own variable — one deployment answering to
  // another's would repoint two targets with one line and the suites would compare a host to
  // itself.
  test('each deployment reads only its own variable', () => {
    const env = { CONDUIT_API_URL: 'https://only-the-gate-moved.test/api' };

    expect(resolveDeployment('conduit-gate', env)).toBe('https://only-the-gate-moved.test/api/');
    expect(resolveDeployment('conduit-unsound', env)).toBe('https://api.realworld.show/api/');
    expect(resolveDeployment('conduit-overstrict', env)).toBe(
      'https://conduit-api.bondaracademy.com/api/'
    );
  });
});

test.describe('resolveDeployment — a name it does not know', () => {
  // Turns red the moment an unknown name is answered with anything other than a throw — a default,
  // an empty string, an undefined that becomes a request to the wrong host. A typo that silently
  // falls back is a whole suite passing against a deployment nobody chose.
  test('an unknown name throws instead of falling back', () => {
    // Typed as string on purpose: the fixture's parameter is the union, so this is the runtime
    // half of the guard — the case a name computed at run time can still reach.
    const typo: string = 'conduit-gaet';

    expect(() => resolveDeployment(typo, NO_ENV)).toThrow(/Unknown deployment "conduit-gaet"/);
  });

  // Turns red if the error stops offering the names that would have worked. An error that says
  // only "unknown" leaves the reader guessing at the spelling that failed them.
  test('the error names every deployment that would have worked', () => {
    let message = '';
    try {
      resolveDeployment('gate', NO_ENV);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    const unnamed = deploymentNames().filter((name) => !message.includes(name));
    expect(unnamed, 'the error must list the valid names, not just reject the invalid one').toEqual(
      []
    );
  });

  // Turns red if an empty variable is treated as "unset" and quietly swapped for the default, or
  // worse, passed through: a base URL of '' resolves every path against nothing.
  test('a variable that is set but empty throws rather than falling back', () => {
    expect(() => resolveDeployment('conduit-gate', { CONDUIT_API_URL: '   ' })).toThrow(
      /CONDUIT_API_URL is set but empty/
    );
  });
});

test.describe('the registry itself', () => {
  // Turns red if two deployments collide on a name or on a variable. Either one makes the second
  // entry unreachable, and `find` would hand every caller the first — silently.
  test('names and variables are unique', () => {
    const names = DEPLOYMENTS.map((deployment) => deployment.name);
    const variables = DEPLOYMENTS.map((deployment) => deployment.envVar);

    expect(new Set(names).size, 'two deployments share a name').toBe(names.length);
    expect(new Set(variables).size, 'two deployments share a variable').toBe(variables.length);
  });

  // Turns red if an entry arrives without the description that says why it is worth naming — a
  // name with nothing behind it is the host abbreviation this mechanism replaced.
  test('every deployment says why it is named', () => {
    const undescribed = DEPLOYMENTS.filter(
      (deployment) => deployment.description.trim() === ''
    ).map((deployment) => deployment.name);

    expect(undescribed).toEqual([]);
  });
});
