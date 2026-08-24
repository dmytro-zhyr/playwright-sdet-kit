import { test, expect } from '@/fixtures';
import {
  ArticleResponseSchema,
  ArticlesResponseSchema,
  CommentsResponseSchema,
  ErrorsSchema,
  ProfileResponseSchema,
  TagsResponseSchema,
  UserResponseSchema,
} from '@/schemas/conduit.schema';

// Turns red if GET /tags changes shape — tags disappears, stops being an array of strings, or a
// new field appears alongside it.
test('GET /tags matches the schema', async ({ api }) => {
  const response = await api.get('/tags');

  expect(response.status).toBe(200);
  expect(response.body).toMatchSchema(TagsResponseSchema);
});

// Turns red if registration stops returning a user envelope, or starts returning a field the
// contract does not describe.
test('POST /users matches the user response schema', async ({ api, factories }) => {
  const response = await api.post('/users', { user: factories.user.build() });

  expect(response.status, 'registration returns 201 on this target').toBe(201);
  expect(response.body).toMatchSchema(UserResponseSchema);
});

// Turns red if the authenticated user endpoint drifts from the registration response shape.
test('GET /user matches the user response schema', async ({ registeredUser }) => {
  const response = await registeredUser.api.get('/user');

  expect(response.status).toBe(200);
  expect(response.body).toMatchSchema(UserResponseSchema);
});

// Turns red if the article list starts carrying `body` again, or drops articlesCount. The list
// shape is deliberately different from the single-article shape.
test('GET /articles matches the list schema, without article bodies', async ({ api }) => {
  const response = await api.get('/articles?limit=5');

  expect(response.status).toBe(200);
  expect(response.body).toMatchSchema(ArticlesResponseSchema);
});

// Turns red if a single article stops carrying `body` — the one field that separates the two
// article shapes.
test('GET /articles/:slug matches the single-article schema, with a body', async ({ api }) => {
  const list = await api.get('/articles?limit=1');
  const { articles } = list.body as { articles: { slug: string }[] };
  test.skip(articles.length === 0, 'the target has no articles to read');

  const response = await api.get(`/articles/${articles[0].slug}`);

  expect(response.status).toBe(200);
  expect(response.body).toMatchSchema(ArticleResponseSchema);
});

// Turns red if the profile shape drifts from the author shape embedded in articles — they are
// the same schema, and this is what keeps that true.
test('GET /profiles/:username matches the profile schema', async ({ registeredUser }) => {
  const response = await registeredUser.api.get(`/profiles/${registeredUser.user.username}`);

  expect(response.status).toBe(200);
  expect(response.body).toMatchSchema(ProfileResponseSchema);
});

// Turns red if the comments list changes shape.
test('GET /articles/:slug/comments matches the comments schema', async ({ api }) => {
  const list = await api.get('/articles?limit=1');
  const { articles } = list.body as { articles: { slug: string }[] };
  test.skip(articles.length === 0, 'the target has no articles to read');

  const response = await api.get(`/articles/${articles[0].slug}/comments`);

  expect(response.status).toBe(200);
  expect(response.body).toMatchSchema(CommentsResponseSchema);
});

// Turns red if validation errors stop being an object of field -> messages, which is the shape
// every negative test in this suite relies on.
test('a validation failure matches the errors schema', async ({ api }) => {
  const response = await api.post('/users', { user: { username: '', email: '', password: '' } });

  expect(response.status).toBe(422);
  expect(response.body).toMatchSchema(ErrorsSchema);
});
