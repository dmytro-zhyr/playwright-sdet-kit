import { test, expect } from '@/fixtures';
import { ArticleResponseSchema, ErrorsSchema } from '@/schemas/conduit.schema';

// Turns red if the slug a creation hands back stops being an address that works, or if the
// single-article serializer drifts — a dropped `body`, an added field, a title that is not the
// one stored. The schema is strict, so ten fields means ten.
test('C-032 — an article is fetched whole by the slug its creation returned', async ({
  factories,
  registeredUser,
}) => {
  const sent = factories.article.build();
  const created = await registeredUser.api.post('/articles', { article: sent });

  expect(created.status, 'creating an article returns 201 on this target').toBe(201);
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

// Turns red if the create action stops storing what it was sent — the tags come back empty or
// reordered away, the author is taken from the payload instead of from the token, or an article
// nobody has seen starts life already favorited or with a count above zero. The second creation,
// without a tagList, turns red if the field stops being optional.
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

  expect(
    [withTags.status, withoutTags.status],
    'creating an article returns 201 on this target, with or without a tagList'
  ).toEqual([201, 201]);

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
// created with a blank field, or if a validation failure at this endpoint stops being a 422 whose
// only key is `errors`. The complete creation at the end proves the token and the payload shape
// are right, so a 422 above is about the missing field.
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
  expect(complete.status, 'the same request with every field must be accepted').toBe(201);
});
