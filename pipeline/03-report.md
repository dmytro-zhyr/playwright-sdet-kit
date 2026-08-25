# Conduit API — automation report

Produced by the `ta` agent from [`pipeline/02-cases.md`](02-cases.md) and `CONVENTIONS.md`, and
from nothing else. Neither `spec/conduit-api.md` nor `spec/FINDINGS.md` was opened: a case that
could not be read on its own terms is a refusal here, not a lookup somewhere else.

This is a **partial batch**. Eighteen of the eighty-five cases are implemented, three are refused
as unautomatable, one is uncertain, and the remaining sixty-three were not opened. Every case
identifier appears in exactly one of the four sections below; `tests/unit/artifacts.spec.ts`
enforces that, because silence about a case is the one outcome this report may not have.

The target is `conduit-gate` — `https://realworld.habsida.net/api`. Statuses that no artifact in
the chain fixes were taken from it by probing, on 25 August 2026; every one of them is listed
under `## Feedback`.

**Counts.** Implemented 18 · refused 3 · uncertain 1 · not attempted 63. Thirty tests now live in
`tests/contract/` — the eighteen case-derived ones below, plus twelve of the framework's own,
which carry no identifier and were left exactly as they were. **Final run: 28 passed, 2 failed.**

**ESLint problems in the first run after the tests were written, before anything was fixed: 0.**
`npx tsc --noEmit` was clean on the same first run. `npx prettier --check .` flagged two files,
which `prettier --write` fixed; nothing else was changed to satisfy a gate.

## Automated

| Case | File | What would make the test red |
|---|---|---|
| C-001 | tests/contract/authentication.spec.ts | a login token and a registration token stop being the same artefact, or either stops resolving to its own account |
| C-002 | tests/contract/authentication.spec.ts | the guard leaves one of the twelve endpoints, or one of them writes before refusing |
| C-004 | tests/contract/authentication.spec.ts | every token resolves to one stored account, so the two reads describe the same one |
| C-005 | tests/contract/authentication.spec.ts | the guard reaches an endpoint that needs none, or an envelope key disappears |
| C-014 | tests/contract/not-found.spec.ts | a username lookup invents an account, or a route stops consulting it |
| C-015 | tests/contract/not-found.spec.ts | a route runs its handler on an article that does not exist — **red now**, see `## Triage` |
| C-025 | tests/contract/tags.spec.ts | `tags` becomes an array of objects, or a second key appears beside it |
| C-026 | tests/contract/login.spec.ts | login answers without a User, or with an account the email does not own |
| C-027 | tests/contract/login.spec.ts | login stops insisting on its own two required fields |
| C-029 | tests/contract/registration.spec.ts | the echoed username or email is not the one sent, or a fresh account is not empty — **red now**, see `## Triage` |
| C-030 | tests/contract/registration.spec.ts | a presence validator is dropped, or a refused request consumes the name it was sent |
| C-031 | tests/contract/registration.spec.ts | a taken email or username is accepted, or the refusal carries no message |
| C-032 | tests/contract/registration.spec.ts | the password is stored in a form the login comparison cannot reproduce |
| C-036 | tests/contract/current-user.spec.ts | the update renders a merged document and never commits it |
| C-060 | tests/contract/articles.spec.ts | the author comes from the payload instead of from the token |
| C-061 | tests/contract/articles.spec.ts | the returned slug stops addressing the article, or the stored values are not the sent ones |
| C-062 | tests/contract/articles.spec.ts | one of the three presence validators is dropped, or a refusal still creates an article |
| C-072 | tests/contract/articles.spec.ts | a delete answers success while removing nothing, or a removed slug keeps resolving |

Eighteen cases, eighteen tests, seven files. Every test carries its identifier in its name and a
one-line statement of its redness directly above it. Every negative is paired with a positive
that differs in one variable: the guard sweep opens with the same read under a real token, the two
not-found sweeps close with the same verbs against identifiers that do resolve, and each validator
sweep closes with the complete request being accepted.

Four of the eighteen assert something a status cannot show, because their expectation has a second
half: the guard sweep reads the article, the comment list, the account, the profile and the
author's own listing back afterwards to prove that nothing the twelve refusals addressed was
changed; the registration validator re-sends the very account its three refusals were built from,
so a name quietly consumed by a refused request would show up; the article validator reads the
author's listing to prove no article was created; and the delete reads the slug on both sides of
the deletion.

## Refused

