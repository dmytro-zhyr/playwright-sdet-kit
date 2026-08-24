import { test, expect } from '@/fixtures';
import { ErrorsSchema, UserResponseSchema } from '@/schemas/conduit.schema';

// The specification states no success status for login — anywhere, and for any endpoint. It says
// only that the call "returns a User", the same words it uses for registration, where conforming
// deployments already disagree: 201 on api.realworld.show, 200 on realworld.habsida.net. All
// three live deployments answer 200 to a login today, and that is agreement rather than a
// contract. So this set is a gap in the contract rather than a preference, and every assertion
// using it names the gap in its message. What still makes those assertions red: a 401, a 404, a
// 422, a 500 — anything that is not the login succeeding.
const LOGIN_SUCCESS = [200, 201];
const LOGIN_SUCCESS_MESSAGE =
  'the specification states no success status for login, only that it returns a User, so 200 and 201 are both accepted';

// The same gap for the registration the second account is created with.
const REGISTRATION_SUCCESS = [200, 201];
const REGISTRATION_SUCCESS_MESSAGE =
  'the specification states no success status for registration, only that it returns a User, so 200 and 201 are both accepted';

// Turns red if login stops reading a `user`-wrapped body, stops succeeding at all — a 401, a 404,
// a 422, a 500 — or answers with an account the email does not belong to. The second account is
// what makes the last of those visible: a lookup keyed on something other than the email would
// hand back a stranger here while still looking like a successful login.
test('C-026 — login with an account’s credentials answers with that account', async ({
  api,
  factories,
  registeredUser,
}) => {
  const other = factories.user.build();
  const registration = await api.post('/users', { user: other });
  expect(
    REGISTRATION_SUCCESS,
    `the case needs a second account — ${REGISTRATION_SUCCESS_MESSAGE}`
  ).toContain(registration.status);

  const response = await api.post('/users/login', {
    user: { email: registeredUser.user.email, password: registeredUser.user.password },
  });

  expect(
    LOGIN_SUCCESS,
    `a login with matching credentials must be carried out — ${LOGIN_SUCCESS_MESSAGE}`
  ).toContain(response.status);
  expect(response.body).toMatchSchema(UserResponseSchema);

  const { user } = response.body as { user: { email: string; username: string } };
  expect(user.email, 'login must answer with the account the email belongs to').toBe(
    registeredUser.user.email
  );
  expect(user.email, 'login must not answer with some other account').not.toBe(other.email);
  expect(user.username, 'login must not answer with some other account').not.toBe(other.username);
});

// Turns red if login stops insisting on one of its two required fields — this endpoint's list is
// not registration's, and a validator attached to the wrong action would let a half-empty login
// through — or if a refusal starts carrying a user document beside the errors. The complete login
// at the end proves the address and the payload shape are right, so a 422 above it is about the
// omission.
test('C-027 — login refuses a body with no email or no password', async ({
  api,
  registeredUser,
}) => {
  const credentials = { email: registeredUser.user.email, password: registeredUser.user.password };
  const omissions = ['password', 'email'] as const;
  const observed: string[] = [];

  for (const omitted of omissions) {
    const user: Record<string, string> = { ...credentials };
    delete user[omitted];

    const response = await api.post('/users/login', { user });
    observed.push(`without ${omitted} -> ${response.status}`);

    // The strict envelope already says it: a body that matches ErrorsSchema has `errors` as its
    // only top-level key, so no user document can be sitting beside it.
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
