import { test, expect } from '@/fixtures';
import { ErrorsSchema, UserResponseSchema } from '@/schemas/conduit.schema';

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

// Turns red if the registration serializer changes what it hands back — a dropped or renamed
// field, an internal identifier leaking into the envelope, or a fresh account whose bio and image
// arrive as empty strings instead of null. The schema is strict, so an added field is red too.
test('C-009 — registration returns a new User', async ({ api, factories }) => {
  const response = await api.post('/users', { user: factories.user.build() });

  expect(response.status, 'registration returns 201 on this target').toBe(201);
  expect(response.body).toMatchSchema(UserResponseSchema);

  const { user } = response.body as { user: { bio: unknown; image: unknown; token: string } };
  expect(user.bio, 'a fresh account has no bio').toBeNull();
  expect(user.image, 'a fresh account has no image').toBeNull();
  expect(user.token.length, 'registration must issue a token').toBeGreaterThan(0);
});

// Turns red if one of the three presence validators is dropped — the field goes missing and the
// account is created anyway — or if a validation failure stops being a 422 whose only key is
// `errors`. The complete registration at the end proves the payload shape and the address are
// right, so a 422 above cannot be the request being malformed in some other way.
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
  expect(complete.status, 'the same request with every field must be accepted').toBe(201);
});

// Turns red if either uniqueness constraint stops being enforced, or stops being translated into
// a 422 naming the column that collided — an account created on a taken email, or a database
// violation surfacing as a 500. The fresh registration at the end proves the endpoint accepts
// what it should, so a red above is about the duplicate and not about the request.
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

  const emailErrors = takenEmail.body as { errors?: Record<string, string[]> };
  expect(emailErrors.errors?.email, 'the refusal must name the email column').toBeTruthy();

  const usernameErrors = takenUsername.body as { errors?: Record<string, string[]> };
  expect(usernameErrors.errors?.username, 'the refusal must name the username column').toBeTruthy();

  const fresh = await api.post('/users', { user: factories.user.build() });
  expect(fresh.status, 'a pair nobody holds must still be accepted').toBe(201);
});

// Turns red if any link in the credential chain breaks: a token that is not returned, a header
// nobody reads, a token nobody verifies, or a lookup that resolves it to a different account —
// the last of which would show up here as somebody else's email in the response.
test('C-012 — the token from a registration identifies its account', async ({ api, factories }) => {
  const registered = factories.user.build();
  const registration = await api.post('/users', { user: registered });

  expect(registration.status, 'registration returns 201 on this target').toBe(201);
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
