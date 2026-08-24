# Conduit API — automation report

Produced by the `ta` agent from [`pipeline/02-cases.md`](02-cases.md) and `CONVENTIONS.md`, and
from nothing else. Neither `spec/conduit-api.md` nor `spec/FINDINGS.md` was opened: a case that
could not be read on its own terms is a refusal here, not a lookup somewhere else.

This is a **partial batch**. Fifteen of the forty-five cases are implemented, two are refused as
unautomatable, one is uncertain, and the remaining twenty-seven were not opened. Every case
identifier appears in exactly one of the four sections below; `tests/unit/artifacts.spec.ts`
enforces that, because silence about a case is the one outcome this report may not have.

Statuses were verified against the target at `https://api.realworld.show/api` on 24 August 2026.

## Automated

| Case | File | What would make the test red |
|---|---|---|
| C-003 | tests/contract/authentication.spec.ts | the guard leaves one of the twelve endpoints, or answers 403, 404 or 200 |
| C-004 | tests/contract/authentication.spec.ts | the guard finds a value in the header and never verifies it |
| C-005 | tests/contract/authentication.spec.ts | the guard reaches an open endpoint, or an envelope key disappears |
| C-006 | tests/contract/not-found.spec.ts | a lookup invents a row, or "not found" stops mapping to 404 — **red in a full run**, see `## Triage` |
| C-009 | tests/contract/registration.spec.ts | a User field is dropped, added or renamed, or a fresh bio arrives as `""` |
| C-010 | tests/contract/registration.spec.ts | a presence validator is dropped, or a 422 stops being an `errors` body |
| C-011 | tests/contract/registration.spec.ts | a taken email or username is accepted — **red now**, see `## Triage` |
| C-012 | tests/contract/registration.spec.ts | an issued token resolves to another account, or to none |
| C-013 | tests/contract/login.spec.ts | login answers without a User, or with an account the email does not own |
| C-014 | tests/contract/login.spec.ts | login stops insisting on its own two required fields |
| C-016 | tests/contract/current-user.spec.ts | the update ignores the payload, loses it, or blanks a field it never got |
| C-032 | tests/contract/articles.spec.ts | the returned slug stops addressing the article, or `body` leaves the shape |
| C-034 | tests/contract/articles.spec.ts | tags are lost, the author comes from the payload, or a new article is favorited |
| C-035 | tests/contract/articles.spec.ts | one of the article model's three presence validators is dropped |
| C-044 | tests/contract/tags.spec.ts | `tags` becomes an array of objects, or a second key appears beside it |

Fifteen cases, fifteen tests, seven files. Every test carries its identifier in its name and a
one-line statement of its redness directly above it. Three of them — the registration shape, the
404 sweep and the tag list — were deliberately broken and observed red before being restored, so
none of the three is an assumption.

## Refused

| Case | Reason |
|---|---|
| C-001 | the case reads a **response header**, and the client returns `{ status, body }` and nothing else |
| C-002 | the case sends **OPTIONS** with two request headers and reads two response headers |

Both refusals are the same wall seen twice. `CONVENTIONS.md` makes `ConduitClient` the only way
to reach the target — "do not build your own HTTP client, and do not call `request` directly" —
and that client exposes four verbs, none of them `OPTIONS`, no way to set a header on a single
request, and no access to the response headers at all. Neither case can be written without
either widening the client or going around it, and going around it is forbidden. They are not bad
cases: they are cases the transport this repository standardised on cannot express. Widening the
client is a decision for a person, not something to smuggle in under a test.

## Uncertain

| Case | File | Why it is uncertain |
|---|---|---|
| C-036 | — | the redness of its `updatedAt` half cannot be stated in one line |

The case asks that `article.updatedAt` be "later than the value recorded before the request". The
cases file records under its own open questions that no rule states a timestamp resolution. So a
red would mean either that the update stopped touching the field — the thing worth knowing — or
that the target's clock is coarser than the round trip, which is not a defect of anything. That
is two sentences where the requirement is one. The other three rules the case carries are
writable on their own; splitting it is the QA agent's decision and not this agent's, so the whole
case is parked here rather than half-implemented.

## Not attempted

None of these was opened beyond reading the case. They are out of this batch, not out of reach.

| Case | Why it was out of this batch |
|---|---|
| C-007 | the article ownership guard needs two accounts; this batch stopped at one |
| C-008 | the comment ownership guard, the same shape and the same reason |
| C-015 | writable as it stands; the login file was capped at two cases |
| C-017 | the password path leaves the update endpoint and was left for the update batch |
| C-018 | uniqueness on update; only the create side was carried here |
| C-019 | the profile endpoint was reached only as another test's positive control |
| C-020 | reader-relative fields need an anonymous read of created data; out of this slice |
| C-021 | the follow endpoints were outside the slice implemented here |
| C-022 | the unfollow handler, the same reason |
| C-023 | the list serializer was left for a list batch |
| C-024 | list ordering, the same batch |
| C-025 | the three list filters, the same batch |
| C-026 | the completeness half of the favorited filter, the same batch |
| C-027 | limit and offset, the same batch |
| C-028 | the timestamp format is one assertion across two endpoints; not reached |
| C-029 | the feed needs a follow relation, which this batch never established |
| C-030 | the feed's completeness half, the same reason |
| C-031 | feed ordering and paging, the same reason |
| C-033 | slug collision; the create work here stopped at the happy path and validation |
| C-037 | the slug moving with the title; part of the update batch |
| C-038 | deletion; part of the update batch |
| C-039 | comments were not reached |
| C-040 | the comment validator, the same reason |
| C-041 | the comment list around its writes, the same reason |
| C-042 | favoriting was not reached |
| C-043 | unfavoriting, the same reason |
| C-045 | the write side of tags was not reached |

