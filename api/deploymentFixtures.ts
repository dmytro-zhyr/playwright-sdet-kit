import { test as base, request as apiRequest } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { ConduitClient } from '@api/conduitClient';
import { describeDeployment, resolveDeployment, type DeploymentName } from '@api/deployments';

/** Opens a client on a named deployment. Awaited, because a request context is created for it. */
export type OpenDeployment = (name: DeploymentName) => Promise<ConduitClient>;

export type DeploymentFixtures = {
  deployment: OpenDeployment;
};

/**
 * `deployment` — a client for a deployment the test names itself.
 *
 * ```ts
 * const gate = await deployment('conduit-gate');
 * ```
 *
 * Every call builds its **own** `APIRequestContext` with that deployment's base URL, and every
 * context opened by a test is disposed when that test ends. Nothing is cached across tests: a
 * shared context would carry one test's cookies, and — worse — would outlive the test that
 * created it, which is how a suite ends up with connections nobody owns.
 *
 * A test may open several deployments; `tests/defects/authentication.spec.ts` does, because the
 * two defects it reproduces live on two different ones.
 *
 * 📌 This is not a replacement for `api`. `api` is the project's own target and is what a
 * contract test wants. `deployment` is for a test that is **about** a particular deployment,
 * which is every test in `tests/defects/`.
 */
export const test = base.extend<DeploymentFixtures>({
  deployment: async ({}, use, testInfo) => {
    const opened: APIRequestContext[] = [];

    const open = async (name: DeploymentName): Promise<ConduitClient> => {
      // Throws on an unknown name, before a single request is sent. See api/deployments.ts.
      const baseURL = resolveDeployment(name);

      // The report should say which deployment a red test was talking to. Without this the
      // failure of a defects test reads the same whichever deployment it was about.
      testInfo.annotations.push({
        type: 'deployment',
        description: `${name} — ${baseURL} — ${describeDeployment(name)}`,
      });

      const context = await apiRequest.newContext({
        baseURL,
        extraHTTPHeaders: { 'Content-Type': 'application/json' },
      });
      opened.push(context);

      return new ConduitClient(context);
    };

    await use(open);

    await Promise.all(opened.map((context) => context.dispose()));
  },
});
