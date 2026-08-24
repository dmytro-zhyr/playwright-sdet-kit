import { test, expect } from '@/fixtures';
import { ErrorsSchema, UserResponseSchema } from '@/schemas/conduit.schema';

// The specification states no success status for registration — anywhere, and for any endpoint.
// It says only that the call "returns a User". Conforming deployments disagree: 201 on
// api.realworld.show, 200 on realworld.habsida.net. So this set is a gap in the contract rather
// than a preference, and every assertion using it names the gap in its message. What still makes
// those assertions red: a 404, a 422, a 500 — anything that is not the endpoint succeeding.
const REGISTRATION_SUCCESS = [200, 201];
const REGISTRATION_SUCCESS_MESSAGE =
  'the specification states no success status for registration, only that it returns a User, so 200 and 201 are both accepted';

// The same gap in the User shape: the specification's example carries `null` for bio and image,
// but it never states what a fresh account is given, and the deployments disagree (`null` and
// `""`). A value that is neither is a serializer handing back something nobody wrote.
const EMPTY = [null, ''];
const EMPTY_MESSAGE =
  'the specification shows null in its User example but never states which empty value a fresh account carries, so null and "" are both accepted';

// Turns red if the factory starts reusing values, which would make parallel workers collide on
// the same account, or if the qa_ prefix is dropped and the accounts stop being recognisable.
test('the user factory produces unique, recognisable accounts', async ({ factories }) => {
  const first = factories.user.build();
  const second = factories.user.build();

  expect(first.email).not.toBe(second.email);
  expect(first.username).not.toBe(second.username);
  expect(first.username.startsWith('qa_'), 'accounts must be recognisable as ours').toBe(true);
  expect(first.email.startsWith('qa_'), 'accounts must be recognisable as ours').toBe(true);
});

// Turns red if overrides stop being applied, which would silently ignore the one field a test
// cares about while still producing a plausible-looking user.
test('the user factory applies overrides', async ({ factories }) => {
  const user = factories.user.build({ username: 'qa_fixed_name' });

  expect(user.username).toBe('qa_fixed_name');
  expect(user.email).toBeTruthy();
  expect(user.password).toBeTruthy();
});

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

// Turns red if registration stops succeeding at all — a 404, a 422, a 500 — or if the serializer
// changes what it hands back: a dropped or renamed field, an internal identifier leaking into the
// envelope, a registration that issues no token. The schema is strict, so an added field is red too.
test('C-009 — registration returns a new User', async ({ api, factories }) => {
  const response = await api.post('/users', { user: factories.user.build() });

  expect(REGISTRATION_SUCCESS, REGISTRATION_SUCCESS_MESSAGE).toContain(response.status);
  expect(response.body).toMatchSchema(UserResponseSchema);

  // The same trap as the status, one line further down. The specification shows `null` for both
  // fields in its User example but never states what a fresh account carries, and the two
  // deployments disagree: `null` on api.realworld.show, `""` on realworld.habsida.net. The strict
  // schema already pins the type to string-or-null, so what is left to assert is "still empty".
  const { user } = response.body as { user: { bio: unknown; image: unknown; token: string } };
  expect(EMPTY, `a fresh account has no bio — ${EMPTY_MESSAGE}`).toContain(user.bio);
  expect(EMPTY, `a fresh account has no image — ${EMPTY_MESSAGE}`).toContain(user.image);
  expect(user.token.length, 'registration must issue a token').toBeGreaterThan(0);
});

// Turns red if one of the three presence validators is dropped — the field goes missing and the
// account is created anyway — or if a validation failure stops being a 422 whose only key is
// `errors`, or if the complete registration at the end stops succeeding. That closing request
// proves the payload shape and the address are right, so a 422 above cannot be the request being
// malformed in some other way.
test('C-010 — registration refuses a request that omits a required field', async ({
  api,
  factories,
}) => {
  const omissions = ['email', 'username', 'password'] as const;
  const observed: string[] = [];

  for (const omitted of omissions) {
    const user: Record<string, string> = { ...factories.user.build() };
    delete user[omitted];

    const response = await api.post('/users', { user });
    observed.push(`without ${omitted} -> ${response.status}`);

    expect(response.body).toMatchSchema(ErrorsSchema);
    const { errors } = response.body as { errors: Record<string, string[]> };
    expect(
      Object.keys(errors).length,
      `the 422 for a missing ${omitted} must name at least one field`
    ).toBeGreaterThan(0);
  }

  expect(observed, 'each omission must be rejected with 422').toEqual(
    omissions.map((omitted) => `without ${omitted} -> 422`)
  );

  const complete = await api.post('/users', { user: factories.user.build() });
  expect(
    REGISTRATION_SUCCESS,
    `the same request with every field must be accepted — ${REGISTRATION_SUCCESS_MESSAGE}`
  ).toContain(complete.status);
});

// Turns red if either uniqueness constraint stops being enforced, or stops being translated into
// a 422 that carries a message — an account created on a taken email, a database violation
// surfacing as a 500, an `errors` object that says nothing. The fresh registration at the end
// proves the endpoint accepts what it should, so a red above is about the duplicate and not about
// the request.
test('C-011 — registration refuses an email or a username already in use', async ({
  api,
  factories,
  registeredUser,
}) => {
  const takenEmail = await api.post('/users', {
    user: { ...factories.user.build(), email: registeredUser.user.email },
  });
  const takenUsername = await api.post('/users', {
    user: { ...factories.user.build(), username: registeredUser.user.username },
  });

  expect(
    [takenEmail.status, takenUsername.status],
    'an email or a username already in use must be refused'
  ).toEqual([422, 422]);

  // The specification does not state which key carries a validation message — its own example
  // keys one under `body`, and deployments key them under the offending column instead. So the
  // key is a gap in the contract: what the contract does state is the envelope shape and that a
  // message is there.
  const refusals = [
    ['email', takenEmail],
    ['username', takenUsername],
  ] as const;

  for (const [collided, refusal] of refusals) {
    expect(refusal.body).toMatchSchema(ErrorsSchema);

    const { errors } = refusal.body as { errors: Record<string, string[]> };
    const messages = Object.values(errors).flat();
    expect(
      messages.length,
      `the refusal of a taken ${collided} must carry at least one message; the specification does not state which key carries it — its own example uses "body" — so any key is accepted`
    ).toBeGreaterThan(0);
  }

  const fresh = await api.post('/users', { user: factories.user.build() });
  expect(
    REGISTRATION_SUCCESS,
    `a pair nobody holds must still be accepted — ${REGISTRATION_SUCCESS_MESSAGE}`
  ).toContain(fresh.status);
});

// Turns red if any link in the credential chain breaks: a registration that does not succeed, a
// token that is not returned, a header nobody reads, a token nobody verifies, or a lookup that
// resolves it to a different account — the last of which would show up here as somebody else's
// email in the response.
test('C-012 — the token from a registration identifies its account', async ({ api, factories }) => {
  const registered = factories.user.build();
  const registration = await api.post('/users', { user: registered });

  expect(REGISTRATION_SUCCESS, REGISTRATION_SUCCESS_MESSAGE).toContain(registration.status);
  const { user } = registration.body as { user: { token: string } };

  const response = await api.withToken(user.token).get('/user');

  expect(response.status, 'the issued token must identify its own account').toBe(200);
  expect(response.body).toMatchSchema(UserResponseSchema);

  const current = response.body as { user: { email: string; username: string } };
  expect(current.user.email, 'the token must resolve to the account it was issued for').toBe(
    registered.email
  );
  expect(current.user.username, 'the token must resolve to the account it was issued for').toBe(
    registered.username
  );
});
