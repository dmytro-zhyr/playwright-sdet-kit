# Conduit reconnaissance — 23 August 2026

Everything below was **verified with requests**, not taken from the specification. Where the
target diverges from the [specification](conduit-api.md), the divergence is written down
separately and **the specification stays authoritative**.

## Two targets, on purpose

| Suite | Default target | Why |
|---|---|---|
| `contract`, `unit` | **`conduit-gate`**, `https://realworld.habsida.net/api` | conforms; this is the gate |
| `defects` | **`conduit-unsound`**, `https://api.realworld.show/api` | the deployment D-1 to D-5 are about |

📌 **Those are project defaults, not what a defects test is about.** Since D-6 to D-9 there are
documented defects on both, so a defects test names its own deployment with the `deployment`
fixture rather than inheriting the project's. The registry of names is `api/deployments.ts`; the
third live deployment is named there too, as `conduit-overstrict`.

Six hosted deployments were probed on 24 August 2026. Three answered, and they do not behave the
same way:

| | anonymous `GET /articles/:slug` of a created article | duplicate email | 8 concurrent registrations |
|---|---|---|---|
| `api.realworld.show` | 🔴 **404** | 🔴 **201** | 🔴 **7 of 8 returned another account** |
| `realworld.habsida.net` | ✅ 200 | ✅ 422 | ✅ 0 of 8 |
| `conduit-api.bondaracademy.com` | ✅ 200 | ✅ 422 | ✅ 0 of 8 |

Dead: `conduit.productionready.io` → 307, `api.realworld.io` → 530, `api.realworld.build` → no
answer.

🔑 **So D-1 to D-4 are defects of one deployment, not properties of RealWorld backends.** The
reconnaissance that opened this file happened to pick the worst of the three live instances. The
official conformance suite agrees the behaviour is wrong: it contains
`08-list-articles-without-auth`, so anonymous listing is part of the contract.

⚠️ **`conduit-api.bondaracademy.com` was rejected for a subtler reason** than being broken: it
rejects a username longer than 20 characters, a limit the specification never states. A target
that validates more than the contract makes a conformance suite report failures that are not
failures.

📌 **A note on how that was measured, because it nearly went wrong.** The first concurrency run
against that host reported 8 failures out of 8, which read like a broken target. The cause was the
probe: its generated usernames were over 20 characters. The target was blameless. Re-measured with
valid data, it is clean. Any verdict in this file was reproduced at least twice before being
written down.

### Switching targets

Every name resolves through one variable, all of them documented in `.env.example`, each with a
working default. Switching any of them is one line — that was a design decision on the first day,
and this is the day it paid off.

⛔ **Do not point `defects` at a conforming target.** Those tests assert the specification, so a
conforming target turns them green — and green in that suite is supposed to mean *the target was
fixed*. Pointing them somewhere healthy would be a lie told by a passing test.

## Authorization header

`Authorization: Token <token>`

| Probe | Result |
|---|---|
| `Authorization: Token <token>` on `GET /user` | **200** |
| `Authorization: Bearer <token>` on `GET /user` | 401 |
| no header | 401 |

⚠️ **The token is not a JWT.** The specification writes `jwt.token.here`; the target returns an
opaque `token_<32 hex>`. Consequence for tests: **do not decode the token and do not assert its
shape** beyond "a non-empty string". Any assertion about three dot-separated parts will be red
here.

## Endpoints

Checked line by line against the specification.

| Method and path | Auth | Note |
|---|---|---|
| POST /users | no | registration, returns **201** |
| POST /users/login | no | returns 200 |
| GET /user | yes | |
| PUT /user | yes | accepts `email`, `username`, `password`, `image`, `bio` |
| GET /profiles/:username | optional | |
| POST /profiles/:username/follow | yes | |
| DELETE /profiles/:username/follow | yes | |
| GET /articles | optional | filters `tag`, `author`, `favorited`, `limit`, `offset` |
| **GET /articles/feed** | **yes** | 🆕 **was missing from the plan's table**; without a token → 401 |
| POST /articles | yes | requires `title`, `description`, `body` |
| GET /articles/:slug | no | unknown slug → **404** |
| PUT /articles/:slug | yes | changing `title` **also changes `slug`** |
| DELETE /articles/:slug | yes | |
| POST /articles/:slug/comments | yes | requires `body` |
| GET /articles/:slug/comments | optional | |
| DELETE /articles/:slug/comments/:id | yes | |
| POST /articles/:slug/favorite | yes | |
| DELETE /articles/:slug/favorite | yes | |
| GET /tags | no | |

