import { test, expect } from '@fixtures';
import {
  ArticleResponseSchema,
  ProfileResponseSchema,
  TagsResponseSchema,
  UserResponseSchema,
} from '@schemas/conduit.schema';

// The specification states no success status for registration — anywhere, and for any endpoint.
// It says only that the call "returns a User". Conforming deployments disagree: 201 on
// api.realworld.show, 200 on realworld.habsida.net. So this set is a gap in the contract rather
// than a preference, and the assertion using it names the gap in its message. What still makes it
// red: a 404, a 422, a 500 — anything that is not the endpoint succeeding.
const REGISTRATION_SUCCESS = [200, 201];
const REGISTRATION_SUCCESS_MESSAGE =
  'the specification states no success status for registration, only that it returns a User, so 200 and 201 are both accepted';

// Turns red if GET /tags changes shape — tags disappears, stops being an array of strings, or a
// new field appears alongside it.
test('GET /tags matches the schema', async ({ api }) => {
  const response = await api.get('/tags');

  expect(response.status).toBe(200);
  expect(response.body).toMatchSchema(TagsResponseSchema);
});

// Turns red if registration stops succeeding at all — a 404, a 422, a 500 — or stops returning a
// user envelope, or starts returning a field the contract does not describe.
test('POST /users matches the user response schema', async ({ api, factories }) => {
  const response = await api.post('/users', { user: factories.user.build() });

  expect(REGISTRATION_SUCCESS, REGISTRATION_SUCCESS_MESSAGE).toContain(response.status);
  expect(response.body).toMatchSchema(UserResponseSchema);
});

// Turns red if the authenticated user endpoint drifts from the registration response shape.
test('GET /user matches the user response schema', async ({ registeredUser }) => {
  const response = await registeredUser.api.get('/user');

  expect(response.status).toBe(200);
  expect(response.body).toMatchSchema(UserResponseSchema);
});

// Turns red if a single article stops carrying `body` — the one field that separates the two
// article shapes — or if an anonymous reader cannot fetch an article that was just written.
//
// ⚠️ It used to read the newest article the target happened to hold and `test.skip` when there
// were none. Changed 31 August 2026, under the rule in CONVENTIONS.md, "Never assert the shape of
// data you did not create": the sibling test that read comments the same way passed on an empty
// array for a week and hid D-12. This one was never vacuous — one article either matches the
// schema or does not — but it could be skipped into silence by an empty target, and it asserted
// somebody else's data.
//
// 📌 Written, then read **anonymously**, which is a second property for free: on
// conduit-unsound that read answers 404 (D-1), so the split between the two clients is not
// decoration.
test('GET /articles/:slug matches the single-article schema, with a body', async ({
  api,
  factories,
  registeredUser,
}) => {
  const created = await registeredUser.api.post('/articles', {
    article: factories.article.build(),
  });
  const { article } = created.body as { article?: { slug?: string } };
  expect(
    article?.slug,
    `the case needs one article of its own to read; creating it answered HTTP ${created.status}`
  ).toBeTruthy();

  const response = await api.get(`/articles/${article?.slug}`);

  expect(response.status, 'an article that was just written must be readable anonymously').toBe(
    200
  );
  expect(response.body).toMatchSchema(ArticleResponseSchema);
});

// Turns red if the profile shape drifts from the author shape embedded in articles — they are
// the same schema, and this is what keeps that true.
test('GET /profiles/:username matches the profile schema', async ({ registeredUser }) => {
  const response = await registeredUser.api.get(`/profiles/${registeredUser.user.username}`);

  expect(response.status).toBe(200);
  expect(response.body).toMatchSchema(ProfileResponseSchema);
});

// 📌 Three tests have left this file. The article list still carries `body` on the gate
// deployment and blank input is answered 500 there — D-8 and D-7 in spec/FINDINGS.md — and a
// comment's author arrives without `following`, D-12. All three now live in
// tests/defects/schemas.spec.ts, against a named deployment, and none was weakened to move.
// ArticlesResponseSchema and ErrorsSchema are unchanged; ErrorsSchema is still exercised here by
// registration, login and articles.
//
// ⚠️ The comments test did not leave because the shape changed. It left because it was **not
// looking**, and that is worth more than the defect it was hiding. It read the newest article and
// validated whatever comments it carried — and the newest article almost never has any, so
// `{"comments": []}` satisfied the schema over and over. It went red on 31 August 2026 only
// because the newest article happened to carry one. So the defect below cannot be dated: the check
// that should have found it was passing on an empty array the whole time.
//
// 🔑 The rule that follows: **a test that reads data somebody else created is not a test of
// that data's shape.** The replacement in tests/defects/schemas.spec.ts registers an account,
// writes an article and posts its own comment, so there is always exactly one comment to look at
// and an empty list is a failure rather than a pass.
