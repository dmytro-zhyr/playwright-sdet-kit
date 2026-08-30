# Conduit reconnaissance — 23 August 2026

Everything below was **verified with requests**, not taken from the specification. Where the
target diverges from the [specification](conduit-api.md), the divergence is written down
separately and **the specification stays authoritative**.

## Two targets, on purpose

| Suite | Default target | Why |
|---|---|---|
| `contract`, `unit` | **`conduit-gate`**, `https://realworld.habsida.net/api` | conforms; this is the gate |
| `defects` | **`conduit-unsound`**, `https://api.realworld.show/api` | the deployment D-1 to D-5 are about |

📌 **Those are project defaults, not what a defects test is about.** Since D-6 to D-11 there are
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

✅ **Covered by `tests/defects/registration.spec.ts` — refined on 26 August 2026 while writing the
test.** Login turned out to be an unreliable witness: across ten independent trials through the
actual test harness, `POST /users/login` with the duplicated email always correctly told the two
accounts apart by password — it is not what breaks. What reproduces reliably (9 of 10 trials) is
the *registration response* itself: the second registration is handed the **first account's own
token**, so reading a profile back through that original token — no password needed — returns the
duplicate's data instead of the original's. Same loss of access this section describes, a more
reproducible route to observing it. The test samples six independent registration pairs — each an
ordinary, sequential pair of requests — and fails if even one shows the hijack; see
`COLLISION_TRIALS`'s own comment for the measured rate and why sampling several beats one attempt.

📌 **Corrected again, same day, after a fix-round review.** The token-based evidence above turned
out to have the same problem the login-based one did. A control settled it: registering two
**entirely unrelated** accounts — no email collision at all — reproduced the same "read the
original account back through its own token, get someone else's data" symptom **8 times out of
10**. That is D-4's own invariant (`tests/defects/authentication.spec.ts:11`), not something this
collision causes; a test asserting it would go green the day D-4 alone is fixed, with email
uniqueness still unenforced. So the ➡️ line above — "loss of access to an account" — rests on an
attribution neither the login evidence nor the token evidence supports once checked against a
control; it is left standing as the record of what this section originally claimed, not as a
verified consequence. What survives, verified directly and repeatedly, without relying on either
withdrawn mechanism: `POST /users` with an already-taken email answers **201, not 422** — the
uniqueness gap D-3 names below, confirmed on this deployment. That is what
`tests/defects/registration.spec.ts` now asserts, sampling three independent colliding pairs (see
`COLLISION_TRIALS`'s current comment — the sampling reason changed along with the evidence).

⚠️ **A side note on D-4's own claim**, met while building the control above: "run the same
sequence one request at a time and every token resolves correctly" did not hold in ten trials run
today, 26 August 2026, against two entirely unrelated, non-colliding, sequential registrations — 8
of 10 showed the same cross-account read. That is outside this item's scope to resolve (D-4's test
is unchanged by this branch); the annotation lives at D-4's own section below, where a reader of
that section alone will see it, rather than only here.

### D-2 · Registration accepts a username that is already taken

```
POST /users {"user":{"username":"qa_dup_probe","email":"<new>",...}}  →  201
```

And it returns **the same token** the existing `qa_dup_probe` already had. The request did not
create a new user; it returned the existing one with a replaced email.

✅ **Covered by `tests/defects/registration.spec.ts` — refined on 26 August 2026, then again after
a fix-round review.** First refinement: the second registration is handed the existing account's
own token (8 of 10 trials), and reading the existing account back through that token afterwards
shows the duplicate's email in place of the original's — matching "the same token... a replaced
email" above. Second refinement, same day: a control showed this is *also* not specific to the
username collision. Two entirely unrelated registrations, back to back, compared directly by the
token each registration response carried — no collision, no later read involved — shared a token
**9 times out of 10**. So "returns the same token... a replaced email" is very likely the same
generic noise D-1's corrected note above describes, not something this collision specifically
causes; the claim above is left standing as the record of the original observation, not as a
verified consequence. What survives, by the same reasoning as D-1: `POST /users` with an
already-taken username answers **201, not 422**. `tests/defects/registration.spec.ts` asserts
exactly that, by the same `collide` helper D-1 uses above, sampling three independent colliding
pairs.

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

📌 **That last sentence no longer holds as stated.** A control built for D-1 and D-2 on 26 August
2026 ran two entirely unrelated, non-colliding, sequential registrations ten times — no
concurrency, no shared field — and saw the same cross-account read on `GET /user` **8 times out of
10**. Recorded in D-1's section above, where it was found. Not re-measured here as a dedicated
study of this claim; written down because it directly contradicts a sentence in this section, and
a reader who opens D-4 alone deserves to see that before trusting it.

