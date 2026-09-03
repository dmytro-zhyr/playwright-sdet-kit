import { test as base, request as apiRequest } from '@playwright/test';
import { RegisterPage } from '@po/pages/registerPage';
import { LoginPage } from '@po/pages/loginPage';
import { EditorPage } from '@po/pages/editorPage';
import { ArticlePage } from '@po/pages/articlePage';
import { HomePage } from '@po/pages/homePage';
import { ConduitClient } from '@api/conduitClient';
import { registerUser, type RegisteredAccount } from '@api/registerUser';
import { resolveDeployment, resolveUiDeployment, type DeploymentName } from '@deployments/registry';

export type PageObjectFixtures = {
  registerPage: RegisterPage;
  loginPage: LoginPage;
  editorPage: EditorPage;
  articlePage: ArticlePage;
  homePage: HomePage;
  uiAccount: RegisteredAccount;
  signedIn: RegisteredAccount;
};

/** The deployment whose API backs the UI project. One place, so a move cannot half-happen. */
const UI_BACKEND: DeploymentName = 'conduit-overstrict';

/** How the application stores its session. Observed 30 August 2026 — no cookie, no sessionStorage. */
const LOCAL_STORAGE_SESSION_KEY = 'jwtToken';

/**
 * Page objects, one fixture each, plus the session they are usually driven with.
 *
 * They are fixtures rather than `new RegisterPage(page)` in each test for the reason every other
 * fixture in this repository exists: the test states what it needs and receives it constructed,
 * and the day a page object needs setup the change lands here instead of in every test that
 * happened to instantiate it.
 *
 * Constructing them is free: a page object holds a `Page` and builds locators lazily, so a test
 * that names `loginPage` and never touches `editorPage` starts no extra work.
 *
 * 📌 Merged into `fixtures.ts` as one more argument to `mergeTests`, exactly as `api/` and `data/`
 * are. This module imports classes and functions from `api/`, never that module's fixtures, which
 * is what keeps the merge trivial rather than order-dependent.
 */
export const test = base.extend<PageObjectFixtures>({
  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  editorPage: async ({ page }, use) => {
    await use(new EditorPage(page));
  },

  articlePage: async ({ page }, use) => {
    await use(new ArticlePage(page));
  },

  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },

  /**
   * An account created through the **API**, and nothing else. The browser stays anonymous.
   *
   * It is a `RegisteredAccount`, the same type `registerUser` returns — there is no separate UI
   * account type. One was tried and removed: an identical record under a second name claims which
   * backend the account belongs to, and structural typing does not enforce that claim for a
   * moment. The claim is true, so it is stated here, where it is also enforced — by `UI_BACKEND`
   * below being the only address this fixture registers against.
   *
   * ⛔ It does not use `registeredUser` from `api/apiFixtures.ts`, and the reason is a trap worth
   * naming: that fixture is built on the standard `request` fixture, which carries **the project's
   * `baseURL`** — and in the `ui` project that is the browser UI, not the API. A UI test asking
   * for `registeredUser` would POST `/users` at `conduit.bondaracademy.com` and fail on an answer
   * that is a web page. So this fixture opens its own context against the API of the deployment
   * the UI project is pointed at, named once in `UI_BACKEND` above.
   *
   * 🔑 That coupling is the price of two gates. The UI project runs against `conduit-overstrict`
   * and the contract project against `conduit-gate`; a UI test's setup must reach the backend
   * **its own** browser is talking to, or the account it creates will not exist as far as the page
   * is concerned.
   */
  uiAccount: async ({}, use) => {
    const context = await apiRequest.newContext({
      baseURL: resolveDeployment(UI_BACKEND),
      extraHTTPHeaders: { 'Content-Type': 'application/json' },
    });

    try {
      await use(await registerUser(new ConduitClient(context)));
    } finally {
      await context.dispose();
    }
  },

  /**
   * The same account, with its token seeded into the browser before the application boots.
   *
   * 🔑 This is the point of having both layers in one repository. Registering through the sign-up
   * form to reach the editor would make every editor test also a registration test: three fields,
   * a submit, a redirect and a guard, all of which can fail for reasons that have nothing to do
   * with publishing an article. Setup goes through the fastest honest route; only the behaviour
   * under test is driven through the interface.
   *
   * ⛔ The exception is `tests/ui/registration.spec.ts`, which drives the form on purpose — a test
   * **about** sign-up may not shortcut sign-up. The rule is not "the API is faster", it is "setup
   * through the API, the subject through the UI".
   *
   * `addInitScript` runs before any page script on every navigation in this context, which is what
   * makes the app find a session already there rather than being told about one afterwards.
   * Writing to `localStorage` after `goto` would leave the first render anonymous, and the test
   * would then be racing the app's own bootstrap.
   */
  signedIn: async ({ page, uiAccount }, use) => {
    await page.addInitScript(
      ([key, value]) => {
        window.localStorage.setItem(key, value);
      },
      [LOCAL_STORAGE_SESSION_KEY, uiAccount.token] as const
    );

    await use(uiAccount);
  },
});

/**
 * The UI base URL for a named deployment, for a config or a test that needs the address itself.
 *
 * Re-exported here so a UI test never reaches for `resolveUiDeployment` and a raw string: it asks
 * for a deployment by name, and a deployment with no browser UI — `conduit-gate` — throws by name
 * instead of quietly handing back its API URL. See `deployments/registry.ts`.
 */
export function uiBaseUrl(name: DeploymentName): string {
  return resolveUiDeployment(name);
}
