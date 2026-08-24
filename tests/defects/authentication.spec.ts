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

/** The four endpoints of D-9, with the payload that makes each request valid. */
const ORDERING_PROBE = 'qa_ordering_probe';

const VALIDATED_BEFORE_AUTHENTICATED: { method: 'put' | 'post'; path: string; valid: unknown }[] = [
  { method: 'put', path: '/user', valid: { user: { bio: ORDERING_PROBE } } },
  {
    method: 'post',
    path: '/articles',
    valid: {
      article: { title: ORDERING_PROBE, description: ORDERING_PROBE, body: ORDERING_PROBE },
    },
  },
  {
    method: 'put',
    path: '/articles/there-is-no-such-slug-000',
    valid: { article: { title: ORDERING_PROBE } },
  },
  {
    method: 'post',
    path: '/articles/there-is-no-such-slug-000/comments',
    valid: { comment: { body: ORDERING_PROBE } },
  },
];

// Turns green the day the gate deployment refuses an anonymous caller before it reads the body.
// The other half of C-003 — the twelve guarded endpoints, sent payloads that pass validation, all
// answering 401 — stays in tests/contract/authentication.spec.ts and is green there.
//
// 🔑 The whole test is the evidence: the two halves below differ in one thing, the payload. The
// valid one is answered 401, so the guard is attached; the empty one is answered 422, so the
// guard is not what answers first. The API tells a caller it has not authenticated what its
// request body should have looked like.
test(
  'C-003 — an anonymous caller is refused before the body is validated',
  {
    annotation: {
      type: 'issue',
      description:
        'spec/FINDINGS.md — D-9; GitHub issue to be filed when the repository is published',
    },
  },
  async ({ deployment }) => {
    // Named, not inherited: D-9 is a defect of the deployment the contract gate runs against, not
    // of the one this project points at. D-4 above is about the other. Two deployments, one file.
    const gate = await deployment('conduit-gate');

    const control: string[] = [];
    for (const { method, path, valid } of VALIDATED_BEFORE_AUTHENTICATED) {
      const response =
        method === 'put' ? await gate.put(path, valid) : await gate.post(path, valid);
      control.push(`${method} ${path} -> ${response.status}`);
    }

    expect(
      control,
      'the control: with a payload that passes validation these four already answer 401, which is ' +
        'what makes the observation below about ordering and not about a missing guard'
    ).toEqual(VALIDATED_BEFORE_AUTHENTICATED.map(({ method, path }) => `${method} ${path} -> 401`));

    const observed: string[] = [];
    for (const { method, path } of VALIDATED_BEFORE_AUTHENTICATED) {
      const response = method === 'put' ? await gate.put(path, {}) : await gate.post(path, {});
      observed.push(`${method} ${path} -> ${response.status}`);
    }

    expect(
      observed,
      'an anonymous caller must be refused 401 whatever it sends; a 422 here means the body was ' +
        'read and judged before the credential was looked for'
    ).toEqual(VALIDATED_BEFORE_AUTHENTICATED.map(({ method, path }) => `${method} ${path} -> 401`));
  }
);