⬜ **Open question, not acted on.** If sequential registrations cross-talk nearly as often as
concurrent ones, D-4 may not be about concurrency specifically — it may be shared session state
that concurrency merely makes easier to hit, which is a different claim than "invisible to
sequential testing" two paragraphs up. This section's test, eight parallel registrations, is built
on the premise the note above just contradicted. Worth investigating on its own terms; not done as
part of this branch.

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

## 🔴 Six defects of `realworld.habsida.net` — the gate target

Found on 24 August 2026 by running the suite the chain had produced against the new target. Each
one is a contract violation, and each had a test that was **red in `tests/contract/` at the
time** — none of them is our code being wrong.

✅ **These six have been moved out of the gate.** Named deployments exist now — `api/deployments.ts`
and the `deployment` fixture — so each of the six names `conduit-gate` explicitly and lives in
`tests/defects/` with an `issue` annotation. Four of them were **split** rather than moved, because
each mixed a conforming half with a violated one:

| Defect | Conforming half, green in `contract` | Violated half, red in `defects` |
|---|---|---|
| D-6 | C-014's three paths and C-015's five, all answering 404 | the two deletes, answered 204 |
| D-9 | C-002's twelve endpoints sent a valid payload, answered 401 | the four sent `{}`, answered 422 |
| D-10 | C-015's five paths, all answering 404 | the comment-create path, answered 422 |
| D-11 | the echoed username and email | `bio` answered `""` where `image` answers `null` |

D-7 and D-8 are single-assertion tests and moved whole. Nothing was weakened to make the move:
`ArticlesResponseSchema` is untouched, and both halves of each split assert exactly what the one
test asserted before.

📌 **That last sentence used to read "`contract` is green," and it was false when written.**
C-015 and C-029 were still red at the time, for the two reasons filed below as D-10 and D-11 — the
regeneration of `pipeline/02-cases.md` had put a defect back into each. Both are now split the same
way D-6 and D-9 were, and `contract` is green, with the one qualification the whole suite carries:
the target rate-limits under load, which is a separate, infrastructure-level observation recorded
below and is not any of the six defects.

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

✅ That shape is also why the case was split rather than moved: the read paths stayed in
`tests/contract/not-found.spec.ts`, green, and the two deletes went to
`tests/defects/not-found.spec.ts` — which also holds D-10 now, a different defect of the same case.

📌 **Identifiers corrected on 25 August 2026.** The split was made against the previous generation
of `pipeline/02-cases.md`, where all eight paths were one case, C-006. The regenerated cases divide
them: the article-slug paths are C-015, the profile paths C-014, the comment identifier C-016. And
`C-006` now names something else entirely — "Endpoints with optional authentication serve an
anonymous request" — so writing it here pointed a reader at the wrong case. `spec/` is outside the
reach of the `Case → File` check, which scans `tests/contract/` and `tests/defects/` only, so these
references went stale in silence and were found by reading.

⚠️ **The regeneration also undid half of this split.** C-015 sweeps all seven article-slug paths,
`DELETE /articles/:slug` among them, so the delete this defect is about is back in
`tests/contract/not-found.spec.ts` and that test is red again. `pipeline/03-report.md`'s
`## Triage` states the next action for a person: `POST /articles/:slug/comments` answers 422 on an
unheld slug because the payload validator runs before the lookup, which is a second defect with no
`D-#` entry here yet. File it, then split C-015 the way C-006 was split.

✅ **Corrected on 26 August 2026.** Both of those next actions are done. The comment route is
filed below as D-10, and C-015 has been split again the same way: the five paths that answer 404
stay in `tests/contract/not-found.spec.ts`, green, and the delete and the comment route live in
`tests/defects/not-found.spec.ts` as D-6 and D-10. The paragraph above is left as written — it is
the record of the state between the regeneration and this fix, not a standing instruction.

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

### D-10 · A comment on an unheld slug is validated before it is looked up

```
POST /articles/there-is-no-such-slug-000/comments {"comment":{"body":"..."}}  →  422
```

An authenticated caller, a payload that passes validation, a slug no article holds — and the
answer is 422, not 404. The same request against a slug that does exist is accepted.

