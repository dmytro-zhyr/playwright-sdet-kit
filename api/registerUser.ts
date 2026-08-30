import type { ConduitClient } from '@/api/conduitClient';
import { userFactory, type NewUser } from '@/data/userFactory';

export type RegisteredAccount = {
  user: NewUser;
  token: string;
};

/**
 * Creates one account through the API and returns it with its token.
 *
 * A plain function rather than a fixture, because two fixtures in two independent modules need
 * it: `registeredUser` in `api/apiFixtures.ts`, and `signedIn` in `po/poFixtures.ts`, which seeds
 * a browser session without driving the sign-up form. Those modules must not import each other —
 * that independence is what keeps `mergeTests` order-free — so the shared part is neither of them.
 *
 * ⛔ It throws rather than returning a failure. Registration here is **setup**, and setup that
 * quietly half-succeeds produces a test failing on a missing element three steps later, naming the
 * wrong thing. The error carries the status and the body so the report says what actually broke.
 */
export async function registerUser(api: ConduitClient): Promise<RegisteredAccount> {
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

  return { user, token };
}