## Response shapes

`Content-Type: application/json` — **without `charset=utf-8`**, although the specification
suggests including it. A weak divergence: the wording there is "like", so it is a recommendation
rather than a requirement.

### 🔴 An article in a list and an article on its own are different shapes

| | `GET /articles` | `GET /articles/:slug` |
|---|---|---|
| Field count | 9 | **10** |
| `body` | ❌ absent | ✅ present |

This is **not a quirk of the instance**: the specification carries an explicit notice that since
16 August 2024 article lists no longer return `body`, for performance. It affects `GET /articles`
and `GET /articles/feed`.

➡️ **Consequence:** one strict `ArticleSchema` cannot serve both endpoints. Two are needed — a
preview, and a full one that extends it with `body`.

### The remaining shapes match the specification

- `user`: `email · token · username · bio · image`, where `bio` and `image` may be `null`.
  Verified through `GET /user` — exactly five keys, nothing extra.
- `profile`: `username · bio · image · following`.
- `tags`: `{ "tags": ["..."] }`.
- `articles`: `{ "articles": [...], "articlesCount": <number> }`.
- Dates: `2026-08-23T18:47:43.763Z` — ISO-8601 with milliseconds and `Z`.

⚠️ **`slug` has no format.** The specification says so directly: the only requirement is a unique
string, and how it is derived is up to the implementation. **Do not write a kebab-case regex.**

## Errors

Format verified: `{"errors":{"<field>":["<message>"]}}` — an object where every field maps to an
array of strings.

| Situation | Code |
|---|---|
| blank `username` | 422 |
| missing `password` | 422 |
| unknown resource | 404 |
| request without a token where one is required | 401 |

## Teardown limits

- Articles — removable through `DELETE /articles/:slug`.
- Comments — removable.
- **Users — there is no delete endpoint.** Test accounts accumulate forever. This is a **known
  limitation**; no workaround is invented. Accounts carry a `qa_` prefix in `username` and
  `email` so that an outside reader can tell where they came from.

---

## 🔴 Five defects of `api.realworld.show`

⚠️ **Everything in this section is a fact about that one deployment**, which is why the `defects`
suite pins its tests to it by name. None of the five reproduces on the gate deployment.

D-1 to D-3 were found by reconnaissance before any test existed. D-4 was found by the suite
itself, running in parallel. D-5 was found by the TA agent while implementing cases, and it is
listed first below because it is the one that made the target change.

All of them violate what the specification implies. They are recorded here, **not "fixed" by
lowering the expectations in the tests**.

### D-1 · Registration accepts an email that is already taken

```
POST /users {"user":{"username":"qa_dup_probe","email":"<already exists>",...}}  →  201
```

A second account is created with the same email.

**Why this is a defect and not a feature:** email is the login field. `POST /users/login` takes
`email` + `password`, and after duplication **login returns the second account**, leaving the
first unreachable. Verified: logging in with that email returned `username: qa_dup_probe`, not
the original one.

➡️ So this is not cosmetic — it is **loss of access to an account**.

### D-2 · Registration accepts a username that is already taken

```
POST /users {"user":{"username":"qa_dup_probe","email":"<new>",...}}  →  201
```

And it returns **the same token** the existing `qa_dup_probe` already had. The request did not
create a new user; it returned the existing one with a replaced email.

### D-3 · The consequence of both — uniqueness is enforced nowhere

Validation of field **presence** works correctly (422 with the right error shape). Validation of
**uniqueness** does not exist at all.

---

### 🔴 D-5 · Writes are invisible to everyone but their author

An article created with a valid token is answered `201` with a slug, and then:

| Request | Result |
|---|---|
| `GET /articles/:slug` **anonymously** | 🔴 **404** |
| `GET /articles/:slug` **with the author's token** | 200 |
| the article in `GET /articles` | absent — the public list stays at the four seeded articles |
| its tag in `GET /tags` | absent |

