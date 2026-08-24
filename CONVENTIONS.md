# How to write a test in this repository

Two readers use this file: a person adding a test by hand, and the TA agent, whose system prompt
is this document verbatim. Every claim below was checked against the code. Where the two ever
disagree, **the code is right and this file is the bug** — fix the file, do not bend the code to
match it.

## Imports

Contract tests — everything under `tests/contract/` — take `test` and `expect` **only** from
`@/fixtures`:

```ts
import { test, expect } from '@/fixtures';
```

Schemas come from `@/schemas/conduit.schema`, and that is the only other import a contract test
normally needs:

```ts
import { ArticleResponseSchema, ErrorsSchema } from '@/schemas/conduit.schema';
```

⚠️ In `tests/contract/`, **do not import `test` from `@playwright/test`** — that one carries none
of our fixtures, and its `expect` has no `toMatchSchema`.

📌 `tests/defects/` imports exactly the same way, from `@/fixtures`.

📌 Exception: `tests/unit/` tests the framework's own code, needs no fixtures, and imports `test`
straight from `@playwright/test`. It imports `expect` from `@/schemas/toMatchSchema` when it needs
the schema matcher.

`@/` is an alias for the repository root, declared in `tsconfig.json` as `"@/*": ["./*"]`. Use it
for every import inside `tests/`; there is not a single relative `../..` import there, and adding
one would be the first.

## Available fixtures

| Fixture | Type | What it gives you |
|---|---|---|
| `api` | `ConduitClient` | anonymous client, no token attached |
| `registeredUser` | `{ user: NewUser; token: string; api: ConduitClient }` | a user created through the API; `registeredUser.api` already carries the token |
| `factories` | `{ user, article, comment }` | data factories, each with `build(overrides?)` |

`api` and `registeredUser` are defined in `api/apiFixtures.ts`; `factories` in
`data/dataFixtures.ts`. `fixtures.ts` merges them with `mergeTests`, and merges the schema matcher
in with `mergeExpects`. Those three names are the whole fixture surface — there is no `request`,
no `page`, no `context` to ask for.

⚠️ `registeredUser` **throws** if registration fails or returns no `user.token`, with the status
and the response body in the message. A test does not need to check that the fixture worked.

📌 There is no teardown for a created user: the target has no delete endpoint. Accounts are
recognisable by the `qa_` prefix in both `username` and `email`. See `spec/FINDINGS.md`.

## The client

```ts
type ApiResponse = { status: number; body: unknown };

class ConduitClient {
  get(path: string): Promise<ApiResponse>;
  post(path: string, data: unknown): Promise<ApiResponse>;
  put(path: string, data: unknown): Promise<ApiResponse>;
  del(path: string): Promise<ApiResponse>;
  withToken(token: string): ConduitClient;
}
```

```ts
const response = await api.get('/tags');
// response: { status: number; body: unknown }
```

- **The client does not throw on non-2xx.** Checking the status is the test's job — that is what
  makes a test for `401`, `404` or `422` possible at all.
- **The delete method is `del`, not `delete`.** `delete` is a reserved word.
- **`withToken` returns a new client** and leaves the original anonymous. `api` stays anonymous
  for the whole test.
- **Paths are spec-shaped** — `/tags`, `/users`, `/articles/:slug`, `/articles?limit=5`. The
  client strips the leading slash so the `/api` segment of the base URL survives; see `api/url.ts`
  for why that is not optional.
- **`body` is typed `unknown`.** Narrow it explicitly:

```ts
const body = response.body as { articles?: unknown };
expect(Array.isArray(body.articles)).toBe(true);
```

- ⛔ **`any` is forbidden** — `@typescript-eslint/no-explicit-any` is an ESLint **error**, so
  `npm run lint` fails on it. TypeScript runs in `strict` mode; `npm run typecheck` is the other
  gate.
- 📌 A non-JSON body is handed back as the raw text rather than thrown away. A `503` with an HTML
  page arrives as a string in `body`.

