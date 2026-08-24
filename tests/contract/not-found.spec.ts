import { test, expect } from '@/fixtures';
import { ProfileResponseSchema } from '@/schemas/conduit.schema';

const UNHELD_USERNAME = 'qa_nobody_000';
const UNHELD_SLUG = 'there-is-no-such-slug-000';

// The specification states no success status for a delete, so the control below accepts either of
// the two a deployment might reasonably answer. What it still refuses is a delete that does not
// succeed at all, which is what would make the assertions above it meaningless.
const DELETE_SUCCESS = [200, 204];
const DELETE_SUCCESS_MESSAGE =
  'the specification states no success status for a delete, so 200 and 204 are both accepted';

// The specification states no success status for creating a comment, only that it returns a
// Comment, so this control accepts both. What still makes it red: a 401, a 404, a 422, a 500.
const COMMENT_CREATED = [200, 201];
const COMMENT_CREATED_MESSAGE =
  'the specification states no success status for creating a comment, only that it returns a Comment, so 200 and 201 are both accepted';

// Turns red if the username lookup stops refusing to invent an account — answering 200 with
// something, or 500 because the finder was never asked what to do with nothing — or if one of
// these three routes stops consulting it and operates on a null subject. The read of a profile
// that does exist, at the end, uses the same path shape and the same credential, so a 404 above
// it cannot mean the route itself is misspelled.
test('C-014 — a path naming an account nobody holds is answered 404', async ({
  api,
  registeredUser,
}) => {
  const lookups = [
    { name: 'GET /profiles/:unheld', response: await api.get(`/profiles/${UNHELD_USERNAME}`) },
    {
      name: 'POST /profiles/:unheld/follow',
      response: await registeredUser.api.post(`/profiles/${UNHELD_USERNAME}/follow`, {}),
    },
    {
      name: 'DELETE /profiles/:unheld/follow',
      response: await registeredUser.api.del(`/profiles/${UNHELD_USERNAME}/follow`),
    },
  ];

  expect(
    lookups.map(({ name, response }) => `${name} -> ${response.status}`),
    'a username no account holds must be answered 404'
  ).toEqual(lookups.map(({ name }) => `${name} -> 404`));

  // The positive half: the same path shape filled with a username that does name an account.
  const known = await registeredUser.api.get(`/profiles/${registeredUser.user.username}`);
  expect(known.status, 'the profile path resolves when the username names an account').toBe(200);
  expect(known.body).toMatchSchema(ProfileResponseSchema);
});

// Turns red if the article lookup stops refusing to invent a row, or if one of these seven routes
// skips the lookup and runs its handler on a missing article — which shows up as anything other
// than 404, including a delete that reports having removed something that was never there and a
// comment endpoint that validates the payload before it looks for the article. The five controls
// at the end use the same verbs, the same path shapes and the same credential against a slug that
// does name an article, so a red above cannot be the address, the auth or the payload.
test('C-015 — a path naming a slug no article holds is answered 404', async ({
  api,
  factories,
  registeredUser,
}) => {
  const created = await registeredUser.api.post('/articles', {
    article: factories.article.build(),
  });
  const { article } = created.body as { article: { slug: string } };
  expect(article?.slug, 'the case needs one article that exists for the controls').toBeTruthy();

  const lookups = [
    { name: 'GET /articles/:unheld', response: await api.get(`/articles/${UNHELD_SLUG}`) },
    {
      name: 'GET /articles/:unheld/comments',
      response: await api.get(`/articles/${UNHELD_SLUG}/comments`),
    },
    {
      name: 'PUT /articles/:unheld',
      response: await registeredUser.api.put(`/articles/${UNHELD_SLUG}`, {
        article: { title: factories.article.build().title },
      }),
    },
    {
      name: 'DELETE /articles/:unheld',
      response: await registeredUser.api.del(`/articles/${UNHELD_SLUG}`),
    },
    {
      name: 'POST /articles/:unheld/comments',
      response: await registeredUser.api.post(`/articles/${UNHELD_SLUG}/comments`, {
        comment: { body: factories.comment.build().body },
      }),
    },
    {
      name: 'POST /articles/:unheld/favorite',
      response: await registeredUser.api.post(`/articles/${UNHELD_SLUG}/favorite`, {}),
    },
    {
      name: 'DELETE /articles/:unheld/favorite',
      response: await registeredUser.api.del(`/articles/${UNHELD_SLUG}/favorite`),
    },
  ];

  expect(
    lookups.map(({ name, response }) => `${name} -> ${response.status}`),
    'a slug no article holds must be answered 404'
  ).toEqual(lookups.map(({ name }) => `${name} -> 404`));

  // The positive half, in the order that keeps the article alive until the delete is the last
  // thing asked of it.
  const read = await api.get(`/articles/${article.slug}`);
  expect(read.status, 'the article path resolves when the slug names an article').toBe(200);

  const comments = await api.get(`/articles/${article.slug}/comments`);
  expect(comments.status, 'the comment list resolves when the slug names an article').toBe(200);

  const commented = await registeredUser.api.post(`/articles/${article.slug}/comments`, {
    comment: { body: factories.comment.build().body },
  });
  expect(
    COMMENT_CREATED,
    `the same comment request must be accepted on a slug that exists — ${COMMENT_CREATED_MESSAGE}`
  ).toContain(commented.status);

  const favorited = await registeredUser.api.post(`/articles/${article.slug}/favorite`, {});
  expect(favorited.status, 'the favorite path resolves when the slug names an article').toBe(200);

  const unfavorited = await registeredUser.api.del(`/articles/${article.slug}/favorite`);
  expect(unfavorited.status, 'the unfavorite path resolves when the slug names an article').toBe(
    200
  );

  // A new description rather than a new title, so the control does not move the slug the delete
  // below still has to address.
  const updated = await registeredUser.api.put(`/articles/${article.slug}`, {
    article: { description: factories.article.build().description },
  });
  expect(updated.status, 'the update path resolves when the slug names an article').toBe(200);

  const removed = await registeredUser.api.del(`/articles/${article.slug}`);
  expect(
    DELETE_SUCCESS,
    `the same delete must succeed when the slug names an article — ${DELETE_SUCCESS_MESSAGE}`
  ).toContain(removed.status);
});
