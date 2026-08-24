import { test as base } from '@playwright/test';
import { ConduitClient } from '@/api/conduitClient';
import { userFactory, type NewUser } from '@/data/userFactory';

export type RegisteredUser = {
  user: NewUser;
  token: string;
  api: ConduitClient;
};

export type ApiFixtures = {
  api: ConduitClient;
  registeredUser: RegisteredUser;
};

export const test = base.extend<ApiFixtures>({
  // Built on the standard `request` fixture: an isolated APIRequestContext carrying the baseURL
  // from the config. No browser starts, because the `page` fixture is never requested.
  api: async ({ request }, use) => {
    await use(new ConduitClient(request));
  },

  // This fixture performs network I/O, which is why it lives here and not in data/ next to the
  // pure factories. It imports the factory as an ordinary import rather than depending on the
  // data fixture module, so the two fixture modules stay independent of each other.
  registeredUser: async ({ api }, use) => {
    const user = userFactory.build();
    const response = await api.post('/users', { user });

    if (response.status !== 200 && response.status !== 201) {
      throw new Error(
        `Could not register the test user: HTTP ${response.status}, body ${JSON.stringify(response.body)}`
      );
    }

    const body = response.body as { user?: { token?: string } };
    const token = body.user?.token;
    if (!token) {
      throw new Error(
        `The registration response carried no user.token: ${JSON.stringify(response.body)}`
      );
    }

    await use({ user, token, api: api.withToken(token) });

    // No teardown: the target has no endpoint for deleting a user. This is a known limitation
    // recorded in spec/FINDINGS.md, not an oversight. Accounts are recognisable by the qa_ prefix.
  },
});