The specification marks `GET /articles/:slug` as requiring no authentication. Verified directly on
24 August 2026, and independently by the TA agent while implementing the cases.

➡️ **This is why the target changed.** It is not one broken endpoint: every case that expects
created data to be readable by anyone else — the list serializer, ordering, the three filters, the
feed, the write side of tags — cannot pass here, and the red would be the target's. That is most of
the suite the chain produced.

### 🔴 D-4 · Under concurrency, a token stops identifying its own user

The most serious of the four, and the only one that is invisible to sequential testing.

Register several users at the same time, then call `GET /user` with each one's own distinct
token. Measured on 24 August 2026 with eight parallel registrations:

```
presented=qa_leak_…_0  →  returned qa_leak_…_4, email qa_leak_…_4@example.com
presented=qa_leak_…_1  →  returned qa_leak_…_4, email qa_leak_…_4@example.com
presented=qa_leak_…_2  →  returned qa_leak_…_4, email qa_leak_…_4@example.com
…                          (all eight returned the same account)
```

**Seven of the eight received another account's data, including that account's email.** Run the
same sequence one request at a time and every token resolves correctly.

📌 **What the shape of the response says about the cause.** The `token` field in the reply equals
the token that was presented, while the rest of the body belongs to somebody else. The response is
assembled from two sources: the token is echoed back from the request, and the profile is read
from a shared "current user" that the last registration overwrote. So the token is not what
identifies the caller.

**Classification:** OWASP API2, Broken Authentication, with cross-account data exposure as the
consequence. Not a rate-limiting artefact — the responses are `200 OK` with well-formed bodies.

⚠️ Two of the twelve requests in a wider run returned `503` with an HTML body. That is a separate,
milder observation: the target does not stay within its own content type under load.

### 🔑 Why this one matters beyond the target

The suite did not look like it had found a defect. It looked **flaky** — roughly one contract run
in two, always one of two tests, green again on a rerun, green at `--workers=1`.

> A test that fails intermittently is not automatically an unstable test. It can be a stable test
> of an unstable system.

Running in parallel is not only a way to go faster here — **it is a different test**, and it is the
only configuration in which this defect exists at all.

## 🔴 Four defects of `realworld.habsida.net` — the gate target

Found on 24 August 2026 by running the suite the chain had produced against the new target. Each
one is a contract violation, each has a test that is **red in `tests/contract/` right now**, and
none of them is our code being wrong.

✅ **These four have been moved out of the gate.** Named deployments exist now — `api/deployments.ts`
and the `deployment` fixture — so each of the four names `conduit-gate` explicitly and lives in
`tests/defects/` with an `issue` annotation. Two of them were **split** rather than moved, because
each mixed a conforming half with a violated one:

| Defect | Conforming half, green in `contract` | Violated half, red in `defects` |
|---|---|---|
| D-6 | C-006's six read paths, answered 404 | the two delete paths, answered 204 |
| D-9 | C-003's twelve endpoints sent a valid payload, answered 401 | the four sent `{}`, answered 422 |

D-7 and D-8 are single-assertion tests and moved whole. Nothing was weakened to make the move:
`ArticlesResponseSchema` is untouched, and both halves of each split assert exactly what the one
test asserted before. `contract` is green.

### D-6 · Deleting something that does not exist answers 204

```
DELETE /articles/no-such-slug                 → 204
DELETE /articles/:slug/comments/999999        → 204
```

The specification states 404 "when a resource can't be found to fulfill the request". This answers
as though it had deleted something.

📌 **The shape of it argues it is deliberate** — every read path returns 404 correctly, and only
the two delete paths differ, which looks like an idempotent-delete choice rather than an oversight.
It is still a spec violation, and it is the kind that will not be fixed by asking.

✅ That shape is also why C-006 was split rather than moved: the six read paths stayed in
`tests/contract/not-found.spec.ts`, green, and only the two deletes went to
`tests/defects/not-found.spec.ts`.

### D-7 · Blank input crashes validation instead of failing it

```
POST /users {"user":{"username":"","email":"","password":""}}
  → 500 {"errors":{"body":["Internal server error"]}}
```

The specification: "If a request fails any validations, expect a 422." Empty strings are a
validation failure, not a server fault. Reproduced outside Playwright.

