import { test, expect } from '@fixtures';
import { UserResponseSchema } from '@schemas/conduit.schema';

// The specification states no success status for registration or for login — it says only that
// each "returns a User", and conforming deployments disagree: 201 on api.realworld.show, 200 on
// realworld.habsida.net. So this set is a gap in the contract rather than a preference, and every
// assertion using it names the gap in its message. What still makes those assertions red: a 401,
// a 404, a 422, a 500 — anything that is not the endpoint succeeding.
const USER_ENDPOINT_SUCCESS = [200, 201];
const USER_ENDPOINT_SUCCESS_MESSAGE =
  'the specification states no success status for registration or login, only that each returns a User, so 200 and 201 are both accepted';

/** The client's four verbs, so the endpoint table below stays data and not a chain of branches. */
type Method = 'get' | 'put' | 'post' | 'del';

// Turns red if the API stops honouring a token it issued itself — a header nobody reads, a token
// nobody verifies, a lookup that resolves it to a different account — or if a login token and a
// registration token stop being the same artefact, which would show up here as one of the two
// reads answering 401 while the other answers 200.
test('C-001 — a token from a registration and a token from a login both authenticate as their account', async ({
  api,
  factories,
}) => {
  const account = factories.user.build();

  const registration = await api.post('/users', { user: account });
  expect(
    USER_ENDPOINT_SUCCESS,
    `the account under test must be registered — ${USER_ENDPOINT_SUCCESS_MESSAGE}`
  ).toContain(registration.status);
  const registered = registration.body as { user: { token: string } };

  const login = await api.post('/users/login', {
    user: { email: account.email, password: account.password },
  });
  expect(
    USER_ENDPOINT_SUCCESS,
    `the same account must be able to log in — ${USER_ENDPOINT_SUCCESS_MESSAGE}`
  ).toContain(login.status);
  const loggedIn = login.body as { user: { token: string } };

  const reads = [
    { minted: 'registration', response: await api.withToken(registered.user.token).get('/user') },
    { minted: 'login', response: await api.withToken(loggedIn.user.token).get('/user') },
  ];

  expect(
    reads.map(({ minted, response }) => `${minted} token -> ${response.status}`),
    'a token the API issued must be carried out rather than refused'
  ).toEqual(reads.map(({ minted }) => `${minted} token -> 200`));

  for (const { minted, response } of reads) {
    expect(response.body).toMatchSchema(UserResponseSchema);

    const { user } = response.body as { user: { email: string; username: string } };
    expect(user.email, `the ${minted} token must resolve to the account it was issued for`).toBe(
      account.email
    );
    expect(user.username, `the ${minted} token must resolve to the account it was issued for`).toBe(
      account.username
    );
  }
});