| Case | Reason |
|---|---|
| C-003 | two of its three credentials cannot be built: `ConduitClient` sends only the `Token` scheme, and an empty token value produces no header at all rather than an empty one |
| C-009 | the case reads a **`Content-Type` response header**, and the client returns `{ status, body }` and nothing else |
| C-085 | the case sends **`OPTIONS`** with an `Origin` request header and reads two response headers; the client has four verbs, none of them `OPTIONS`, no per-request headers and no access to response headers |

All three refusals are one wall seen from three sides. `CONVENTIONS.md` makes `ConduitClient` the
only way to reach the target — "do not build your own HTTP client, and do not call `request`
directly" — and that client exposes `get`, `post`, `put`, `del` and `withToken`, and returns a
status and a body. A scheme other than `Token`, a header set on one request, a verb outside the
four, and any response header are all outside it.

The first refusal is the one worth arguing about, because a third of it *is* reachable: a token
the API never issued can be sent, and it is refused with 401. But the case is one unit of failure
— "a credential that is present but unusable" — and implementing the third of it that the client
can express, under the case's identifier, would report the case as covered while two of its three
branches were never exercised. That is the quiet amendment this agent is told not to make. The
honest outcome is a refusal naming exactly what is missing, so that either the client grows a way
to set an `Authorization` header verbatim, or the case is split one link earlier.

None of the three is a bad case. They are cases the transport this repository standardised on
cannot express, and widening that transport is a decision for a person.

## Uncertain

| Case | File | Why it is uncertain |
|---|---|---|
| C-071 | — | its `updatedAt` half has no statable redness: no artifact fixes a timestamp resolution, and the target's is whole seconds |

The case asks that `updatedAt` be "later than the one recorded before". The target serialises
timestamps to whole seconds — `2026-08-24T23:03:36.000Z` — and an update issued inside the same
second as the read that preceded it returns an equal value. So a red would mean either that the
update stopped touching the field, which is the thing worth knowing, or that the round trip was
faster than the clock, which is a defect of nothing. That is two sentences where the requirement
is one, and `CONVENTIONS.md` says a test whose redness cannot be stated in one line is not to be
written. The `createdAt` half is statable on its own; splitting the case is the QA agent's
decision and not this agent's, so the whole case is parked here rather than half-implemented.

## Not attempted

None of these was opened beyond reading the case. They are out of this batch, not out of reach,
and none of them is a refusal.

| Case | Why it was out of this batch |
|---|---|
| C-006 | the optional-authentication routes were reached only as another test's positive control |
| C-007 | its `following` values need a follow relationship, which this batch never established |
| C-008 | the anonymous reading of the same fields, and the same missing relationship |
| C-010 | the shape of a validation failure across the whole renderer; the validators here assert their own |
| C-011 | the failure-body leak check; left for a batch about failure bodies |
| C-012 | the ownership guard needs a second account holding a token; out of this slice |
| C-013 | the resource read that follows the refused mutation, and the same missing second account |
| C-016 | the comment lookup; comments were reached here only as a precondition |
| C-017 | the three empty-collection readings; left for the list batch |
| C-018 | the user serializer swept across four endpoints; left for a serializer batch |
| C-019 | the password-leak check across the same four; the same batch |
| C-020 | the profile serializer over three routes, two of which are the follow endpoints |
| C-021 | the ten-field single-article sweep; the strict schema carries part of it already, the field-by-field reading did not fit |
| C-022 | the list serializer; the target still ships `body` in list entries, which already has a test of its own in `tests/defects/`, and a second red saying the same thing would add nothing |
| C-023 | the same field, from the other side, and the same existing red |
| C-024 | the comment serializer and its two envelopes; the write side of comments was not reached |
| C-028 | the credential check behind login; the login file was capped at two cases |
| C-033 | the current-user read; the update batch carried one case only |
| C-034 | the completeness half of the update merge |
| C-035 | the soundness half of the same merge |
| C-037 | the password change; out of this slice |
| C-038 | the retired password, and the same reason |
| C-039 | the username move to the profile address; out of this slice |
| C-040 | uniqueness on the update path; only the create side was carried here |
| C-041 | the profile read was reached only as another test's positive control |
| C-042 | the follow endpoints were outside the slice implemented here |
| C-043 | the unfollow handler, the same reason |
| C-044 | the follow store read back through a third endpoint, the same reason |
| C-045 | the direction of the relationship, the same reason |
| C-046 | the unfiltered list; left for a list batch |
| C-047 | ordering across two endpoints, the same batch |
| C-048 | the tag filter's soundness half, the same batch |
| C-049 | its completeness half, the same batch |
| C-050 | the author filter's soundness half; the filter was used here only as a control |
| C-051 | its completeness half, the same batch |
| C-052 | the favorited filter's soundness half, the same batch |
| C-053 | its completeness half, the same batch |
| C-054 | the removal path behind the same filter, the same batch |
| C-055 | pagination, and its precondition of more than twenty articles was not established |
| C-056 | the feed needs a follow relationship, which this batch never established |
| C-057 | the feed's soundness half, the same reason |
| C-058 | the feed's own pagination, the same reason |
| C-059 | the feed read against a relationship that has changed, the same reason |
| C-063 | the optional `tagList` and its default; the article batch stopped at the three required fields |
| C-064 | the initial favorite state, the same batch |
| C-065 | slug collision; the create work here stopped at the happy path and the validator |
| C-066 | the write side of tags was not reached |
| C-067 | the distinctness of the tag list, the same reason |
| C-068 | the article update handler; part of an update batch |
| C-069 | the slug moving with the title, the same batch |
| C-070 | the article update's merge, the same batch |
| C-073 | the deleted article leaving the collection; the delete work here stopped at the by-slug read |
| C-074 | the comment create handler; comments were reached here only as a precondition |
| C-075 | the comment validator, the same reason |
| C-076 | the comment create-then-list round trip, the same reason |
| C-077 | the comment list's article condition, the same reason |
| C-078 | the comment identifier as an address, the same reason |
| C-079 | the deleted comment leaving the list, the same reason |
| C-080 | favoriting was reached here only as a positive control |
| C-081 | the favorite counter, the same reason |
| C-082 | unfavoriting, the same reason |
| C-083 | the decrement, the same reason |
| C-084 | the flag and the count seen from a second caller, the same reason |

