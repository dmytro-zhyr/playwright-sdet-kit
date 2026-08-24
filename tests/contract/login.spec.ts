import { test, expect } from '@/fixtures';
import { ErrorsSchema, UserResponseSchema } from '@/schemas/conduit.schema';

// The specification states no success status for login — anywhere, and for any endpoint. It says
// only that the call "returns a User", the same words it uses for registration, where conforming
// deployments already disagree: 201 on api.realworld.show, 200 on realworld.habsida.net. All three
// live deployments answer 200 to a login today, and that is agreement rather than a contract. So
// this set is a gap in the contract rather than a preference, and every assertion using it names
// the gap in its message. What still makes those assertions red: a 401, a 404, a 422, a 500 —
// anything that is not the login succeeding.
const LOGIN_SUCCESS = [200, 201];
const LOGIN_SUCCESS_MESSAGE =
  'the specification states no success status for login, only that it returns a User, so 200 and 201 are both accepted';

// Turns red if login stops succeeding at all — a 401, a 404, a 422, a 500 — if it stops answering
// with a User envelope, or if the account inside it is not the one the email belongs to — a lookup
// keyed on something other than the email would hand back a stranger here while still looking like
// a successful login.
test('C-013 — login returns the account that owns the email', async ({ api, registeredUser }) => {
  const response = await api.post('/users/login', {
    user: { email: registeredUser.user.email, password: registeredUser.user.password },
  });

  expect(
    LOGIN_SUCCESS,
    `a login with matching credentials must be served — ${LOGIN_SUCCESS_MESSAGE}`
  ).toContain(response.status);
  expect(response.body).toMatchSchema(UserResponseSchema);

  const { user } = response.body as { user: { email: string; token: string } };
  expect(user.email, 'login must return the account the email belongs to').toBe(
    registeredUser.user.email
  );
  expect(user.token.length, 'a successful login must issue a token').toBeGreaterThan(0);
});

// Turns red if login stops insisting on one of its two required fields — this endpoint's list is
// not registration's, and a validator attached to the wrong action would let a half-empty login
// through, or if the complete login at the end stops succeeding. That closing request proves the
// address and the payload shape are right.
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
  expect(
    LOGIN_SUCCESS,
    `the same request with both fields must be accepted — ${LOGIN_SUCCESS_MESSAGE}`
  ).toContain(complete.status);
});