## Triage

Three reds were seen across the full runs. Each is in exactly one bucket, and none of them is a
defect of a test or a misread case.

**C-011 — a defect of the target.** `POST /api/users` with an email another account already holds
is answered **201**, and so is a registration with a username another account already holds. The
response carries a working token, so two accounts end up sharing an address. The assertion is
right and the API is wrong, so **the test stays red and the assertion stays at 422**. It belongs
in `tests/defects/` with an `issue` annotation, and it is not there for one reason only:
`CONVENTIONS.md` requires that annotation to name a `D-#` entry in `spec/FINDINGS.md`, and
`spec/` is not the TA agent's to write. Filing that entry and then moving the test is the next
action for a person.

**C-003's positive control — a defect of the target, worked around in the test's ordering.** The
twelve anonymous requests the case asks for were answered 401 every time. The control that proves
the address and the token — the same `GET /api/user` with a real credential — was answered
`401 {"errors":{"token":["is missing"]}}` when it ran *after* them. It is not the token: the same
token is accepted before the run, and it is accepted throughout a run in which authenticated and
anonymous requests alternate. **A run of roughly twelve consecutive requests without a credential
leaves the next authenticated request unauthenticated**, and a longer burst gets
`503 Service Temporarily Unavailable` from the target's nginx. The control now runs first, which
proves exactly what it proved before; the case's own twelve assertions are untouched, and the
reason is written above the test as well as here. This deserves its own defects test and its own
`D-#`, and both are outside this agent's files. It may share a root cause with the 503s below —
the body here is the API's JSON and not nginx's page, and an alternating run of twenty-eight
requests never reproduced it, so the two were recorded separately rather than merged on a guess.

**C-006 — a defect of the target, and one that only the whole suite can see.** The eight lookups
are answered 404 every time when the test runs alone. Inside a full suite run two or three of them
come back **503**, and the body is nginx's `503 Service Temporarily Unavailable` page rather than
anything the API wrote. That split is reproducible in both directions — green alone, red in the
suite, across seven full runs and a four-minute pause between two of them, so it is a burst limit
and not a window that drains. Only *which* of the eight is hit moves from run to run. The suite
makes roughly a hundred and twenty requests in eight seconds and this deployment will not serve
them: the target is rate-limited well below what a contract suite of forty-five cases will ask of
it. This test is simply the longest sequence of authenticated requests in the run, so it is where
the limit lands; it is not about not-found handling at all. There is no honest fix inside the
test — `CONVENTIONS.md` forbids sleeps, and lowering the assertion to "404 or 503" would be a
photograph of the limit. The decision belongs to a person: run the suite against a local Conduit,
or accept the retry that `playwright.config.ts` already grants in CI. It is recorded here rather
than worked around.

None of the three is a defect of a test, and none is a misread case.

## Feedback

**No artifact in the chain ever fixes a success status, and `CONVENTIONS.md` demands one.** The
cases file records this as its own open question — "no status assertion can be written until the
rules make the choice" — while `CONVENTIONS.md` says to "assert the **exact** status the target
returns, not a range". The two instructions cannot both be followed from the artifacts alone, so
every success status in these fifteen tests was taken by probing the target: **201** for
`POST /api/users` and `POST /api/articles`, **200** for every `GET`, for `PUT /api/user` and for
`POST /api/users/login`. That is a hole in the chain rather than a judgement call: a rule should
name the success status of each write, and then a case can carry it.

**A case has nowhere to put the positive control a negative test needs.** `CONVENTIONS.md`: "a
negative test does not validate itself… pair it with a positive assertion that proves the
address, the auth and the setup are right." The case format has `Steps` and `Expected` and no
third field, so every guard case in the file lists only the requests that must fail. The control
was added to each of them by this agent and is documented in the test. If the case format grew a
`Control` field, that decision would sit with the QA agent, where the rest of the case design
already sits.

**Two cases name a transport this repository does not have.** The first asks for a response
header and the second for an `OPTIONS` request carrying CORS headers. The QA agent is told not to
name fixtures, files, matchers or helper names, so it had no way to know what the client can
reach — and the result is two cases that are correct and unbuildable. Either the client grows
those capabilities, or the constraint becomes visible one link earlier.

**Observations about the target that no case in this batch catches.** They are recorded here
because they decide whether the unwritten cases can ever go green, and because they belong in
`spec/FINDINGS.md`, which this agent may not write:

- An article created through `POST /api/articles` is answered 201 with a slug, and is then
  **invisible to every anonymous reader**: `GET /api/articles/:slug` answers 404, and the article
  appears in neither `GET /api/articles`, nor `?author=`, nor `?tag=`. It is readable with its
  author's token. The list served to everyone is a fixed set of four seeded articles.
- A tag introduced by a new article never appears in `GET /api/tags`.
- `GET /api/profiles/:username` for a freshly registered account answers **404** anonymously and
  **200** with that account's own token.
- `PUT /api/articles/:slug` of a freshly created article answers **404** to its own author, while
  `GET` of the same slug with the same token answers 200.
- Two registrations in a row were observed returning the **same token value** for two different
  accounts.

Every case in the file that expects created data to be readable by anybody else — the list
serializer, the ordering, the three filters, the feed, the write side of tags — will be red
against this deployment for that reason, and that red will be the target's.

**No case in this batch turned out to be wrong.** Two are unbuildable here, one cannot have its
redness stated in a sentence, and the other forty-two read exactly as written. The expectation
that a taken email is refused is right; it is the API that disagrees with it.