🔑 **So this is the same family as D-6, not the same defect as D-9.** D-9 is validation running
ahead of authentication, found on an anonymous caller sending an empty body. Here the caller is
authenticated and the body is valid; what the route skips is the article lookup, exactly like the
two deletes D-6 already names — just answered with a 422 dressed as a validation failure instead
of a 204 dressed as a success.

✅ This was found inside C-015, which the regenerated `pipeline/02-cases.md` had re-swept across
all seven article-slug paths, undoing the split D-6 was already given. It has been split the same
way now: the five paths that do answer 404 stay in `tests/contract/not-found.spec.ts`, green, and
this one moved to `tests/defects/not-found.spec.ts`, where it sends the same valid payload to a
slug that exists — accepted — and then to the unheld slug — 422 — so the evidence that the lookup
was skipped sits inside the one test.

### D-11 · A freshly registered account represents an unset bio and an unset image differently

```
POST /users {"user": {...}}  →  {"user": {..., "bio": "", "image": null}}
```

Registration accepts neither field, and the specification's canonical User example shows both as
`null`. `R-065` in `pipeline/01-rules.md` says exactly that, and its `Kind` is `assumed` — the
honest complaint against an assumed rule is that it is assumed, nothing more.

⚠️ **What raises this from an assumption to a finding is the second field.** `image` comes back
`null`; `bio`, on the same response, comes back `""`. One handler, two fields it cannot set, two
different representations of "not given". The target does not only disagree with the
specification here — it disagrees with itself.

✅ C-029 asserted both fields as `null` in one assertion, which conflated "does registration echo
what it was given" with "does a fresh account represent absence the same way in both fields" — the
first is true here, the second is not. The test has been split: `tests/contract/registration.spec.ts`
keeps the echo assertion, green, and `tests/defects/registration.spec.ts` asserts that `bio` must
be `null`, with `image` on the same response asserted `null` as the control that makes the
contradiction visible.

## ⬜ The gate deployment rate-limits, and CI makes it likelier

Seen on 25 August in the first CI dispatch: `GET /articles` in `tests/defects/schemas.spec.ts`
failed with **429**, not with the documented D-8 mismatch. Both the first attempt and the retry got
429; the next dispatch reproduced the real failure.

**Why CI makes it worse than a local run.** The `defects` job and the `contract` job run
concurrently against the same host, and `retries: 1` in CI doubles the request count when anything
fails. Locally the suites are run one after another.

🔑 **This is the flake-versus-explained-failure question in its natural habitat**, which is exactly
what the nightly schedule exists to collect. A 429 is not D-8, and a report that cannot tell them
apart is the thing to fix — not the test.

⬜ **Not acted on yet.** The options are to serialise the two jobs, to drop `retries` for
`defects`, or to make the assertion name the status it got. Decide with data from a few nightly
runs rather than now.

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

---

# UI reconnaissance — 30 August 2026

Stage 3 adds a browser layer, and it opens with the same step that opened stage 1: look at the
targets before writing a line. Each of the three registered deployments was probed for a
front end, and each front end was read to find which API it actually calls.

| Front end | Status | Calls | Registry name |
|---|---|---|---|
| `https://demo.realworld.show` | 200, Angular | `https://api.realworld.show/api` | `conduit-unsound` |
| `https://conduit.bondaracademy.com` | 200, Angular | `https://conduit-api.bondaracademy.com/api` | `conduit-overstrict` |
| `https://realworld.habsida.net/` | **404** | — | `conduit-gate` |

The pairing was not assumed from the host names. Each page's bundle was fetched and the base URL
read out of it, because "the UI at `x.show` obviously talks to the API at `api.x.show`" is a guess,
and a UI suite silently measuring a different backend than the contract suite is the kind of thing
that would be discovered months later.

## 🔴 The gate has no UI

`realworld.habsida.net` publishes an API and nothing else. The deployment the entire contract suite
is measured against **cannot host a single browser test**.

This is the finding that shaped the code rather than just the notes. Until now a deployment was one
address, so "the UI of `conduit-gate`" would have been a URL nobody checked — and the natural
implementation, appending a path or stripping `/api`, would have returned something. A browser
opening JSON fails on every locator at once, and the report reads as a hundred broken page objects
instead of one wrong target.

➡️ So `api/deployments.ts` now models a deployment as **up to two surfaces**, API and UI, with
`ui: null` a stated fact rather than a gap. `resolveUiDeployment('conduit-gate')` throws and names
the deployments that do have a UI. Same rule as an unknown name: never guess, never fall back.

## Which deployment becomes the UI gate, and why it was not a preference

