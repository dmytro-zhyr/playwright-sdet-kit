# Conduit reconnaissance — 23 August 2026

Everything below was **verified with requests**, not taken from the specification. Where the
target diverges from the [specification](conduit-api.md), the divergence is written down
separately and **the specification stays authoritative**.

**Base URL:** `https://api.realworld.show/api`

Two alternatives were probed and both are dead: `conduit.productionready.io` → 307,
`api.realworld.io` → 530.

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

## 🔴 Three defects of the target, found by reconnaissance

All three violate what the specification implies. They are recorded here, **not "fixed" by
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
