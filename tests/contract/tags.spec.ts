import { test, expect } from '@/fixtures';
import { TagsResponseSchema } from '@/schemas/conduit.schema';

// Turns red if the tag endpoint starts serializing tag records instead of tag names — an array of
// objects rather than of strings — or adds a second key beside `tags`. The strict schema is what
// makes both of those red rather than merely different.
test('C-044 — the tag endpoint returns an array of strings', async ({
  factories,
  registeredUser,
}) => {
  // The precondition: at least one article carrying at least one tag exists, so the assertion
  // about the entries is not vacuous against an empty array.
  const created = await registeredUser.api.post('/articles', {
    article: factories.article.build(),
  });
  expect(created.status, 'the case needs one tagged article to exist').toBe(201);

  const response = await registeredUser.api.get('/tags');

  expect(response.status, 'the tag list must be readable').toBe(200);
  expect(response.body).toMatchSchema(TagsResponseSchema);

  const { tags } = response.body as { tags: string[] };
  expect(tags.length, 'a tagged article exists, so the list must not be empty').toBeGreaterThan(0);
});
