import { test, expect } from '@/fixtures';

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