// Turns red if the authentication guard stops being attached to one of these twelve endpoints, or
// if it starts answering something other than 401 — a 403, a 404, or a 200 carrying somebody's
// data — or if one of the twelve reaches its handler far enough to change the resource it names.
// The authenticated read that opens the test is what proves the address and the credential, so a
// 401 below it cannot be a misspelled route or an unattached token. The follow endpoint and the
// favorite endpoint each get two targets, not one: POST and DELETE share a path, and a single
// `following` or `favoritesCount` saturated by a precondition can prove one verb only by making the
// other unprovable — following false catches a bypassed POST but not a bypassed DELETE, following
// true is the other way round. So the DELETE aims at a relationship and a favorite a precondition
// already made, on a *second* account and a *second* article rather than a self-follow — a
// self-follow's `following: true` could be an implementation special case rather than a stored row
// — while the POST keeps aiming at the original, untouched profile and article, exactly as before.
test('C-002 — every endpoint that requires authentication refuses a caller with no credential', async ({
  api,
  factories,
  registeredUser,
}) => {
  // The positive half, and it runs first on purpose: one variable — the token — separates it from
  // the twelve below, so a 401 there cannot be a misspelled route or an unattached credential.
  const authorised = await registeredUser.api.get('/user');
  expect(authorised.status, 'the same endpoint must answer 200 to a caller with a token').toBe(200);

  // The case asks for "an existing target" behind every path, and for an article carrying at
  // least one comment, so that the mutating endpoints address something a later read can check.
  const sent = factories.article.build();
  const created = await registeredUser.api.post('/articles', { article: sent });
  const { article } = created.body as { article: { slug: string } };
  expect(article?.slug, 'the case needs one article that exists').toBeTruthy();

  const commentBody = factories.comment.build().body;
  const commented = await registeredUser.api.post(`/articles/${article.slug}/comments`, {
    comment: { body: commentBody },
  });
  const { comment } = commented.body as { comment: { id: number } };
  expect(comment?.id, 'the case needs one comment that exists').toBeDefined();

  const username = registeredUser.user.username;

  // A second account, followed by registeredUser now, so the guarded DELETE below has an existing
  // relationship to remove — on somebody other than the caller, not a self-follow.
  const second = factories.user.build();
  const secondRegistration = await api.post('/users', { user: second });
  expect(
    USER_ENDPOINT_SUCCESS,
    `the case needs a second account to follow — ${USER_ENDPOINT_SUCCESS_MESSAGE}`
  ).toContain(secondRegistration.status);

  const secondFollow = await registeredUser.api.post(`/profiles/${second.username}/follow`, {});
  expect(
    secondFollow.status,
    'the case needs an existing follow, of an account other than the caller, for the guarded unfollow to have something to remove'
  ).toBe(200);

  // A second article, favorited by registeredUser now, so the guarded DELETE below has an existing
  // favorite to remove that is not the same article the guarded POST targets.
  const otherArticleCreated = await registeredUser.api.post('/articles', {
    article: factories.article.build(),
  });
  const { article: otherArticle } = otherArticleCreated.body as { article: { slug: string } };
  expect(otherArticle?.slug, 'the case needs a second article to favorite').toBeTruthy();

  const secondFavorite = await registeredUser.api.post(
    `/articles/${otherArticle.slug}/favorite`,
    {}
  );
  expect(
    secondFavorite.status,
    'the case needs an existing favorite, on an article other than the one the guarded POST targets, for the guarded unfavorite to have something to remove'
  ).toBe(200);

  const guardProbe = 'qa_guard_probe';

  // 🔑 The payloads are not decoration. Sent `{}`, several of these endpoints answer 422 rather
  // than 401 on the gate deployment, because validation runs before authentication there — that
  // is a question about ordering, and it already has its own test in tests/defects/. This test
  // asks a different one — is the guard attached at all — and a valid payload is how it asks only
  // that.
  const guarded: { method: Method; path: string; data?: unknown }[] = [
    { method: 'get', path: '/user' },
    { method: 'put', path: '/user', data: { user: { bio: guardProbe } } },
    { method: 'post', path: `/profiles/${username}/follow` },
    { method: 'del', path: `/profiles/${second.username}/follow` },
    { method: 'get', path: '/articles/feed' },
    {
      method: 'post',
      path: '/articles',
      data: { article: { title: guardProbe, description: guardProbe, body: guardProbe } },
    },
    {
      method: 'put',
      path: `/articles/${article.slug}`,
      data: { article: { title: guardProbe } },
    },
    { method: 'del', path: `/articles/${article.slug}` },
    {
      method: 'post',
      path: `/articles/${article.slug}/comments`,
      data: { comment: { body: guardProbe } },
    },
    { method: 'del', path: `/articles/${article.slug}/comments/${comment.id}` },
    { method: 'post', path: `/articles/${article.slug}/favorite` },
    { method: 'del', path: `/articles/${otherArticle.slug}/favorite` },
  ];

  const observed: string[] = [];

  for (const { method, path, data } of guarded) {
    const response =
      method === 'get'
        ? await api.get(path)
        : method === 'del'
          ? await api.del(path)
          : method === 'put'
            ? await api.put(path, data ?? {})
            : await api.post(path, data ?? {});

    observed.push(`${method} ${path} -> ${response.status}`);
  }

  expect(observed, 'every guarded endpoint must answer 401 to an anonymous caller').toEqual(
    guarded.map(({ method, path }) => `${method} ${path} -> 401`)
  );

  // The second half of the expectation: a refusal that already wrote is still a refusal by
  // status, and only a later read can tell the two apart. Each read below covers the mutating
  // endpoints that address it — the original article for the update, the delete and the guarded
  // POST favorite, the second article for the guarded DELETE favorite, the comment list for the
  // comment create and delete, the account for the profile update, the original profile for the
  // guarded POST follow, the second profile for the guarded DELETE follow, and the author's own
  // listing for the create.
  const survivor = await registeredUser.api.get(`/articles/${article.slug}`);
  expect(survivor.status, 'an anonymous delete must not have removed the article').toBe(200);
  const kept = survivor.body as {
    article: { title: string; description: string; body: string; favoritesCount: number };
  };
  expect(
    [kept.article.title, kept.article.description, kept.article.body],
    'an anonymous update must not have changed the article'
  ).toEqual([sent.title, sent.description, sent.body]);
  expect(
    kept.article.favoritesCount,
    'an anonymous favorite must not have been counted on the article the guarded POST targets'
  ).toBe(0);

  const otherArticleSurvivor = await registeredUser.api.get(`/articles/${otherArticle.slug}`);
  expect(
    otherArticleSurvivor.status,
    'an anonymous delete must not have removed the second article'
  ).toBe(200);
  const otherArticleKept = otherArticleSurvivor.body as { article: { favoritesCount: number } };
  expect(
    otherArticleKept.article.favoritesCount,
    'an anonymous unfavorite must not have removed the favorite the precondition made on the article the guarded DELETE targets'
  ).toBe(1);

  const comments = await registeredUser.api.get(`/articles/${article.slug}/comments`);
  expect(comments.status, 'the comment list must still be readable').toBe(200);
  const listed = comments.body as { comments: { id: number; body: string }[] };
  expect(
    listed.comments.map(({ id, body }) => `${id}:${body}`),
    'an anonymous comment must not have been created and an anonymous delete must not have removed one'
  ).toEqual([`${comment.id}:${commentBody}`]);

  const account = await registeredUser.api.get('/user');
  const stored = account.body as { user: { bio: string | null } };
  expect(stored.user.bio, 'an anonymous update must not have written to the account').not.toBe(
    guardProbe
  );

  const profile = await registeredUser.api.get(`/profiles/${username}`);
  const relationship = profile.body as { profile: { following: boolean } };
  expect(
    relationship.profile.following,
    'an anonymous follow must not have made a relationship on the profile the guarded POST targets'
  ).toBe(false);

  const secondProfile = await registeredUser.api.get(`/profiles/${second.username}`);
  const secondRelationship = secondProfile.body as { profile: { following: boolean } };
  expect(
    secondRelationship.profile.following,
    'an anonymous unfollow must not have removed the relationship the precondition made on the profile the guarded DELETE targets'
  ).toBe(true);

  // Two articles now, not one: the original plus the second one the favorite precondition made.
  // R-106/R-120 order the list by `createdAt` descending, so the second — created later — leads.
  const authored = await registeredUser.api.get(`/articles?author=${username}`);
  const own = authored.body as { articles: { slug: string }[] };
  expect(
    own.articles.map(({ slug }) => slug),
    'an anonymous create must not have added a third article to the caller'
  ).toEqual([otherArticle.slug, article.slug]);
});

