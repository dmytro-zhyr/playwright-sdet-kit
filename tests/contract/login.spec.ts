import { test, expect } from '@/fixtures';
import { ErrorsSchema, UserResponseSchema } from '@/schemas/conduit.schema';

// Turns red if login stops answering with a User envelope, or if the account inside it is not the
// one the email belongs to — a lookup keyed on something other than the email would hand back a
// stranger here while still looking like a successful login.
test('C-013 — login returns the account that owns the email', async ({ api, registeredUser }) => {
  const response = await api.post('/users/login', {
    user: { email: registeredUser.user.email, password: registeredUser.user.password },
  });

  expect(response.status, 'a login with matching credentials must be served').toBe(200);
  expect(response.body).toMatchSchema(UserResponseSchema);

  const { user } = response.body as { user: { email: string; token: string } };
  expect(user.email, 'login must return the account the email belongs to').toBe(
    registeredUser.user.email
  );
  expect(user.token.length, 'a successful login must issue a token').toBeGreaterThan(0);
});

// Turns red if login stops insisting on one of its two required fields — this endpoint's list is
// not registration's, and a validator attached to the wrong action would let a half-empty login
// through. The complete login at the end proves the address and the payload shape are right.
test('C-014 — login refuses a request that omits a required field', async ({
  api,
  registeredUser,
}) => {
  const credentials = { email: registeredUser.user.email, password: registeredUser.user.password };
  const omissions = ['email', 'password'] as const;
  const observed: string[] = [];

  for (const omitted of omissions) {
    const user: Record<string, string> = { ...credentials };
    delete user[omitted];

    const response = await api.post('/users/login', { user });
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

  const complete = await api.post('/users/login', { user: credentials });
  expect(complete.status, 'the same request with both fields must be accepted').toBe(200);
});
