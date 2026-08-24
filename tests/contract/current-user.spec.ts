import { test, expect } from '@/fixtures';
import { UserResponseSchema } from '@/schemas/conduit.schema';

// Turns red if the update stops assigning what it was given — the bio comes back unchanged or is
// gone by the next read — or if it assigns over the whole record, which would blank the username
// and email the request never mentioned.
test('C-016 — updating the current user stores what it was given and keeps the rest', async ({
  registeredUser,
}) => {
  const bio = `qa bio ${Date.now()}`;

  const update = await registeredUser.api.put('/user', { user: { bio } });

  expect(update.status, 'an update by an authenticated caller must be served').toBe(200);
  expect(update.body).toMatchSchema(UserResponseSchema);

  const updated = update.body as { user: { bio: string; username: string; email: string } };
  expect(updated.user.bio, 'the update must echo the value it was given').toBe(bio);
  expect(updated.user.username, 'a field the request never mentioned must be left alone').toBe(
    registeredUser.user.username
  );
  expect(updated.user.email, 'a field the request never mentioned must be left alone').toBe(
    registeredUser.user.email
  );

  const readBack = await registeredUser.api.get('/user');

  expect(readBack.status, 'the account must still be readable after the update').toBe(200);
  const stored = readBack.body as { user: { bio: string; username: string; email: string } };
  expect(stored.user.bio, 'the value must survive to the next request').toBe(bio);
  expect(stored.user.username, 'the untouched fields must survive too').toBe(
    registeredUser.user.username
  );
  expect(stored.user.email, 'the untouched fields must survive too').toBe(
    registeredUser.user.email
  );
});
