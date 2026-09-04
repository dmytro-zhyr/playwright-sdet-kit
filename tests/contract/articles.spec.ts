import { test, expect } from '@fixtures';
import { parseBody } from '@assertions/parseBody';
import { ArticleResponseSchema, ErrorsSchema } from '@schemas/conduit.schema';

// The specification states no success status for creating an article — anywhere, and for any
// endpoint. It says only that the call "will return an Article". All three live deployments
// answer 201 today, and that is agreement rather than a contract: a deployment that answered 200
// would be conforming, and the assertion would be the thing that was wrong. So this set is a gap
// in the contract rather than a preference, and every assertion using it names the gap in its
// message. What still makes those assertions red: a 401, a 404, a 422, a 500 — anything that is
// not the creation succeeding.
const ARTICLE_CREATED = [200, 201];
const ARTICLE_CREATED_MESSAGE =
  'the specification states no success status for creating an article, only that it returns an Article, so 200 and 201 are both accepted';

// The specification states no success status for a delete either, so this set accepts either of
// the two a deployment might reasonably answer. What it still refuses is a delete that does not
// succeed at all.
const DELETE_SUCCESS = [200, 204];
const DELETE_SUCCESS_MESSAGE =
  'the specification states no success status for a delete, so 200 and 204 are both accepted';

// Turns red if the create handler stops reading an `article`-wrapped body, stops answering with a
// single-article envelope, or attributes the article to somebody other than the caller — an
// author taken from the payload, from the first account in the store, or left empty. The strict
// schema is what makes a dropped or added field red rather than merely different.
test('C-060 — creating an article returns it authored by the caller', async ({
  factories,
  registeredUser,
}) => {
  const { title, description, body } = factories.article.build();

  const created = await registeredUser.api.post('/articles', {
    article: { title, description, body },
  });

  expect(ARTICLE_CREATED, ARTICLE_CREATED_MESSAGE).toContain(created.status);
  const { article } = parseBody(created.body, ArticleResponseSchema);
  expect(article.author.username, 'the author is the caller, not whoever the payload named').toBe(
    registeredUser.user.username
  );
});

// Turns red if a creation stops succeeding at all, if the slug it hands back stops being an
// address that works — a write that was never committed under the identifier the response
// advertised — or if the article stored under it is not the article that was sent. The strict
// schema keeps the read honest: ten fields means ten, and `body` is one of them.
test('C-061 — a created article is fetched by its slug and keeps what it was given', async ({
  api,
  factories,
  registeredUser,
}) => {
  const sent = factories.article.build();

  const created = await registeredUser.api.post('/articles', { article: sent });
  expect(ARTICLE_CREATED, ARTICLE_CREATED_MESSAGE).toContain(created.status);
  const { article } = created.body as { article: { slug: string } };

  const response = await api.get(`/articles/${article.slug}`);

  expect(response.status, 'the slug a creation returned must address the article').toBe(200);
  const fetched = parseBody(response.body, ArticleResponseSchema);
  expect(
    [fetched.article.title, fetched.article.description, fetched.article.body],
    'the article read back must carry the values the creation sent'
  ).toEqual([sent.title, sent.description, sent.body]);
});

// Turns red if one of the article model's three presence validators is dropped and an article is
// created with a field missing, or if a validation failure at this endpoint stops being a 422
// whose only key is `errors`. The two reads that close the test are what the status alone cannot
// show: the author's listing is still empty after the three refusals, so nothing was created, and
// the complete creation is accepted, so a 422 above was about the omission and not the request.
test('C-062 — creating an article refuses a body missing a required field', async ({
  factories,
  registeredUser,
}) => {
  const omissions = ['title', 'description', 'body'] as const;
  const observed: string[] = [];

  for (const omitted of omissions) {
    const article: Record<string, unknown> = { ...factories.article.build() };
    delete article[omitted];

    const response = await registeredUser.api.post('/articles', { article });
    observed.push(`without ${omitted} -> ${response.status}`);

    const { errors } = parseBody(response.body, ErrorsSchema);
    expect(
      Object.keys(errors).length,
      `the 422 for a missing ${omitted} must name at least one field`
    ).toBeGreaterThan(0);
  }

  expect(observed, 'each omission must be rejected with 422').toEqual(
    omissions.map((omitted) => `without ${omitted} -> 422`)
  );

  const username = registeredUser.user.username;

  const nothingCreated = await registeredUser.api.get(`/articles?author=${username}`);
  const refusedInto = nothingCreated.body as { articles: unknown[] };
  expect(refusedInto.articles, 'a refused creation must not have created an article').toHaveLength(
    0
  );

  const complete = await registeredUser.api.post('/articles', {
    article: factories.article.build(),
  });
  expect(
    ARTICLE_CREATED,
    `the same request with every field must be accepted — ${ARTICLE_CREATED_MESSAGE}`
  ).toContain(complete.status);
});

// Turns red if the delete stops succeeding, or if it answers success while removing nothing —
// which shows up as the slug still resolving afterwards — or if the by-slug lookup stops mapping
// a removed article to 404. The read before the delete is what makes the 404 after it mean
// something: the same request, the same slug, one deletion apart.
test('C-072 — deleting an article answers success and its slug stops resolving', async ({
  api,
  factories,
  registeredUser,
}) => {
  const created = await registeredUser.api.post('/articles', {
    article: factories.article.build(),
  });
  expect(ARTICLE_CREATED, ARTICLE_CREATED_MESSAGE).toContain(created.status);
  const { article } = created.body as { article: { slug: string } };

  const before = await api.get(`/articles/${article.slug}`);
  expect(before.status, 'the slug must address the article before it is deleted').toBe(200);

  const removed = await registeredUser.api.del(`/articles/${article.slug}`);
  expect(DELETE_SUCCESS, `the author's delete must succeed — ${DELETE_SUCCESS_MESSAGE}`).toContain(
    removed.status
  );

  const after = await api.get(`/articles/${article.slug}`);
  expect(after.status, 'a deleted article must stop resolving under its slug').toBe(404);
});