### D-8 · List responses still carry the article body

`GET /articles` returns items including `body`. The specification removed it from list responses on
16 August 2024, for performance, and says so in a dated notice.

⛔ **`ArticlesResponseSchema` is right and must not be relaxed.** Loosening it would turn the test
green and delete the only thing that notices the stale serializer — the exact failure this
repository is built to avoid.

### D-9 · Validation runs before authentication

An anonymous caller sending an empty body to `PUT /user`, `POST /articles`,
`PUT /articles/:slug` or `POST /articles/:slug/comments` is answered **422**, not 401. With a valid
payload the same endpoints answer 401 correctly.

🔑 **So the order is wrong, not the guard.** The consequence is not cosmetic: the API tells a
caller it has not authenticated what its request body should look like.

✅ The test that caught this sent `{}` on purpose and therefore conflated "is the guard attached"
with "does the guard run first". It has been split, and the split turned one muddled red into one
green and one precise red: `tests/contract/authentication.spec.ts` sends each of the twelve
endpoints a payload that passes validation and gets 401 from all of them, and
`tests/defects/authentication.spec.ts` sends the four an empty body and gets 422. The defects half
runs both payloads, so the evidence for the ordering claim is inside the one test.

## Two observations on the gate target that no test catches

Neither fails anything today. Both are worth knowing before anyone trusts this deployment further.

**The error body leaks the database.** A duplicate registration answers:

```json
{"errors":{"body":["SQLiteError: UNIQUE constraint failed: users.email"]}}
```

Exception class, engine, table and column, to an anonymous caller. It conforms to the error
*shape*, so `ErrorsSchema` passes and nothing complains. Security-adjacent, and invisible to a
schema check by construction.

**The token is a real JWT here**, `eyJhbGciOiJIUzI1NiJ9.…`, where `api.realworld.show` returns an
opaque `token_<hex>`.

➡️ This is a second, better reason for the rule against asserting the token's shape: such an
assertion would **pass on this deployment and fail on the other**, which is the most expensive kind
of wrong — it looks correct until the target changes.

## ✅ The same class of mistake, now cleared from the suite

Twelve assertions took a deployment's success status for the contract. The specification states
**no success status for any endpoint** — it says only what each one returns.

- Six were corrected on 24 August, exposed when the gate moved and the two deployments disagreed
  about registration: 200 against 201.
- The remaining six were corrected on 25 August, before any deployment disagreed about them.

📌 **The last six were the interesting ones.** All three live deployments currently agree that
creating an article is 201 and that login is 200 — so nothing was failing, and nothing would have
failed until some future target chose differently. They were fixed because the assertion was
wrong, not because it was red.

⚠️ **Two of them said `on this target` out loud in their own message** and were still written that
way. That phrase no longer appears anywhere in `tests/`, and it is worth keeping as a search term:
it is what this mistake sounds like when it is being made.

Each replacement names the specification's silence in its assertion message, so a reader sees the
gap rather than guessing at the looseness. Every one was broken deliberately and watched go red
before being accepted.

## ⚠️ What this means for the tests

The plan's canonical example — "registering with a taken email returns 422" — is **false against
this target**. It moved to `tests/defects/`, where tests assert the **specification** and stay
red until the target is fixed. Each one carries a link to a filed issue.

⛔ **What not to do:** rewrite the expectation to `201`. That turns the test into a photograph of
current behaviour and permanently removes any chance of noticing a fix.

⛔ **And not `test.fail()` either.** It asserts only "this test must fail" and **does not
distinguish why**: if the target goes down, or the error format changes, the test still "fails
successfully" and tells us nothing.

## Consequence for how the contract suite runs

Because of D-4, the `contract` project runs with **one worker**. This is not a workaround hiding a
defect: D-4 has its own test in `tests/defects/`, which reproduces it deliberately and in parallel.

🔑 The two suites answer two different questions, and mixing them helps nobody:

- `contract` asks **is our code and are our schemas still right** — it must not fail because of
  somebody else's server, or it stops being a gate.
- `defects` asks **is the target still broken** — and needs the concurrency that makes D-4 appear.

⚠️ Restoring parallelism in `contract` is the correct move the day D-4 is fixed, and the defects
test is what will tell us that day has come.
