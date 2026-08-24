import { test, expect } from '@/fixtures';

// Eight is the number that reproduced D-4 reliably during reconnaissance. Fewer parallel
// registrations sometimes let every token resolve correctly and the defect stays hidden.
const CONCURRENT_REGISTRATIONS = 8;

type Registration = { username: string; email: string; token: string };

// Turns green the day the target stops leaking accounts across concurrent registrations — this
// one is inverted, and green is the signal that D-4 is fixed and contract can go parallel again.
test(
  'a token identifies its own user when accounts are registered concurrently',
  {
    annotation: {
      type: 'issue',
      description:
        'spec/FINDINGS.md — D-4; GitHub issue to be filed when the repository is published',
    },
  },
  async ({ api, factories }) => {
    const users = Array.from({ length: CONCURRENT_REGISTRATIONS }, () => factories.user.build());

    // Promise.all, not a loop: run one at a time and every token resolves correctly, so the
    // sequential version of this test is green and proves nothing.
    const registrations = await Promise.all(
      users.map(async (user) => {
        const response = await api.post('/users', { user });
        const body = response.body as { user?: { token?: string } };
        const token = body.user?.token;

        expect(
          token,
          `registration of ${user.username} returned HTTP ${response.status} without a token: ` +
            JSON.stringify(response.body)
        ).toBeTruthy();

        return { username: user.username, email: user.email, token: token as string };
      })
    );

    const responses = await Promise.all(
      registrations.map(async (registration: Registration) => ({
        registration,
        response: await api.withToken(registration.token).get('/user'),
      }))
    );

    const wrong = responses
      .filter(({ registration, response }) => {
        const body = response.body as { user?: { username?: string; email?: string } };
        return (
          body.user?.username !== registration.username || body.user?.email !== registration.email
        );
      })
      .map(({ registration, response }) => {
        const body = response.body as { user?: { username?: string; email?: string } };
        return (
          `presented the token of ${registration.username} (${registration.email}) → ` +
          `HTTP ${response.status} returned ${body.user?.username ?? '<no username>'} ` +
          `(${body.user?.email ?? '<no email>'})`
        );
      });

    expect(
      wrong,
      `${wrong.length} of ${CONCURRENT_REGISTRATIONS} responses returned somebody else's ` +
        `account. A token must identify the user it was issued to; here it does not, and one ` +
        `account's email is handed to another caller:\n${wrong.join('\n')}`
    ).toEqual([]);
  }
);