// Turns red if the token-to-subject lookup stops distinguishing its callers — resolving every
// token to the same stored account, or to the most recently created one — which would show up
// here as two reads describing one account. A single token cannot see that failure, which is why
// this case needs two.
test('C-004 — a token addresses its own account and no other', async ({
  api,
  factories,
  registeredUser,
}) => {
  const second = factories.user.build();
  const registration = await api.post('/users', { user: second });
  expect(
    USER_ENDPOINT_SUCCESS,
    `the case needs a second account — ${USER_ENDPOINT_SUCCESS_MESSAGE}`
  ).toContain(registration.status);
  const { user } = registration.body as { user: { token: string } };

  const first = await registeredUser.api.get('/user');
  const other = await api.withToken(user.token).get('/user');

  expect([first.status, other.status], 'each account must be able to read itself').toEqual([
    200, 200,
  ]);
  expect(first.body).toMatchSchema(UserResponseSchema);
  expect(other.body).toMatchSchema(UserResponseSchema);

  const firstUser = (first.body as { user: { username: string; email: string } }).user;
  const otherUser = (other.body as { user: { username: string; email: string } }).user;

  expect(
    [firstUser.username, firstUser.email],
    'a token must name the account it was issued for'
  ).toEqual([registeredUser.user.username, registeredUser.user.email]);
  expect(
    [otherUser.username, otherUser.email],
    'a token must name the account it was issued for'
  ).toEqual([second.username, second.email]);
  expect(otherUser.username, 'the two tokens must describe different accounts').not.toBe(
    firstUser.username
  );
});

// Turns red if the authentication guard is attached to an endpoint the specification marks as
// needing none — a 401 on any of these four — or if one of them stops carrying the envelope key
// its own endpoint is named for, which would mean the anonymous path reached a different handler.
test('C-005 — an endpoint that requires no authentication serves an anonymous caller', async ({
  api,
  factories,
  registeredUser,
}) => {
  // The case asks for "an existing account whose credentials are known, and an existing article".
  // `registeredUser` supplies the first and authors the second.
  const created = await registeredUser.api.post('/articles', {
    article: factories.article.build(),
  });
  const { article } = created.body as { article: { slug: string } };
  expect(article?.slug, 'the case needs one article that exists').toBeTruthy();

  const credentials = { email: registeredUser.user.email, password: registeredUser.user.password };

  const calls = [
    { key: 'user', response: await api.post('/users/login', { user: credentials }) },
    { key: 'user', response: await api.post('/users', { user: factories.user.build() }) },
    { key: 'article', response: await api.get(`/articles/${article.slug}`) },
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