## Triage of the two reds

Two tests are red. Each is in exactly one bucket, and neither is a defect of a test or a misread
case. Both assertions are left exactly as they were written.

**The unheld-slug sweep — a defect of the target, in two places.** Five of the seven paths answer
404 as the case says. Two do not, and they are two different mistakes:

- `DELETE /articles/there-is-no-such-slug-000` answers **204** with an empty body. A delete that
  answers success for a slug nothing holds is reporting that it removed something that never
  existed. This one is already reproduced against this deployment in
  `tests/defects/not-found.spec.ts`.
- `POST /articles/there-is-no-such-slug-000/comments`, with a **valid** `comment` body, answers
  **422** with `errors.body` naming a schema problem. The article is never looked for: the payload
  validator runs first and the route's own lookup is never reached. This is not the same
  observation as the delete, and it is not the ordering defect the existing defects file records
  either — that one is validation running ahead of *authentication*, and this request carries no
  credential problem at all. It is validation running ahead of the *path lookup*.

Both assertions are right and the API is wrong, so **the test stays red and every status stays at
404**. Splitting the conforming five out and moving the two would follow the precedent in
`CONVENTIONS.md`, and it is not done here for one reason: the move needs a `D-#` entry in
`spec/FINDINGS.md` for the annotation to point at, and `spec/` is not this agent's to write.
Filing that entry and then splitting the test is the next action for a person.

**The registration echo — a defect of the target, and a disagreement inside the cases file.**
`POST /users` answers 200 with `bio: ""` and `image: null` for an account created seconds earlier.
C-029 states, without hedging, that both come back `null` at the moment of creation. The assertion
is the case's, so it stays: `expect([user.bio, user.image]).toEqual([null, null])`.

What makes this worth a person's attention rather than a shrug is that the cases file contradicts
itself here on purpose and says so. The user-document case admits a string **or** `null` for both
fields, and C-029's own grouping rationale explains that it sits apart precisely because "only at
the moment of creation is `null` the required value". So one artifact in the chain both allows
`""` and forbids it, depending on which case you read, and the target lands in the gap. Either the
rule behind it names the empty value the API must return at creation, or the case relaxes to match
the document case. This agent may do neither.

**Nothing else went red, and nothing was bent to keep it green.** No schema was relaxed, no status
was lowered, no assertion was widened after seeing a response. The two `[200, 201]` sets and the
one `[200, 204]` set were decided before the run and are argued for in the code, not fitted to it.

## Feedback

