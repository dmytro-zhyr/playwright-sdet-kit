import { test, expect } from '@/fixtures';

// Turns red if the target stops serving tags or changes the shape of the response.
test('GET /tags returns 200 and a list of tags', async ({ api }) => {
  const response = await api.get('/tags');

  expect(response.status).toBe(200);

  const body = response.body as { tags?: unknown };
  expect(Array.isArray(body.tags), 'tags must be an array').toBe(true);
});

// Turns red if the client starts throwing on non-2xx instead of returning the status.
test('the client returns the status on 404 instead of throwing', async ({ api }) => {
  const response = await api.get('/articles/there-is-no-such-slug-000');

  expect(response.status).toBe(404);
  expect(response.body, 'an error body must be returned, not swallowed').toBeDefined();
});
