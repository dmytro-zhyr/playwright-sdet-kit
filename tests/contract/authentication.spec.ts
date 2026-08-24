import { test, expect } from '@/fixtures';

/** The client's four verbs, so the endpoint table below stays data and not a chain of branches. */
type Method = 'get' | 'put' | 'post' | 'del';

/**
 * The twelve endpoints C-003 names as requiring a credential.
 *
 * The guard is expected to answer before the path is resolved, so the username, slug and comment
 * identifier here are placeholders and need not exist — that is what the case says, and it is
 * also what makes the table safe to send from any worker: nothing in it reads or writes a record.
 */
const GUARDED_ENDPOINTS: { method: Method; path: string }[] = [
  { method: 'get', path: '/user' },
  { method: 'put', path: '/user' },
  { method: 'post', path: '/profiles/qa_nobody_000/follow' },
  { method: 'del', path: '/profiles/qa_nobody_000/follow' },
  { method: 'get', path: '/articles/feed' },
  { method: 'post', path: '/articles' },
  { method: 'put', path: '/articles/there-is-no-such-slug-000' },
  { method: 'del', path: '/articles/there-is-no-such-slug-000' },
  { method: 'post', path: '/articles/there-is-no-such-slug-000/comments' },
  { method: 'del', path: '/articles/there-is-no-such-slug-000/comments/999999999' },
  { method: 'post', path: '/articles/there-is-no-such-slug-000/favorite' },
  { method: 'del', path: '/articles/there-is-no-such-slug-000/favorite' },
];

// Turns red if the authentication guard stops being attached to one of these twelve endpoints, or
// if it starts answering something other than 401 — a 403, a 404, or a 200 carrying somebody's
// data. The read with a real token that opens the test is what proves the address and the
// credential, so a red below it cannot be a misspelled route or an unattached token.
test('C-003 — every endpoint that requires authentication refuses a caller with no credential', async ({
  api,
  registeredUser,
}) => {
  // The positive half, and it runs first on purpose: one variable — the token — separates it from
  // the twelve below, so a 401 there cannot be a misspelled route or an unattached credential.
  // It cannot run last: this target answers 401 to an authenticated request that follows a run of
  // consecutive anonymous ones, which is a defect of the target and not of this guard. See
  // pipeline/03-report.md.
  const authorised = await registeredUser.api.get('/user');
  expect(authorised.status, 'the same endpoint must answer 200 to a caller with a token').toBe(200);

  const observed: string[] = [];

  for (const { method, path } of GUARDED_ENDPOINTS) {
    const response =
      method === 'get'
        ? await api.get(path)
        : method === 'del'
          ? await api.del(path)
          : method === 'put'
            ? await api.put(path, {})
            : await api.post(path, {});

    observed.push(`${method} ${path} -> ${response.status}`);
  }

  expect(observed, 'every guarded endpoint must answer 401 to an anonymous caller').toEqual(
    GUARDED_ENDPOINTS.map(({ method, path }) => `${method} ${path} -> 401`)
  );
});

// Turns red if the guard stops verifying the token it finds — accepting an invented one with a
// 200, or answering 500 because it never expected a value it could not resolve. The genuine token
// in the second half proves the 401 is about the token and not about the request.
test('C-004 — a token the API never issued is not a credential', async ({ registeredUser }) => {
  const forged = await registeredUser.api.withToken('not.a.real.token').get('/user');

  expect(forged.status, 'a token the API never issued must be refused').toBe(401);

  const genuine = await registeredUser.api.get('/user');
  expect(genuine.status, 'the same request with the issued token must be served').toBe(200);
});

// Turns red if the authentication guard is attached to an endpoint that must serve anonymous
// callers — a 401 on any of these seven — or if one of them stops carrying the envelope key its
// own endpoint is named for, which would mean the anonymous path reached a different handler.
test('C-005 — an endpoint that does not require authentication serves an anonymous caller', async ({
  api,
  factories,
  registeredUser,
}) => {
  // The case asks for "a registered account with one article, so the profile, article and comment
  // paths name something that exists". `registeredUser` supplies the credentials the login step
  // needs; the article and its author are taken from the target rather than created here, because
  // this case is about the guard and must not go red over whether a fresh article is published.
  const list = await api.get('/articles?limit=1');
  const { articles } = list.body as { articles: { slug: string; author: { username: string } }[] };
  test.skip(articles.length === 0, 'the target has no articles to read anonymously');

  const { slug, author } = articles[0];
  const credentials = { email: registeredUser.user.email, password: registeredUser.user.password };

  const calls = [
    { key: 'user', response: await api.post('/users', { user: factories.user.build() }) },
    { key: 'user', response: await api.post('/users/login', { user: credentials }) },
    { key: 'profile', response: await api.get(`/profiles/${author.username}`) },
    { key: 'articles', response: await api.get('/articles') },
    { key: 'article', response: await api.get(`/articles/${slug}`) },
    { key: 'comments', response: await api.get(`/articles/${slug}/comments`) },
    { key: 'tags', response: await api.get('/tags') },
  ];

  const refused = calls
    .filter(({ response }) => response.status === 401)
    .map(({ key }) => `${key} -> 401`);
  expect(refused, 'no open endpoint may answer 401 to an anonymous caller').toEqual([]);

  const missing = calls
    .filter(({ key, response }) => {
      const body = response.body;
      return typeof body !== 'object' || body === null || !(key in body);
    })
    .map(({ key, response }) => `${key} missing, HTTP ${response.status}`);
  expect(missing, 'every open endpoint must answer with the envelope key it is named for').toEqual(
    []
  );
});
