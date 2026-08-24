import { test, expect } from '@/fixtures';
import { UserResponseSchema } from '@/schemas/conduit.schema';

// Turns red if the update never reaches the store — a handler that renders the merged document
// and answers with it without committing is green on everything that reads only its own response,
// and red only when a later request asks again. It also turns red if the write lands somewhere
// the read does not look, which shows up here as the read reporting the old values.
test('C-036 — an update outlives the request that made it', async ({ registeredUser }) => {
  const bio = `qa bio ${Date.now()}`;
  const image = `https://example.com/qa-${Date.now()}.png`;

  const update = await registeredUser.api.put('/user', { user: { bio, image } });

  expect(update.status, 'an update by an authenticated caller must be carried out').toBe(200);
  expect(update.body).toMatchSchema(UserResponseSchema);

  const readBack = await registeredUser.api.get('/user');

  expect(readBack.status, 'the account must still be readable after the update').toBe(200);
  expect(readBack.body).toMatchSchema(UserResponseSchema);

  const stored = readBack.body as { user: { bio: string | null; image: string | null } };
  expect(
    [stored.user.bio, stored.user.image],
    'a later read must report the bio and the image the update sent'
  ).toEqual([bio, image]);
});
