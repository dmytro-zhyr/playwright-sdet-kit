import { test, expect } from '@playwright/test';
import {
  DEPLOYMENTS,
  deploymentNames,
  resolveDeployment,
  resolveUiDeployment,
  uiDeploymentNames,
} from '@deployments/registry';
import { thrownMessage } from '@support/thrown';

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
  // path — the failure deployments/url.ts exists to prevent.
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
    const message = thrownMessage(() => resolveDeployment('gate', NO_ENV));

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

test.describe('resolveUiDeployment — the browser surface', () => {
  // Turns red if a UI-less deployment starts answering with a URL. The gate is the case that
  // matters: it publishes an API and no page at all, so anything returned here would be the API
  // base, and a browser suite would open JSON and fail on every locator at once. One wrong target
  // must not be reported as a hundred broken page objects.
  test('a deployment with no UI throws instead of returning its API URL', () => {
    expect(() => resolveUiDeployment('conduit-gate', NO_ENV)).toThrow(
      /Deployment "conduit-gate" has no browser UI/
    );
  });

  // Turns red if the error stops offering the deployments that would have worked — the same
  // courtesy the unknown-name error already owes its reader.
  test('the error names every deployment that does have a UI', () => {
    const message = thrownMessage(() => resolveUiDeployment('conduit-gate', NO_ENV));

    expect(uiDeploymentNames().filter((name) => !message.includes(name))).toEqual([]);
  });

  // Turns red if a UI loses its working default, which would make the UI suite unrunnable without
  // a .env — the promise .env.example makes for every other surface.
  test('every deployment that has a UI resolves with no environment at all', () => {
    const resolved = uiDeploymentNames().map(
      (name) => `${name} -> ${resolveUiDeployment(name, NO_ENV)}`
    );

    expect(resolved).toEqual([
      'conduit-unsound -> https://demo.realworld.show/',
      'conduit-overstrict -> https://conduit.bondaracademy.com/',
    ]);
  });

  // Turns red the moment the two surfaces of one deployment collapse into a single address. They
  // are separate hosts here, and a UI resolved to an API base is the failure the previous test
  // guards against, arriving through the back door.
  test('the UI of a deployment is not its API', () => {
    for (const name of uiDeploymentNames()) {
      expect(resolveUiDeployment(name, NO_ENV), `${name} resolved its UI to its API`).not.toBe(
        resolveDeployment(name, NO_ENV)
      );
    }
  });

  // Turns red if the UI stops being repointable, or starts reading the API variable — either one
  // would move two targets with a single line and leave the suites comparing a host to itself.
  test('the UI reads its own variable and the API keeps reading the API one', () => {
    const env = {
      CONDUIT_OVERSTRICT_UI_URL: 'https://ui-only-moved.test',
      CONDUIT_OVERSTRICT_API_URL: 'https://api-only-moved.test/api',
    };

    expect(resolveUiDeployment('conduit-overstrict', env)).toBe('https://ui-only-moved.test/');
    expect(resolveDeployment('conduit-overstrict', env)).toBe('https://api-only-moved.test/api/');
  });

  // Turns red if the UI surface skips the emptiness guard the API surface has. Both go through
  // one resolver so that neither can quietly grow a rule the other lacks; this is what says so.
  test('a UI variable that is set but empty throws rather than falling back', () => {
    expect(() => resolveUiDeployment('conduit-unsound', { CONDUIT_DEFECTS_UI_URL: '   ' })).toThrow(
      /CONDUIT_DEFECTS_UI_URL is set but empty/
    );
  });

  // Turns red if an unknown name reaches the UI resolver and is answered with the no-UI error
  // instead of the unknown-name one. Two different mistakes deserve two different messages: a
  // typo is fixed in the test, a missing UI is not fixable at all.
  test('an unknown name is reported as unknown, not as having no UI', () => {
    const typo: string = 'conduit-overstict';

    expect(() => resolveUiDeployment(typo, NO_ENV)).toThrow(
      /Unknown deployment "conduit-overstict"/
    );
  });
});

test.describe('the UI half of the registry', () => {
  // Turns red if a UI variable collides with an API variable, or with another UI variable. Either
  // collision makes one surface unreachable while the other silently answers for it.
  test('every variable in the registry, on either surface, is unique', () => {
    const variables = DEPLOYMENTS.flatMap((deployment) =>
      deployment.ui ? [deployment.envVar, deployment.ui.envVar] : [deployment.envVar]
    );

    expect(new Set(variables).size, `two surfaces share a variable: ${variables.join(', ')}`).toBe(
      variables.length
    );
  });

  // 🔑 There is no test here for "every deployment states whether it has a UI", and the absence
  // is deliberate. One was written, and `tsc` refused it: `ui` is declared `Endpoint | null`, so
  // `deployment.ui === undefined` narrows to `never` and the filter can only ever be empty. The
  // compiler was reporting that the check could not fail — the same verdict this repository
  // reaches about a green test that asserts nothing, arriving from the type system instead of
  // from a reviewer. The type carries the rule; a runtime test would only have restated it.
  //
  // What a type cannot carry is whether an entry that claims a UI actually gives it an address,
  // so that is what is checked instead.
  test('a deployment that claims a UI gives it both a variable and a default', () => {
    const incomplete = DEPLOYMENTS.filter(
      (deployment) =>
        deployment.ui !== null &&
        (deployment.ui.envVar.trim() === '' || deployment.ui.defaultUrl.trim() === '')
    ).map((deployment) => deployment.name);

    expect(incomplete, 'a UI with no address is worse than no UI: it resolves to nothing').toEqual(
      []
    );
  });
});
