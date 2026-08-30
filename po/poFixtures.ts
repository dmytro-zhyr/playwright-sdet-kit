import { test as base } from '@playwright/test';
import { Nav } from '@/po/nav';
import { RegisterPage } from '@/po/registerPage';
import { LoginPage } from '@/po/loginPage';
import { resolveUiDeployment, type DeploymentName } from '@/api/deployments';

export type PageObjectFixtures = {
  nav: Nav;
  registerPage: RegisterPage;
  loginPage: LoginPage;
};

/**
 * Page objects, one fixture each.
 *
 * They are fixtures rather than `new RegisterPage(page)` in each test for the reason every other
 * fixture in this repository exists: the test states what it needs and receives it constructed,
 * and the day a page object needs setup — a base URL, a dismissed banner, a seeded account — the
 * change lands here instead of in every test that happened to instantiate it.
 *
 * Constructing them is free: a page object holds a `Page` and builds locators lazily, so a test
 * that names `loginPage` and never touches `registerPage` starts no extra work.
 *
 * 📌 Merged into `fixtures.ts` as one more argument to `mergeTests`, exactly as `api/` and `data/`
 * are. This module depends on no other fixture module, which is what keeps that merge trivial
 * rather than order-dependent.
 */
export const test = base.extend<PageObjectFixtures>({
  nav: async ({ page }, use) => {
    await use(new Nav(page));
  },

  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
});

/**
 * The UI base URL for a named deployment, for a config or a test that needs the address itself.
 *
 * Re-exported here so a UI test never reaches for `resolveUiDeployment` and a raw string: it asks
 * for a deployment by name, and a deployment with no browser UI — `conduit-gate` — throws by name
 * instead of quietly handing back its API URL. See `api/deployments.ts`.
 */
export function uiBaseUrl(name: DeploymentName): string {
  return resolveUiDeployment(name);
}
