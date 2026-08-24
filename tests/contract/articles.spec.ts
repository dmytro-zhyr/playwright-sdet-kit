import { test, expect } from '@/fixtures';
import { ArticleResponseSchema, ErrorsSchema } from '@/schemas/conduit.schema';

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

// Turns red if a creation stops succeeding at all — a 401, a 404, a 422, a 500 — if the slug it
// hands back stops being an address that works, or if the single-article serializer drifts — a
// dropped `body`, an added field, a title that is not the one stored. The schema is strict, so
// ten fields means ten.
test('C-032 — an article is fetched whole by the slug its creation returned', async ({
  factories,
  registeredUser,
}) => {
  const sent = factories.article.build();
  const created = await registeredUser.api.post('/articles', { article: sent });

  expect(ARTICLE_CREATED, ARTICLE_CREATED_MESSAGE).toContain(created.status);
  const { article } = created.body as { article: { slug: string } };

  const response = await registeredUser.api.get(`/articles/${article.slug}`);

  expect(response.status, 'the slug a creation returned must address the article').toBe(200);
  expect(response.body).toMatchSchema(ArticleResponseSchema);

  const fetched = response.body as { article: { body: string; title: string } };
  expect(typeof fetched.article.body, 'a single article carries its body as a string').toBe(
    'string'
  );
  expect(fetched.article.title, 'the article fetched must be the article created').toBe(sent.title);
});

// Turns red if either creation stops succeeding — a 401, a 422, a 500 — or if the create action
// stops storing what it was sent: the tags come back empty or reordered away, the author is taken
// from the payload instead of from the token, or an article nobody has seen starts life already
// favorited or with a count above zero. The second creation, without a tagList, turns red if the
// field stops being optional.
test('C-034 — creating an article returns the article the caller sent', async ({
  factories,
  registeredUser,
}) => {
  const tagged = { ...factories.article.build(), tagList: ['qa', `qa-${Date.now()}`] };
  const withTags = await registeredUser.api.post('/articles', { article: tagged });

  const { title, description, body } = factories.article.build();
  const withoutTags = await registeredUser.api.post('/articles', {
    article: { title, description, body },
  });

  const creations = [
    ['with a tagList', withTags],
    ['without one', withoutTags],
  ] as const;

  for (const [sent, creation] of creations) {
    expect(
      ARTICLE_CREATED,
      `creating an article ${sent} must be accepted — ${ARTICLE_CREATED_MESSAGE}`
    ).toContain(creation.status);
  }

  expect(withTags.body).toMatchSchema(ArticleResponseSchema);
  expect(withoutTags.body).toMatchSchema(ArticleResponseSchema);

  const first = withTags.body as { article: { tagList: string[] } };
  for (const tag of tagged.tagList) {
    expect(first.article.tagList, 'every tag sent must come back').toContain(tag);
  }

  for (const created of [withTags, withoutTags]) {
    const { article } = created.body as {
      article: { author: { username: string }; favorited: boolean; favoritesCount: number };
    };
    expect(article.author.username, 'the author is the caller, not whoever the payload named').toBe(
      registeredUser.user.username
    );
    expect(article.favorited, 'an article nobody has seen is not favorited').toBe(false);
    expect(article.favoritesCount, 'an article nobody has seen has no favorites').toBe(0);
  }
});

// Turns red if one of the article model's three presence validators is dropped and an article is
// created with a blank field, if a validation failure at this endpoint stops being a 422 whose
// only key is `errors`, or if the complete creation at the end stops succeeding. That closing
// request proves the token and the payload shape are right, so a 422 above is about the missing
// field.
test('C-035 — creating an article refuses a request that omits a required field', async ({
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

  const complete = await registeredUser.api.post('/articles', {
    article: factories.article.build(),
  });
  expect(
    ARTICLE_CREATED,
    `the same request with every field must be accepted — ${ARTICLE_CREATED_MESSAGE}`
  ).toContain(complete.status);
});
