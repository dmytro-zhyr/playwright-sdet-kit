# How to write a test in this repository

Two readers use this file: a person adding a test by hand, and the TA agent, whose system prompt
is this document verbatim. Every claim below was checked against the code. Where the two ever
disagree, **the code is right and this file is the bug** — fix the file, do not bend the code to
match it.

## Imports

Contract tests — everything under `tests/contract/` — take `test` and `expect` **only** from
`@fixtures`:

```ts
import { test, expect } from '@fixtures';
```

Schemas come from `@schemas/conduit.schema`, and that is the only other import a contract test
normally needs:

```ts
import { ArticleResponseSchema, ErrorsSchema } from '@schemas/conduit.schema';
```

⚠️ In `tests/contract/`, **do not import `test` from `@playwright/test`** — that one carries none
of our fixtures, and its `expect` has no `toMatchSchema`.

📌 `tests/defects/` imports exactly the same way, from `@fixtures`.

📌 Exception: `tests/unit/` tests the framework's own code, needs no fixtures, and imports `test`
straight from `@playwright/test`. It imports `expect` from `@schemas/toMatchSchema` when it needs
the schema matcher.

**One alias per directory**, declared in `tsconfig.json`:

| Alias | Directory |
|---|---|
| `@api/*` | the Conduit client and the fixtures built on it |
| `@deployments/*` | which deployments exist, where they are, and how a URL to one is formed |
| `@data/*` | factories |
| `@po/*` | page objects |
| `@schemas/*` | `zod` schemas and the `toMatchSchema` matcher |
| `@pipeline/*` | the agent-chain artifact parsers and validators |
| `@report/*` | Allure categories and environment |
| `@fixtures` | the merged `test` and `expect` — a file, so no trailing `/*` |

