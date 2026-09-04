import { test, expect } from '@fixtures';
import { parseBody } from '@assertions/parseBody';
import { ErrorsSchema, UserResponseSchema } from '@schemas/conduit.schema';

// The specification states no success status for registration — anywhere, and for any endpoint.
// It says only that the call "returns a User". Conforming deployments disagree: 201 on
// api.realworld.show, 200 on realworld.habsida.net. So this set is a gap in the contract rather
// than a preference, and every assertion using it names the gap in its message. What still makes
// those assertions red: a 404, a 422, a 500 — anything that is not the endpoint succeeding.
const REGISTRATION_SUCCESS = [200, 201];
const REGISTRATION_SUCCESS_MESSAGE =
  'the specification states no success status for registration, only that it returns a User, so 200 and 201 are both accepted';

// The same gap on the login side, and it is the same wording in the specification: "returns a
// User". All three live deployments answer 200 today, which is agreement rather than a contract.
const LOGIN_SUCCESS = [200, 201];
const LOGIN_SUCCESS_MESSAGE =
  'the specification states no success status for login, only that it returns a User, so 200 and 201 are both accepted';

// 📌 The two factory tests that used to open this file are in `tests/unit/factories.spec.ts` now.
// They asserted on a built object and touched no network, so they belonged to the suite that tests
// this repository's own code — not to the one that needs a live deployment to run at all.

// Turns red if registration stops returning a usable token, or if the token stops being attached
// to the client the fixture hands over.
test('registeredUser creates an account and hands over a working token', async ({
  registeredUser,
}) => {
  const response = await registeredUser.api.get('/user');

  expect(response.status).toBe(200);

  const body = response.body as { user?: { email?: string } };
  expect(body.user?.email).toBe(registeredUser.user.email);
});

// Turns red if the anonymous client starts carrying a token from somewhere, which would make
// every "requires auth" test pass for the wrong reason.
test('the anonymous client is not authenticated', async ({ api }) => {
  const response = await api.get('/user');

  expect(response.status).toBe(401);
});

// Turns red if registration stops succeeding at all — a 404, a 422, a 500 — if the serializer
// changes what it hands back — a dropped, renamed or added field, an internal identifier leaking
// into the envelope — or if the username or the email that comes back is not the one that was
// sent. The schema is strict, so an added field is red too. What used to close this test — that a
// freshly registered account carries `null` in both `bio` and `image` — moved to
// tests/defects/registration.spec.ts: the gate deployment answers `bio: ""` at creation, which is
// D-11.
test('C-029 — registration answers with the account it was given', async ({ api, factories }) => {
  const account = factories.user.build();

  const response = await api.post('/users', { user: account });

  expect(REGISTRATION_SUCCESS, REGISTRATION_SUCCESS_MESSAGE).toContain(response.status);
  const { user } = parseBody(response.body, UserResponseSchema);
  expect(user.username, 'registration must echo the username it was given').toBe(account.username);
  expect(user.email, 'registration must echo the email it was given').toBe(account.email);
});

// Turns red if one of the three presence validators is dropped — the field goes missing and the
// account is created anyway — or if a validation failure stops being a 422 whose only key is
// `errors`. The registration at the end sends the very account the three refusals were built
// from: it proves the payload shape and the address are right, and it proves no refused request
// quietly consumed the username or the email, which is the half of the expectation a status
// cannot show.
test('C-030 — registration refuses a body missing a required field', async ({ api, factories }) => {
  const account = factories.user.build();
  const omissions = ['email', 'username', 'password'] as const;
  const observed: string[] = [];

  for (const omitted of omissions) {
    const user: Record<string, string> = { ...account };
    delete user[omitted];

    const response = await api.post('/users', { user });
    observed.push(`without ${omitted} -> ${response.status}`);

    const { errors } = parseBody(response.body, ErrorsSchema);
    expect(
      Object.keys(errors).length,
      `the 422 for a missing ${omitted} must name at least one field`
    ).toBeGreaterThan(0);
  }

  expect(observed, 'each omission must be rejected with 422').toEqual(
    omissions.map((omitted) => `without ${omitted} -> 422`)
  );

  const complete = await api.post('/users', { user: account });
  expect(
    REGISTRATION_SUCCESS,
    `no refused request may have created the account, so the complete one must still be accepted — ${REGISTRATION_SUCCESS_MESSAGE}`
  ).toContain(complete.status);
});

