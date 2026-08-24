import { test, expect } from '@/fixtures';

const UNKNOWN_USERNAME = 'qa_nobody_000';
const UNKNOWN_SLUG = 'there-is-no-such-slug-000';
const UNKNOWN_COMMENT_ID = 999999999;

// Turns red if a lookup stops refusing to invent a row — answering 200 with something, or 500
// because the finder was never asked what to do with nothing — or if "not found" stops being
// mapped to 404 at one of these eight paths. The two reads at the end use an article and a
// profile that do exist, so a red above cannot mean the path shape itself is wrong.
test('C-006 — an identifier that names nothing is answered 404', async ({
  api,
  factories,
  registeredUser,
}) => {
  const created = await registeredUser.api.post('/articles', {
    article: factories.article.build(),
  });
  const { article } = created.body as { article: { slug: string } };
  expect(article?.slug, 'the case needs one article that exists').toBeTruthy();

  const lookups = [
    { name: 'GET /profiles/:unknown', response: await api.get(`/profiles/${UNKNOWN_USERNAME}`) },
    {
      name: 'POST /profiles/:unknown/follow',
      response: await registeredUser.api.post(`/profiles/${UNKNOWN_USERNAME}/follow`, {}),
    },
    { name: 'GET /articles/:unknown', response: await api.get(`/articles/${UNKNOWN_SLUG}`) },
    {
      name: 'PUT /articles/:unknown',
      response: await registeredUser.api.put(`/articles/${UNKNOWN_SLUG}`, {
        article: { title: factories.article.build().title },
      }),
    },
    {
      name: 'DELETE /articles/:unknown',
      response: await registeredUser.api.del(`/articles/${UNKNOWN_SLUG}`),
    },
    {
      name: 'GET /articles/:unknown/comments',
      response: await api.get(`/articles/${UNKNOWN_SLUG}/comments`),
    },
    {
      name: 'DELETE /articles/:slug/comments/:unknown',
      response: await registeredUser.api.del(
        `/articles/${article.slug}/comments/${UNKNOWN_COMMENT_ID}`
      ),
    },
    {
      name: 'POST /articles/:unknown/favorite',
      response: await registeredUser.api.post(`/articles/${UNKNOWN_SLUG}/favorite`, {}),
    },
  ];

  expect(
    lookups.map(({ name, response }) => `${name} -> ${response.status}`),
    'an identifier that names nothing must be answered 404'
  ).toEqual(lookups.map(({ name }) => `${name} -> 404`));

  // The positive half: the same two path shapes, filled with identifiers that do exist.
  const knownArticle = await registeredUser.api.get(`/articles/${article.slug}`);
  expect(knownArticle.status, 'the article path resolves when the slug names an article').toBe(200);

  const knownProfile = await registeredUser.api.get(`/profiles/${registeredUser.user.username}`);
  expect(knownProfile.status, 'the profile path resolves when the username names an account').toBe(
    200
  );
});