## Response schemas

The shape of a response is checked with a **schema**, not a list of `toHaveProperty` calls:

```ts
import { ArticleResponseSchema } from '@/schemas/conduit.schema';

expect(response.body).toMatchSchema(ArticleResponseSchema);
```

Schemas live in `schemas/conduit.schema.ts`:

| Schema | Response it describes |
|---|---|
| `UserResponseSchema` | `POST /users`, `POST /users/login`, `GET /user`, `PUT /user` |
| `ProfileResponseSchema` | `GET /profiles/:username` and the follow endpoints |
| `ArticlesResponseSchema` | `GET /articles`, `GET /articles/feed` — a list plus `articlesCount` |
| `ArticleResponseSchema` | `GET /articles/:slug`, `POST /articles`, `PUT /articles/:slug` |
| `CommentResponseSchema` | `POST /articles/:slug/comments` |
| `CommentsResponseSchema` | `GET /articles/:slug/comments` |
| `TagsResponseSchema` | `GET /tags` |
| `ErrorsSchema` | any `422` — `{ errors: { field: string[] } }` |

The inner shapes `UserSchema`, `ProfileSchema`, `ArticlePreviewSchema`, `ArticleSchema` and
`CommentSchema` are exported too, but a test asserts against the **envelope**, because that is
what the endpoint returns.

- Every schema is **strict**: built with `z.strictObject`, or derived from one with `.extend()`,
  which keeps strictness — a unit test in `tests/unit/schema.spec.ts` pins that.
- ⛔ **Never relax a schema to make a test pass.** A non-strict schema catches a REMOVED field and
  misses an ADDED one — which is exactly what the schema is there to catch.
- A disagreement with the live API goes into `spec/FINDINGS.md` first, and only then into the
  schema. A schema fitted to a response has stopped being a contract and become a photograph.
- `ArticlePreviewSchema` is for articles inside a list — it has **no `body`**. `ArticleSchema` is
  for a single article and adds it. Using the wrong one is a real failure, not a technicality: the
  specification removed `body` from lists on 16 August 2024.

📌 `toMatchSchema` is a custom matcher wired in through `mergeExpects`. It reports the offending
field and the problem, which is why it exists instead of a bare `Schema.parse()`.

📌 This project is on **zod 4**. Write `z.strictObject({...})`, `z.email()`, `z.iso.datetime()` —
not the zod 3 spellings `z.object({...}).strict()`, `z.string().email()`, `z.string().datetime()`.

## Layout and naming

- Contract tests: `tests/contract/<topic>.spec.ts`
- One topic per file: `registration.spec.ts`, `articles.spec.ts`, `comments.spec.ts`
- The test name describes **behaviour**, not the method. Not "POST /users 422", but
  "registration without a password is rejected".

## Required in every test

1. **The case identifier**, `C-007`, for every test implementing a case from
   `pipeline/02-cases.md`. There is one default and one exception, and no choice beyond them:

   - **Default — in the test name:** `test('C-007 — registration without a password is rejected', …)`.
   - **Exception — in a `test.describe` title, only when one case needs several tests.** The
     `describe` then carries the identifier and the test names inside do not repeat it.

   One case yielding one test is the ordinary shape, and wrapping a single test in a `describe`
   only lengthens the title in the report. `--grep "C-007"` finds both forms equally, so
   searchability decides nothing here.

   The framework's own tests, written before the chain existed, carry no identifier — do not add
   one to them, and do not read their absence as licence to omit yours.
2. **A one-line comment saying what would make this test red.** Every test in this repository has
   one; the existing files are the demonstration.

```ts
// Turns red if the API starts accepting registration without a password, or answers 400 instead.
test('C-007 — registration without a password is rejected', async ({ api, factories }) => {
  ...
});
```

⚠️ If you cannot write the second one, the test is suspect. It is the cheapest available check
that the assertion actually asserts something.