Two candidates remained, and one disqualifies itself:

- **`conduit-unsound`** carries D-1 to D-5. D-5 alone is fatal for a browser suite — a write is
  invisible to everyone but its author, so *publish an article, then find it in the global feed*
  fails here for a reason that has nothing to do with the page. D-4 adds a token that stops
  identifying its own user under concurrency. Both would be read as flaky UI tests.
- **`conduit-overstrict`** has one known deviation: a username longer than 20 characters is
  rejected. That is what disqualified it as the **API** gate, because a conformance suite must be
  free to send what the specification allows. A browser test never sends it: `data/userFactory.ts`
  emits `qa_` plus 10 characters, 13 in all.

🔑 **The same property decides the two gates in opposite directions.** Over-strict validation is
disqualifying for a suite that asserts the contract and harmless for one that drives a form, so
`conduit-gate` and the UI gate are deliberately **different deployments**. That is only sayable
because deployments are named; with one `baseURL` it would have been a contradiction.

⚠️ **The cost, stated up front:** UI and contract now run against different servers, so a UI test
can never be evidence about the gate's behaviour, and a difference between the two layers may be a
difference between two backends. Any UI test tempted to assert an API-level fact is in the wrong
suite.

📌 `conduit-unsound`'s UI is registered all the same — not to measure against, but because
reproducing a known defect **through a browser** is exactly what `tests/defects/` is for.

## 🔴 The first UI finding was about the test, not the page

The reconnaissance script reported that the sign-up form locks up: after submitting, all three
fields went `[disabled]`, the button stayed `[disabled]`, no error appeared, and the page never
left `/register`. That reads exactly like a defect.

It is not one. A second probe watching the network showed `POST /api/users` answering **201**,
followed by a clean redirect to `/`. The first script had taken its snapshot after
`waitForLoadState('networkidle')`, which in a single-page app settles while the form is still in
its submitting state, before the router moves.

🔑 **The oracle was wrong, and it was wrong in the direction that invents defects.** The usual
version of this repository's theme is a green test that proves nothing; this is its mirror — a red
observation that reports nothing. Both come from the same cause: an assertion evaluated at a moment
nobody chose deliberately.

➡️ So `po/registerPage.ts` waits for the **response**, not for the network to go quiet. A response
happens once, carries a status, and cannot be satisfied early by a lull. `networkidle` answers a
question about the wire and is used as if it answered a question about the application.

## What the UI gate actually renders

Observed on conduit-overstrict, 30 August 2026. Recorded because page objects were written against
this rather than against the canonical RealWorld template, which several deployments have drifted
from.

| Surface | What is there |
|---|---|
| Header, signed out | links `conduit`, `Home`, `Sign in`, `Sign up` |
| Header, signed in | `Home`, ` New Article`, ` Settings`, and a link **named for the username** to `/profile/<username>` |
| `/register` | heading `Sign up`; textboxes `Username`, `Email`, `Password`; button `Sign up` |
| `/login` | heading `Sign in`; textboxes `Email`, `Password`; button `Sign in` |
| `/editor` | `Article Title`, `What's this article about?`, `Write your article (in markdown)`, `Enter tags`, button `Publish Article` |
| `/settings` | `URL of profile picture`, `Username`, `Short bio about you`, `Email`, `New Password`, button `Update Settings` |
| Errors | `ul.error-messages` with one `<li>` per message, e.g. `email has already been taken` |

⚠️ **`New Article` and `Settings` carry a leading space** in their accessible names — an icon
element sits inside the link before the text. `exact: true` on those two would never match.

⚠️ **`/editor` and `/settings` redirect to `/` for an anonymous visitor.** There is an auth guard,
so a test that forgets to sign in fails on a missing form rather than on a redirect it can name.

⚠️ **The feed tabs are plain list items, not links or tabs.** `Your Feed` and `Global Feed` carry
no interactive role, so `getByRole('tab')` finds nothing and a role-first locator strategy has to
make an exception here.

### 🔑 The submit button is gated on presence, not on validity

Both forms disable their submit button until every field has something in it. Filling the email
with `not-an-email` leaves the button **enabled**.

That is worth a test of its own, and the test is not a bug report: it records what the application
does, so that a later test does not assert client-side email validation that was never implemented.
An expectation invented from what a form ought to do is the same failure as a locator invented from
what markup ought to be.

## ⚠️ What `npx playwright init-agents` brought in, and what was done with it

