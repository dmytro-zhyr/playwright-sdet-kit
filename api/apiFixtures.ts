import { test as base } from '@playwright/test';
import { ConduitClient } from '@/api/conduitClient';

export type ApiFixtures = {
  api: ConduitClient;
};

export const test = base.extend<ApiFixtures>({
  // Built on the standard `request` fixture: an isolated APIRequestContext carrying the baseURL
  // from the config. No browser starts, because the `page` fixture is never requested.
  api: async ({ request }, use) => {
    await use(new ConduitClient(request));
  },
});