📌 It used to be a single `@/*` pointing at the repository root, which made every import read
`@/api/...` and told the reader nothing the path did not already say. Per-directory aliases match
[`websocket-test`](https://github.com/dmytro-zhyr/websocket-test), and an import now names a
**layer** rather than a folder from the root.

🔑 **One directory, one fixtures file** — `api/apiFixtures.ts`, `deployments/deploymentFixtures.ts`,
`data/dataFixtures.ts`, `po/poFixtures.ts`. That rule is what moved the deployment registry out of
`api/` on 31 August 2026: two fixture files in one directory was the only place it was broken, and
the break was a symptom. `deployments/registry.ts` had grown UI addresses and a
`resolveUiDeployment`, so a file under `api/` was answering "where is the front end" — and three of
its four importers were not `api/` at all, including `po/`, which reached across a layer only to
find out where its own UI lived.

📌 **`api/conduitClient.ts` importing `@deployments/url` is deliberate, not a leak.**
`withTrailingSlash` and `stripLeadingSlash` are two halves of one contract — the base keeps its
last segment, the path gives up its first slash — and only the registry ever builds a base. Split
across two directories they could drift apart, and the drift would be silent, which is the exact
failure that file exists to prevent.

⚠️ **Do not add `baseUrl`.** `websocket-test` has one and this repository must not: TypeScript 6
deprecates it and `tsc` refuses to compile without an `ignoreDeprecations` escape. Paths are
resolved relative to `tsconfig.json` on their own, which is why every value here starts `./`.

Use an alias for every import inside `tests/`; there is not a single relative `../..` import there,
and adding one would be the first.

## Available fixtures

| Fixture | Type | What it gives you |
|---|---|---|
| `api` | `ConduitClient` | anonymous client on the project's own target, no token attached |
| `registeredUser` | `{ user: NewUser; token: string; api: ConduitClient }` | a user created through the API; `registeredUser.api` already carries the token |
| `factories` | `{ user, article, comment }` | data factories, each with `build(overrides?)` |
| `deployment` | `(name) => Promise<ConduitClient>` | an anonymous client on the **named** deployment, over its own request context |

`api` and `registeredUser` are defined in `api/apiFixtures.ts`; `deployment` in
`deployments/deploymentFixtures.ts`; `factories` in `data/dataFixtures.ts`. `fixtures.ts` merges them with
`mergeTests`, and merges the schema matcher in with `mergeExpects`. Those four names are the whole
fixture surface — there is no `request`, no `page`, no `context` to ask for.

### Naming a deployment

```ts
const gate = await deployment('conduit-gate');
```

| Name | Default | What it is |
|---|---|---|
| `conduit-gate` | `https://realworld.habsida.net/api` | the deployment the `contract` gate is measured against; D-6 to D-11 are its |
| `conduit-unsound` | `https://api.realworld.show/api` | uniqueness, identity and visibility all fail here; D-1 to D-5 are its |
| `conduit-overstrict` | `https://conduit-api.bondaracademy.com/api` | conforms, but rejects a username over 20 characters, a limit the specification never states |

The registry is `deployments/registry.ts`: one entry per deployment, each with the variable that
repoints it and a default that makes a `.env` optional. Adding a deployment — or a second product
— is appending an entry, not editing resolution logic.

- Every call to `deployment` builds its **own** `APIRequestContext`, and every context a test
  opened is disposed when that test ends. A test may name several deployments.
- The name is a TypeScript union, so a typo is a compile error. At run time an unknown name
  **throws and lists the valid ones** — it never falls back to a default, because a suite running
  green against a deployment nobody chose is the failure this repository exists to refuse. A
  variable that is set but empty throws for the same reason.
- ⛔ Do not use `deployment` in `tests/contract/` to work around a target. A contract test uses
  `api` and takes the project's target; if that target violates the specification, the test moves
  to `tests/defects/` and names the deployment there.

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
  client strips the leading slash so the `/api` segment of the base URL survives; see `deployments/url.ts`
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
import { ArticleResponseSchema } from '@schemas/conduit.schema';

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

   **A `C-###` appears only where the report agrees.** `tests/unit/artifacts.spec.ts` checks both
   directions: every identifier in `tests/contract/` and `tests/defects/` must be reported as
   automated in that same file, and every row of `## Automated` must name a file that carries its
   identifier. This holds for prose in comments as well as for test names — a reference that only
   has to resolve is exactly what went stale on 25 August. Refer to a neighbouring test by its
   file, not by an identifier you are not implementing. Tests in `tests/defects/` carry `D-###`
   from `spec/FINDINGS.md` instead, because they document a target, not a case.

   ⚠️ **`spec/` is outside that check and is maintained by hand.** The scan covers
   `tests/contract/` and `tests/defects/` only, and `spec/FINDINGS.md` is not a file the report's
   `## Automated` table describes, so widening the scan to it would change what the check means
   rather than strengthen it. A `C-###` written in `spec/` therefore only has to *resolve* —
   exactly the weakness this rule closes everywhere else. Three of them went stale there on
   25 August and were found by reading. Re-read them by hand whenever the cases are regenerated.
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

Assert the **exact** status the target returns, not a range: an unknown slug returns `404`, a
validation failure returns `422`. `toBeGreaterThanOrEqual(400)` would keep passing through a
change worth noticing.

⚠️ **Exact does not mean target-specific.** Assert a status the **specification** states. Where it
states none, the two deployments disagree and an exact assertion pins the suite to whichever one
it was written against — registration answers `201` on `api.realworld.show` and `200` on
`realworld.habsida.net`, and the specification only says it "returns a User". The same trap sits
in the error body: the specification's own example keys a validation error under `body`, so a test
demanding `errors.email` is asserting more than the contract. Before writing an exact value, check
that `spec/conduit-api.md` states it.

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

### Which target a project takes by default

| Project | Deployment | Environment variable |
|---|---|---|
| `contract`, `unit` | `conduit-gate` | `CONDUIT_API_URL` |
| `defects` | `conduit-unsound` | `CONDUIT_DEFECTS_API_URL` |

Both have working defaults, so the repository runs with no `.env`. `playwright.config.ts` resolves
both through `deployments/registry.ts` rather than spelling a URL, so a project and a test can never
disagree about where a name points. The `defects` project carries its own `use.baseURL`, so moving
the gate never moves it.

📌 **A project default is what `api` and `registeredUser` take. It is not what a defects test is
about.** Defects are documented on more than one deployment, so a defects test names its own with
the `deployment` fixture; `tests/defects/authentication.spec.ts` names two, in one file.

⛔ **Never point `CONDUIT_DEFECTS_API_URL` at a conforming target.** Those tests assert the
specification, so a healthy target turns them green — and green in that suite is supposed to mean
the defect was fixed.

⚠️ A contract test may talk to a deployment that is not the one reconnaissance was written
against. Write it against `spec/conduit-api.md`; where a deployment diverges, that is a finding
for `spec/FINDINGS.md`, not an assertion to loosen and not an assertion to re-pin.

⚠️ The `contract` project runs with **a single worker**, and a test must not depend on that. The
reason is D-4 in `spec/FINDINGS.md`: under concurrency that target hands a token holder somebody
else's account, and a gate must not go red on somebody else's defect. The gate no longer runs
against the deployment with D-4, so the setting is now a conservative one rather than a necessary
one — restoring the workers is a separate, deliberate change. Either way, do not write a test that
only works sequentially.

📌 **The concurrency a defects test needs is inside the test, not in the worker count.** The D-4
test issues its parallel requests with `Promise.all`; Playwright reporting "1 worker" for that
project means only that there is one file to spread across workers. A defects test that relied on
Playwright's parallelism instead would stop reproducing anything the moment it was the only file
left.

Formatting is Prettier with `singleQuote`, `printWidth: 100`, `trailingComma: "es5"`. Run
`npm run format`; `npx prettier --check .` is a gate. `.prettierignore` excludes `*.md`, so
Markdown in this repository — including this file and the `pipeline/*.md` chain artifacts — is
wrapped by hand at roughly 100 columns.

📌 **That includes the fields of a rule or a case: a `**Source:**`, `**Kind:**`, `**Statement:**`
or `**Covers:**` value may wrap onto as many further lines as it needs.** The parser in
`pipeline/parse.ts` reads a field value up to the first line that opens another field, opens a
heading, or is blank, and joins the pieces with a single space. A long statement wraps like any
other line in this repository and keeps its whole meaning.

## Known defects of the pinned target

Tests that assert the specification where a deployment violates it live in `tests/defects/`, not
in `tests/contract/`. They name the deployment they are about, they are red on purpose, they run
on a schedule rather than in the PR gate, and each one carries an `issue` annotation naming the
defect:

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

📌 **Splitting beats moving when a test is mixed.** C-006 and C-003 each asserted a conforming
half and a violated half at once, so the whole test was red and the conforming half was invisible.
Both were split: the conforming half stayed in `tests/contract/` and is green there, and the
violated half moved to `tests/defects/` naming `conduit-gate`. One muddled red became one green
and one precise red. ⛔ The split is never made by weakening an assertion — the halves assert
exactly what they asserted before.

## What not to do

- Do not use `page`, `context` or any browser fixture **outside `tests/ui/`**. The `contract`,
  `unit` and `defects` projects run without a browser, and requesting one would start it. The
  `ui` project is the one place a browser belongs, and it has its own page objects in `po/` — a
  UI test drives those rather than reaching for raw locators.
- Do not assert an API-level fact from a UI test. The UI gate is `conduit-overstrict` and the API
  gate is `conduit-gate`: they are **different deployments**, so a difference the two layers
  disagree about may be a difference between two servers. A UI test tempted to check a response
  body belongs in `tests/contract/`.
- Do not build your own HTTP client, and do not call `request` directly: everything goes through
  `api` or `registeredUser.api`.
- Do not add `waitForTimeout` or any sleep. If a test needs to wait for something, it is asserting
  the wrong thing.
- Do not try to clean up users — there is no delete endpoint, and that is a known limitation, not
  an oversight.
- Do not assert the shape of a token. The two deployments do not agree on it: `api.realworld.show`
  returns an opaque `token_<hex>` and `realworld.habsida.net` returns a JWT. The specification
  guarantees only a string.
- Do not assert a format for `slug`. The specification guarantees only that it is a unique string.

## Writing a UI test

Everything above applies; these are the rules that only exist because a browser is involved.

🔑 **Set up through the API, drive the subject through the UI.** Ask for `signedIn` and the account
is created over the API with its token seeded into the browser before the app boots — so an editor
test is not also a sign-up test, failing on three fields, a submit, a redirect and a guard that
have nothing to do with publishing an article.

⛔ **The exception proves the rule:** a test **about** sign-up may not shortcut sign-up.
`tests/ui/registration.spec.ts` drives the form on purpose. The rule is not "the API is faster",
it is "setup through the API, the subject through the UI".

⛔ **Never `registeredUser` in `tests/ui/`.** It carries the project's `baseURL`, which in the `ui`
project is the browser UI, not the API — the request goes to a web page. Use `uiAccount`, which
opens its own context against the API of the deployment the UI project is pointed at.

⛔ **Never assert an API-level fact from a UI test.** The UI gate is `conduit-overstrict` and the
API gate is `conduit-gate`; they are different deployments, so a disagreement between the layers
may be a disagreement between two servers. That test belongs in `tests/contract/`.

📌 **Locators go through a page object.** A raw locator in a spec is a locator nobody else can
reuse and nobody will update.

📌 **A page object exposes locators and actions, and asserts nothing.** An expectation written
inside one cannot be read at the call site: the test would say `await nav.checkSignedIn()` and the
report would name the component, not the behaviour under test.

📌 **Prefer a role, and say so when you cannot.** The feed tabs carry no interactive role at all,
so `po/homePage.ts` uses a class and a comment explaining that the markup, not the locator, is the
reason.

⚠️ **Wait for a response, never for `networkidle`.** In a single-page app the network settles while
a form is still mid-submit, and an assertion taken there reports a defect that does not exist —
which is how the first reconnaissance of this stage accused the sign-up form of locking up.

⚠️ **A page that can redirect must not be waited on by its content.** Check the path and fail with
the cause. The absence of an element is a consequence, and a report made of consequences is
expensive to read.

## Steps, and what the report reads like

📌 **Wrap a composite page-object action in `test.step`, and nothing else.** A step is a line in
the report, so the useful granularity is the one a person would use to describe what happened —
`sign up as qa_x9k`, not six `locator.fill` calls. Wrapping a getter buries the story under noise;
wrapping nothing leaves a failed UI test reading as a stack trace with no narrative.

📌 **`test.step`, never an Allure step.** The same structure then appears in the terminal, in
Playwright's HTML report and in Allure, and the page objects stay free of any reporter's API. A
page object that imports a reporter is a page object that cannot be reused under a different one.

📌 **A new Allure category goes in `report/allure.ts`, narrow, and ordered before the ones it must
not be swallowed by.** A result lands in the *first* category that matches, so a loose category
does not mislabel one failure — it steals every failure the categories below it were written for.

⚠️ **Do not add a catch-all category.** Allure supplies `Product defects` and `Test defects`
already, and a failure that reaches them is a failure nobody has explained yet. That is a signal,
not a gap to be filled.

## Playwright agent tooling — the CLI first, MCP only where it cannot reach

Two ways of driving a browser from an agent are installed here, and they are **not equals**.

🔑 **The default is the CLI** — `npx playwright cli`, and the skills under `.claude/skills/` that
wrap it. Use it wherever it reaches. It keeps snapshots on disk instead of in the conversation, so
the context window stays available for the code being written rather than for tool schemas and an
accessibility tree.

**MCP is the fallback, not the other option.** `.mcp.json` and the three vendored agents under
`.claude/agents/playwright-test-*` address the browser through it, because that is how Microsoft
shipped them and the tools are named in their frontmatter. That is a reason to keep MCP available,
not a reason to reach for it first.

➡️ **The rule: if the CLI can do it, the CLI does it. MCP is for what the CLI cannot reach** —
whatever the cause, capability or vendored tooling. Reaching for MCP because it is more
comfortable is the case this rule exists to refuse.

⚠️ **This corrects a symmetric framing written into `spec/FINDINGS.md` on 30 August 2026** — "MCP
for an agent that must look at a page, the CLI for work that must not spend the context window".
That reads as two equal tools for two jobs, and splits the decision every time it comes up. The
position is one default and one exception, which is decidable without rethinking it.
