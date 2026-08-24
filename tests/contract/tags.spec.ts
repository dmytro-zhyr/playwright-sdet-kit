import { test, expect } from '@/fixtures';
import { TagsResponseSchema } from '@/schemas/conduit.schema';

// The specification states no success status for creating an article — anywhere, and for any
// endpoint. It says only that the call "will return an Article". All three live deployments answer
// 201 today, and that is agreement rather than a contract: a deployment that answered 200 would be
// conforming, and the assertion would be the thing that was wrong. So this set is a gap in the
// contract rather than a preference, and the assertion using it names the gap in its message. What
// still makes it red: a 401, a 404, a 422, a 500 — anything that is not the creation succeeding,
// which is what this case's precondition needs.
const ARTICLE_CREATED = [200, 201];
const ARTICLE_CREATED_MESSAGE =
  'the specification states no success status for creating an article, only that it returns an Article, so 200 and 201 are both accepted';

// Turns red if the precondition stops holding — the tagged article is not created — if the tag
// endpoint stops answering an anonymous caller, if it starts serializing tag records instead of
// tag names — an array of objects rather than of strings — or if a second key appears beside
// `tags`. The strict schema is what makes those red rather than merely different.
test('C-025 — the tags document is an array of strings under one key', async ({
  api,
  factories,
  registeredUser,
}) => {
  // The precondition: at least one article carrying at least one tag exists, so the assertion
  // about the entries is not vacuous against an empty array.
  const created = await registeredUser.api.post('/articles', {
    article: factories.article.build(),
  });
  expect(
    ARTICLE_CREATED,
    `the case needs one tagged article to exist — ${ARTICLE_CREATED_MESSAGE}`
  ).toContain(created.status);

  const response = await api.get('/tags');

  expect(response.status, 'the tag list must be readable with no Authorization header').toBe(200);
  expect(response.body).toMatchSchema(TagsResponseSchema);

  const { tags } = response.body as { tags: string[] };
  expect(tags.length, 'a tagged article exists, so the list must not be empty').toBeGreaterThan(0);
});