**No artifact in the chain fixes a success status, and `CONVENTIONS.md` demands an exact one.**
This is the same hole the previous run reported and it is still open. `CONVENTIONS.md` says to
"assert the **exact** status the target returns, not a range", and then says the exact value must
be one "the **specification** states" — and the specification is not this agent's to open. So
every success status in these eighteen tests was settled one of two ways, and both are recorded
here rather than hidden in the code:

- **Left as a two-value set, with the gap named in the assertion message.** `POST /users`,
  `POST /users/login`, `POST /articles` and `POST /articles/:slug/comments` are asserted as
  `[200, 201]`; `DELETE /articles/:slug` as `[200, 204]`. No case in the file names a status for
  any of them — several say only "is carried out" — and conforming deployments already disagree.
  A set is weaker than a contract and it is said so in every message.
- **Taken from the target by probing, because the case says only "is carried out".** `200` for
  `GET /user`, `GET /articles/:slug`, `GET /articles/:slug/comments`, `GET /articles?author=`,
  `GET /profiles/:username`, `GET /tags`, `PUT /user`, `PUT /articles/:slug`,
  `POST /articles/:slug/favorite` and `DELETE /articles/:slug/favorite`. Ten statuses that came
  from a request rather than from an artifact. Each is a place a rule should name a value.

A rule that named the success status of every write would close this, and then a case could carry
it. Until then the strongest honest assertion is a set, and a set is not a gate.

**Three cases name a transport this repository does not have.** A `Content-Type` response header,
an `OPTIONS` request, an `Origin` request header, an `Authorization` header written verbatim, and
CORS response headers. The QA agent is told not to name fixtures, matchers or helpers, so it has
no way to know what the client can reach — and the result is three cases that are correct and
unbuildable. Either the client grows those capabilities, or the constraint becomes visible one
link earlier.

**A case has nowhere to put the positive control a negative test needs.** `CONVENTIONS.md`
requires every negative to be paired with a request that differs in one variable and succeeds. The
case format has `Steps` and `Expected` and no third field, so every guard case lists only the
requests that must fail. Every control in this batch was added by this agent and is documented
above the test it belongs to. If the case format grew a `Control` field, that decision would sit
with the QA agent, where the rest of the case design already sits.

**A stale identifier survives in a file this agent may not edit.** `tests/defects/not-found.spec.ts`
names its test `C-006`, from the previous generation of the cases file. Under the regenerated
cases, C-006 is now "Endpoints with optional authentication serve an anonymous request", which is
not what that test is about. Renaming it means editing `tests/defects/`, which is outside this
batch's scope. It should be renamed the next time that file is touched, and it is a good argument
for identifiers in `tests/defects/` pointing at a `D-#` rather than at a `C-###`.

> **Corrected on 25 August 2026:** the rename has already happened. Task 3 of the `stage-2-critic`
> branch renamed that test to `D-6`, and `tests/unit/artifacts.spec.ts` now refuses any `C-###` in
> `tests/contract/` or `tests/defects/` that `## Automated` does not report in that same file — so
> the argument this paragraph closes with is the one that was acted on. The work item it hands a
> reader no longer exists. Found by the critic, as `O-019`'s neighbour `O-017` in
> `pipeline/04-objections.md`, whose stated risk was exactly this: a report shipping a task nobody
> needs to do. The paragraph above is the agent's own text and is annotated, not rewritten.

**Observations about the target that decide whether unwritten cases can go green.** They belong in
`spec/FINDINGS.md`, which this agent may not write:

- `POST /articles/:slug/comments` returns an author object with `username`, `bio` and `image` and
  **no `following`**, while the same author inside a *listed* comment carries it. The strict
  `CommentResponseSchema` will therefore be red for every case that reads a comment creation
  response, and that red will be the target's. It was seen by probing, not by a test in this
  batch.
- A validation failure is rendered as `{"errors":{"body":["SQLiteError: UNIQUE constraint failed:
  users.email"]}}`. The envelope conforms and the tests pass, but the message is a database error
  string reaching the client verbatim, naming the engine, the table and the column. No case
  constrains the content of a message, so nothing in the chain can catch it.
- The success responses carry `application/json;charset=utf-8` and the failure responses carry
  `application/json`. The case that would have caught that is the one refused for want of header
  access, and it asks for `application/json; charset=utf-8` — with a space — which is a third
  spelling again.

**No case in this batch turned out to be wrong in its steps.** Three are unbuildable here, one
cannot have its redness stated in a sentence, and one — the registration echo — states an
expectation that the target contradicts and that another case in the same file would have allowed.
That last one is the only place where the cases file, rather than the API, is worth re-reading.