// Turns red if either uniqueness constraint stops being enforced, or stops being translated into
// a 422 that carries a message — an account created on a taken email, a database violation
// surfacing as a 500, an `errors` object that says nothing — or if a 422 is answered while the
// account is created anyway. The fresh username the duplicate-email attempt carried, and the
// fresh email the duplicate-username attempt carried, are what make that visible: a profile that
// should not exist yet answers with something other than 404, or a login with credentials nobody
// has registered succeeds. The fresh registration at the end proves the endpoint accepts what it
// should, so a red above is about the duplicate and not about the request.
test('C-031 — registration refuses an email or a username another account holds', async ({
  api,
  factories,
  registeredUser,
}) => {
  // Built up front, not inline, so the fresh half of each colliding payload — the username the
  // email-collision kept, the email the username-collision kept — is still in hand afterwards.
  const emailCollision = factories.user.build();
  const usernameCollision = factories.user.build();

  const takenEmail = await api.post('/users', {
    user: { ...emailCollision, email: registeredUser.user.email },
  });
  const takenUsername = await api.post('/users', {
    user: { ...usernameCollision, username: registeredUser.user.username },
  });

  expect(
    [takenEmail.status, takenUsername.status],
    'an email or a username another account holds must be refused'
  ).toEqual([422, 422]);

  // The case asks for an `errors` envelope and nothing about which key carries the message: the
  // specification's own example keys a validation message under `body`, so demanding a key named
  // after the offending column would be asserting more than the contract.
  const refusals = [
    ['email', takenEmail],
    ['username', takenUsername],
  ] as const;

  for (const [collided, refusal] of refusals) {
    const { errors } = parseBody(refusal.body, ErrorsSchema);
    expect(
      Object.values(errors).flat().length,
      `the refusal of a taken ${collided} must carry at least one message`
    ).toBeGreaterThan(0);
  }

  // The second half of the expectation, for the duplicate-email refusal: it carried a fresh
  // username nobody else holds, so an account it created anyway would be the only account
  // answering to that username. R-088 makes that observable — an unknown username is 404 — so any
  // other status here is that account existing. Read authenticated, not anonymously: the profile
  // 404/200 case in `tests/contract/not-found.spec.ts` proves a 200 for an existing account only
  // through `registeredUser.api`, never through the anonymous client — the case that would prove
  // the anonymous read is not automated in this suite — so anchoring this 404 to the same
  // authenticated client is what keeps it from being a 404 for the wrong reason (a guard the route
  // attaches only to unauthenticated callers).
  const emailCollisionProfile = await registeredUser.api.get(
    `/profiles/${emailCollision.username}`
  );
  expect(
    emailCollisionProfile.status,
    'the refusal of a taken email must not have created an account under the fresh username it carried'
  ).toBe(404);

  // The second half, for the duplicate-username refusal: it carried a fresh email nobody else
  // holds, and there is no profile lookup keyed by email to read that back directly. But a leftover
  // account would have been created with usernameCollision's own password, so it would log in on
  // that email and that password; if it does not exist, that login has nothing to succeed against.
  const usernameCollisionLogin = await api.post('/users/login', {
    user: { email: usernameCollision.email, password: usernameCollision.password },
  });
  expect(
    LOGIN_SUCCESS,
    `the refusal of a taken username must not have created an account under the fresh email it carried — ${LOGIN_SUCCESS_MESSAGE}`
  ).not.toContain(usernameCollisionLogin.status);

  const fresh = await api.post('/users', { user: factories.user.build() });
  expect(
    REGISTRATION_SUCCESS,
    `a pair nobody holds must still be accepted — ${REGISTRATION_SUCCESS_MESSAGE}`
  ).toContain(fresh.status);
});

// Turns red if registration stores the password in a form the login comparison cannot reproduce —
// a hash written on one side and compared on the other, a truncation, an encoding difference —
// which is invisible to a test that only ever reads the registration response. It also turns red
// if the login answers with an account other than the one just created.
test('C-032 — the credentials a registration was given log in afterwards', async ({
  api,
  factories,
}) => {
  const account = factories.user.build();

  const registration = await api.post('/users', { user: account });
  expect(REGISTRATION_SUCCESS, REGISTRATION_SUCCESS_MESSAGE).toContain(registration.status);

  const login = await api.post('/users/login', {
    user: { email: account.email, password: account.password },
  });

  expect(LOGIN_SUCCESS, LOGIN_SUCCESS_MESSAGE).toContain(login.status);
  const { user } = parseBody(login.body, UserResponseSchema);
  expect(
    [user.email, user.username],
    'the login must answer with the account the registration created'
  ).toEqual([account.email, account.username]);
});
