import { test as base } from '@playwright/test';
import { ConduitClient } from '@api/conduitClient';
import { registerUser, type RegisteredAccount } from '@api/registerUser';

// The account `registerUser` hands back, plus a client already carrying its token. Written as an
// intersection rather than by restating the fields: a field added to `RegisteredAccount` has to
// arrive here, and spelling them out again is how that stops happening quietly.
export type RegisteredUser = RegisteredAccount & { api: ConduitClient };

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
  // pure factories. The registration itself moved to `api/registerUser.ts` when the UI layer
  // arrived in stage 3: `signedIn` in po/poFixtures.ts needs the same account without driving the
  // sign-up form, and the two fixture modules must not import each other.
  registeredUser: async ({ api }, use) => {
    const { user, token } = await registerUser(api);

    await use({ user, token, api: api.withToken(token) });

    // No teardown: the target has no endpoint for deleting a user. This is a known limitation
    // recorded in spec/FINDINGS.md, not an oversight. Accounts are recognisable by the qa_ prefix.
  },
});