⚠️ **A negative test does not validate itself.** A 404 proves only that something is absent, not
that you are talking to the right endpoint. Pair it with a positive assertion that proves the
address, the auth and the setup are right — otherwise a broken client makes the negative test
pass.

## Assertions

Pass a message as the second argument — it reaches the report:

```ts
expect(response.status, 'registration without a password must be rejected').toBe(422);
```

Assert the **exact** status the target returns, not a range. Registration returns `201` here, an
unknown slug returns `404`, a validation failure returns `422`; all of it is recorded in
`spec/FINDINGS.md`. `toBeGreaterThanOrEqual(400)` would keep passing through a change worth
noticing.

When a test depends on data the target may not have, skip on the condition instead of guessing:

```ts
const list = await api.get('/articles?limit=1');
const { articles } = list.body as { articles: { slug: string }[] };
test.skip(articles.length === 0, 'the target has no articles to read');
```

## How the suites run

| Command | Project | Notes |
|---|---|---|
| `npm run test:contract` | `contract` | `--workers=1`, deliberately — see below |
| `npm run test:unit` | `unit` | parser, matcher and URL helpers; no network |
| `npm run test:defects` | `defects` | red on purpose; see the note below about its concurrency |
| `npm run lint`, `npm run typecheck`, `npm run format` | — | ESLint, `tsc --noEmit`, Prettier |

⚠️ The `contract` project runs with **a single worker**, and a test must not depend on that. The
reason is D-4 in `spec/FINDINGS.md`: under concurrency the target hands a token holder somebody
else's account, and a gate must not go red on somebody else's defect. The day D-4 is fixed, the
workers come back — so do not write a test that only works sequentially.

📌 **The concurrency a defects test needs is inside the test, not in the worker count.** The D-4
test issues its parallel requests with `Promise.all`; Playwright reporting "1 worker" for that
project means only that there is one file to spread across workers. A defects test that relied on
Playwright's parallelism instead would stop reproducing anything the moment it was the only file
left.

Formatting is Prettier with `singleQuote`, `printWidth: 100`, `trailingComma: "es5"`. Run
`npm run format`; `npx prettier --check .` is a gate. `.prettierignore` excludes `*.md`, so
Markdown in this repository — including this file — is wrapped by hand at roughly 100 columns.

## Known defects of the target

Tests that assert the specification where the target violates it live in `tests/defects/`, not in
`tests/contract/`. They are red on purpose, they run on a schedule rather than in the PR gate, and
each one carries an `issue` annotation naming the defect:

```ts
test(
  'a token identifies its own user when accounts are registered concurrently',
  {
    annotation: {
      type: 'issue',
      description:
        'spec/FINDINGS.md — D-4; GitHub issue to be filed when the repository is published',
    },
  },
  async ({ api, factories }) => { ... }
);
```

The annotation points at the `D-#` entry in `spec/FINDINGS.md`, which is where the evidence lives;
it becomes a URL once the issue is filed. The HTML reporter shows annotations by itself. Without
the reference, a red test is just red.

⛔ Do not "fix" such a test by asserting the current behaviour instead. That turns it into a
photograph of a bug and removes any chance of noticing when it is fixed.

⛔ **Do not use `test.fail()` either.** It asserts only "this test must fail" and does not
distinguish why: if the target goes down or the error format changes, the test still fails
successfully and tells us nothing.

📌 A defects test is phrased so that **green is the news**. Its comment says what turning green
would mean, not what turning red would mean.

## What not to do

- Do not use `page`, `context` or any browser fixture — this project runs without a browser, and
  requesting one would start it.
- Do not build your own HTTP client, and do not call `request` directly: everything goes through
  `api` or `registeredUser.api`.
- Do not add `waitForTimeout` or any sleep. If a test needs to wait for something, it is asserting
  the wrong thing.
- Do not try to clean up users — there is no delete endpoint, and that is a known limitation, not
  an oversight.
- Do not assert the shape of a token. This target returns an opaque `token_<hex>`, not a JWT.
- Do not assert a format for `slug`. The specification guarantees only that it is a unique string.