Playwright's own agent tooling was installed on 30 August 2026: `init-skills` added three skills
under `.claude/skills/`, and `init-agents` added a planner, a generator and a healer under
`.claude/agents/`, alongside the four written for this repository. Three things came with it that
could not be kept as delivered.

**1. It wrote a seed test into the gate suite.** `tests/contract/seed.spec.ts` was a `test('seed')`
with an empty body and the comment `// generate code here.` — a test that cannot fail, inside the
suite whose pass rate is the gate. It was deleted. `tests/ui/registration.spec.ts` is the seed now:
a generator learns the fixtures and conventions better from a real test than from an empty one.

**2. It created `specs/`, one letter away from this repository's `spec/`.** Two directories whose
names differ by a trailing `s`, holding different things, is a trap that costs a reader every time.
The new one was renamed `plans/`, which is what it holds, and the three vendored agent definitions
were edited to match — the one place a vendored file was modified, and this is the record of it.

**3. It wrote `.mcp.json`.** The agents it installed address the browser through MCP tools, while
`applications/ai-tooling.md` in the job-search repository argues for the CLI over MCP on token
efficiency. Both are kept, because they are not in competition: the skills under `.claude/skills/`
drive the CLI, and the agents need the MCP server. The position that survives is narrower than "CLI
over MCP" — **MCP for an agent that must look at a page, the CLI for work that must not spend the
context window on tool schemas.**

⬜ **Open, and worth fixing:** `tests/unit/artifacts.spec.ts` validates agent definitions by name —
`ba.md`, `qa.md`, `ta.md`, `critic.md` — so the three that arrived today are unchecked, and so
would be a fifth written here tomorrow. The check is anchored to a list of answers instead of to
the directory that produces them, which is the same failure this repository has now found twice.
Enumerating `.claude/agents/*.md` needs a stated rule for vendored definitions first: they do not
carry the `## Your task` / `## Forbidden` sections this project requires, and reshaping somebody
else's agent to pass our validator would be the wrong fix.

---

# Salesforce reconnaissance — 25 August 2026

A Developer Edition org, probed before a single test was written, the same way Conduit was.
Credentials were never printed; only shapes and behaviour.

**Flow:** OAuth 2.0 client credentials, through an External Client App. Verified working.

⚠️ **The fast path was closed by the org itself.** `conn.login(username, password + securityToken)`
answered `INVALID_OPERATION: SOAP API login() is disabled by default in this org`. It works on
older orgs — the pattern used on a real project — but Salesforce disables it for new ones.

## What the org actually does

| | |
|---|---|
| Daily API limit | 14 960 of 15 000 remaining — a suite of this size will not notice it |
| `Account` | 70 fields; **exactly one is required on create: `Name`** |
| Teardown | create → read → SOQL → **delete, and it is really gone** (`NOT_FOUND` afterwards) |
| Dates | `2026-08-24T21:26:29.000+0000` — **not** the `...Z` form Conduit returns |
| Default API version in jsforce | `50.0` — older than the org supports; worth pinning deliberately |

**Errors carry codes, and different ones:** `NOT_FOUND`, `REQUIRED_FIELD_MISSING`, `INVALID_FIELD`.

🔑 That is a real improvement over Conduit, where everything collapsed into
`{"errors":{"body":[...]}}`. Here a test can assert a **specific `errorCode`** instead of "something
went wrong".

## 🔴 The finding that mattered

```
Unable to refresh session due to: No refresh token found in the connection
```

**jsforce does not recover a dead session on the client credentials flow.** The refresh delegate is
registered, but it has nothing to refresh with — and Salesforce's own documentation states it
plainly: *"This flow doesn't support refresh tokens."*

⚠️ **We were one sentence away from recording the opposite.** On the username-password flow
`conn.login()` installs a delegate that re-logins transparently — true, verified in the jsforce
source, and **false for the flow we chose**. Recovery here means calling `authorize()` again.

📌 It costs nothing for a suite that runs for minutes. It is the difference between using a library
and knowing what it does.

## Security note from the Salesforce documentation

> Any person or app that has access to your external client app's consumer key and consumer secret
> can get an access token.

➡️ Those two values are the only thing protecting the org, which is why they live in `.env` and in
CI secrets, and never in the repository.

## ⬜ Not yet decided

- The `defects`-style question: is a Salesforce suite part of the gate, or skipped without
  credentials? The plan is **skip when the variables are absent, fail when they are present and
  wrong** — never a silent skip on a bad credential.
- Move to `@jsforce/jsforce-node`, the Node-only build, when the real suite is written.
