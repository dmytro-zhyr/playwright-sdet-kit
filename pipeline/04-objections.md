# Objections — the acceptance run

**Date:** 25 August 2026
**Model:** opus, pinned in `.claude/agents/critic.md`
**Where:** copies outside the repository, so neither `BASELINE.md` nor `FINDINGS.md` was reachable.

Three independent, freshly-dispatched critic calls, one per link of the chain. Each critic was
given exactly two artifacts — the input and the output of its link — and nothing else. No call
carried memory of another's objections.

- Call 1: `spec/conduit-api.md` → `pipeline/01-rules.md`
- Call 2: `pipeline/01-rules.md` → `pipeline/02-cases.md`
- Call 3: `pipeline/02-cases.md` → `tests/` + `pipeline/03-report.md`

## Objections

### O-001 — A rule asserts token-aware behaviour on Get Article that the same file calls undefined

**Artifact:** pipeline/01-rules.md
**Concerns:** R-187, R-125, R-008, R-009
**Question:** R-187 states as a rule that "a `GET /api/articles/:slug` authenticated as a second account … reports the raised `favoritesCount` while reporting `favorited` as `false`", which presumes Get Article reads the `Authorization` header at all — yet R-008 extends token-honouring only to endpoints documented "Authentication optional", Get Article is documented "No authentication required", and the last Open Question says the two phrases may mean the token is ignored, "in which case those two fields can never be `true` on R-125". Which is binding for a downstream case: R-187's definite assertion, or the Open Question's statement that the matter is unsettled — and if Get Article ignores tokens, what makes R-187's `false` an observation about the caller rather than a restatement of R-009?
**Risk if ignored:** Stage 2 writes a case that authenticates a request to `GET /api/articles/:slug` and reads `favorited`/`author.following` per-caller, and an implementation that ignores the header on that endpoint is recorded as a defect on grounds no rule actually establishes.
**Possible alternative:** either give Get Article an explicit token-honouring rule of its own, or restate R-187 against a `GET /api/articles?favorited=` / list endpoint, which R-116 does cover.

### O-002 — R-015 fixes the success code at 200 while three other places leave it open

**Artifact:** pipeline/01-rules.md
**Concerns:** R-015, R-129, R-155, R-161, R-174
**Question:** R-015 states that a request that is carried out "is answered with status 200 and the document the endpoint is documented to return", but R-155 and R-174 say only "a success status", and the second Open Question says no success code is stated anywhere and that R-129, R-155, R-161 and R-174 "inherit the same uncertainty" — including the creation endpoints where 201 would be conventional. Does a case checking `POST /api/articles` assert exactly 200, or any 2xx; and how can R-015's "and the document the endpoint is documented to return" be satisfied by Delete Article, which the same file says has no documented return at all?
**Risk if ignored:** Every creation and deletion case in stage 2 either hard-codes 200 and fails a conforming 201/204 implementation, or accepts any 2xx and silently contradicts R-015, and stage 3 cannot tell which reading a red test proves wrong.
**Possible alternative:** narrow R-015 to "a 2xx status, and 200 wherever a document is documented to be returned", and say once which endpoints it does not fix.

### O-003 — The errors envelope is extended from validation failures to every failure

**Artifact:** pipeline/01-rules.md
**Concerns:** R-017, R-011, R-010, R-055, R-056
**Question:** The specification defines the `{"errors": …}` shape only under "If a request fails any validations, expect a 422 and errors in the following format", and R-011 correctly scopes it to "A 422 response"; R-017 nevertheless states that "A response that reports a failure carries the `errors` envelope alone", which asserts that 401, 403 and 404 responses also carry that body. Where in the input is a 401, 403 or 404 body specified, and does R-017 oblige a case for R-055/R-056 (a failed login, whose status the Open Questions call undefined) to assert an `errors` object as well?
**Risk if ignored:** Stage 2 asserts an `errors` envelope on 401/403/404 responses; an implementation returning an empty or differently shaped body for those codes is reported as a spec divergence although the specification never described that body.
**Possible alternative:** split R-017 into the negative half the input supports (a failure response carries none of the resource keys) and leave the presence of `errors` to R-011's 422 scope.

### O-004 — Illustrative examples are restated as exact requirements

**Artifact:** pipeline/01-rules.md
**Concerns:** R-016, R-201, R-036
**Question:** The input writes "Make sure the right content type **like** `Content-Type: application/json; charset=utf-8`" and "`Access-Control-Allow-Headers` (**e.g.** `Content-Type`)", yet R-016 (Kind: explicit) requires the header to be that exact string and R-201 requires the allowed-headers list to name "at least `Content-Type`" — while R-036 elsewhere is careful to record that the input declines to fix a format. Does R-016 fail a response sending `application/json` without the charset parameter, and does R-201 fail a preflight whose allowed-headers value is `*`?
**Risk if ignored:** Stage 2 produces exact-string assertions on two headers the specification only exemplified, and stage 3 reports conforming implementations as defective on the strength of the word "like".
**Possible alternative:** state R-016 as "a JSON media type of `application/json`, charset parameter permitted", and mark both Kind as assumed with the hardening named.

### O-005 — "Most recent first" is resolved to `createdAt` with no stated warrant

**Artifact:** pipeline/01-rules.md
**Concerns:** R-106, R-114, R-120, R-153
**Question:** The input says only "ordered by most recent first", but R-106 and R-120 (both Kind: explicit) fix the ordering key as `createdAt` descending and R-114 says an offset-free request "starts from the most recent article" — while R-153 states that an update moves `updatedAt`, so the two candidate keys give different orders for any article that has been edited. What in the input selects `createdAt` over `updatedAt`, and why is that selection labelled explicit rather than assumed?
**Risk if ignored:** A stage 2 ordering case creates an article, edits an older one, and asserts an order that a conforming implementation sorting by `updatedAt` violates — a false defect that no rule text will let stage 3 adjudicate.
**Possible alternative:** state the ordering key as an assumption with its reason, or write R-106/R-120 against creation order only in scenarios where no article has been updated.

### O-006 — The first Open Question reverses the authority the input assigns to the specification

**Artifact:** pipeline/01-rules.md
**Concerns:** R-036
**Question:** The input's header states "The specification is authoritative here: tests are written against it, and a divergence is a defect until proven otherwise", which resolves the precedence question for this pipeline; the first Open Question instead says "every rule above rests on prose the source itself calls secondary. Nothing in this file can be resolved against them." Why is the header's resolution not recorded, and under the Open Question's framing, what standing does R-036 have when its own source sentence ("no particular format is enforced by the test suite") is drawn from the very authority the Open Question says is unavailable?
**Risk if ignored:** Stage 3 has a standing excuse for any failing test — the prose was never authoritative — which is exactly the inversion the input's header forbids, and defects get downgraded to prose ambiguity.
**Possible alternative:** keep the observation that the OpenAPI and Hurl artefacts are absent, but record the header's ruling alongside it, so the Open Question limits what can be cross-checked rather than what is binding.

### O-007 — C-058 expects a comparison against a reading its own steps never take

**Artifact:** pipeline/02-cases.md
**Concerns:** R-121, R-122, C-055, C-058
**Question:** C-058's steps are exactly two requests, `GET /api/articles/feed?limit=2` and `GET /api/articles/feed?offset=1`, yet its expected result says the second "begins with the entry that stood second in an unpaginated feed for the same account" — where does that unpaginated feed come from, given that C-055, which makes the same kind of offset claim for the list endpoint, explicitly sends a third request with no parameters to establish the baseline?
**Risk if ignored:** the automation either invents an unlisted request or, worse, checks nothing about offset and reports green, leaving R-122 effectively uncovered while the traceability table says it is covered.
**Possible alternative:** add the unpaginated `GET /api/articles/feed` to the steps, as C-055 does, or restate the expectation in terms only of the two responses the steps produce.

### O-008 — C-019 asserts the user object is closed, which no rule states

**Artifact:** pipeline/02-cases.md
**Concerns:** R-019, R-020, R-022, C-018, C-019, C-020, C-021, C-024
**Question:** C-019's expected result ends "and the user object carries no field beyond the five the user document is documented to have", but R-022 forbids only the password and R-019 says the object "carries" five named fields without saying it carries nothing else — which rule licenses the closure, and why do C-020, C-021 and C-024 assert only presence for the profile, article and comment serializers if closure is a property of the response documents?
**Risk if ignored:** a deployment that returns a documented-plus-extra user field (an `id`, a `createdAt`) fails C-019 as a defect report against a rule that never prohibited it, and the report attributes the failure to R-022, which is about passwords.
**Possible alternative:** narrow the expectation to the password absence R-022 actually states, or raise the closure question to the rules stage so R-019 can be restated as an exact field set for every document, consistently across C-018 through C-024.

### O-009 — C-046 expects two named articles in a list the rules cap at twenty

**Artifact:** pipeline/02-cases.md
**Concerns:** R-104, R-107, R-112, C-046, C-055
**Question:** C-046 sends one unparameterised `GET /api/articles` and expects "both accounts' articles are among its entries" from a precondition of only "two registered accounts, each having created at least one article", while R-112 caps that response at twenty entries and C-055's precondition requires "more than twenty articles exist" on the same deployment — what makes the two articles reachable in the first page, and can both preconditions hold at once?
**Risk if ignored:** C-046 goes red on a correct implementation whenever the deployment carries more than twenty articles that are newer than the two, and the report blames R-107, the global-selection rule, for a pagination artefact.
**Possible alternative:** state in C-046's precondition that the two articles are the most recently created, or observe R-107 through a request whose result set the default limit cannot truncate.

### O-010 — C-007 reads a caller's own profile to instantiate "does not follow"

**Artifact:** pipeline/02-cases.md
**Concerns:** R-089, R-090, C-007, C-056, C-057
**Question:** C-007's second step reads `GET /api/profiles/:username` for the first account authenticated as that same account and expects `following` false, but the rules' open questions record that whether an account can follow itself is undefined — what makes `false` the required answer for a self-read rather than an undecided one, and why does C-007's precondition specify "the second following nobody" when no step ever authenticates as the second account?
**Risk if ignored:** an implementation that reports a self-relationship as `true`, or that refuses to model one, fails C-007 on a point the specification does not settle; and because C-007 is the only case asserting R-090, a genuine failure of the anonymous-versus-authenticated distinction and an argument about self-follow semantics arrive as the same red.
**Possible alternative:** use the second account's token to read the first account's profile — which is what the stated precondition prepares — so that the `false` reading rests on two distinct accounts, as C-045 already does for R-097.

### O-011 — Five cases assert an absent side effect that no step observes

**Artifact:** pipeline/02-cases.md
**Concerns:** R-003, R-060, R-066, R-132, R-164, C-002, C-013, C-030, C-031, C-040, C-062, C-075
**Question:** C-002 expects "none of the mutating ones changes the resource it addressed", C-030 "no account is created", C-031 "neither creates an account", C-062 "no article is created", C-075 "no comment is created on the article" and C-040 "the second account keeps its own email and username" — yet none of those cases has a step that reads anything back, and none of R-003, R-060, R-066, R-132 or R-164 says more than that the request is refused; why is the read-back folded into the expectation here when C-013 exists as a separate case, with explicit follow-up reads, to make exactly this claim for the 403 refusals?
**Risk if ignored:** either the automation silently drops the second half of six expectations, so a validator that refuses and writes anyway passes, or it invents unlisted requests whose failures cannot be traced to any rule.
**Possible alternative:** give the refusal-side-effect claim its own case with read-back steps, as C-013 does, or strike it from these six expectations and let each case assert only the status and envelope its rules state.

### O-012 — Three cases count their own covered rules differently from their Covers list

**Artifact:** pipeline/02-cases.md
**Concerns:** R-003, R-006, R-007, C-002, C-005, C-006
**Question:** C-002 covers thirteen identifiers but its rationale says "these twelve are one general rule and its eleven instances"; C-005 covers five but says "All five instances", where R-006 is the general rule and only four are instances; C-006 covers four but says "The four instances", where R-007 is the general rule and three are instances — which reading is authoritative, and is the general rule in each case being counted as one of its own instances?
**Risk if ignored:** a traceability check that reconciles rationale prose against the Covers lists reports three mismatches, and a reader auditing whether R-003, R-006 and R-007 are covered as general statements — rather than merely as the sum of their instances — cannot tell from the case which was intended.
**Possible alternative:** state the count as "one general rule and its N instances" with N matching the Covers list in each of the three.

### O-013 — The report says the specification was never opened; the tests it produced quote it

**Artifact:** pipeline/03-report.md
**Concerns:** C-015, C-026, C-029, C-060
**Question:** The report's second line states that it was produced "from `pipeline/02-cases.md` and `CONVENTIONS.md`, and from nothing else. Neither `spec/conduit-api.md` nor `spec/FINDINGS.md` was opened", and the Feedback section repeats that "the specification is not this agent's to open." But every test file written in this batch asserts what the specification says, in wording that appears nowhere in `pipeline/02-cases.md`: `tests/contract/registration.spec.ts` line 4 ("The specification states no success status for registration — anywhere, and for any endpoint. It says only that the call 'returns a User'"), `tests/contract/articles.spec.ts` line 4 ("It says only that the call 'will return an Article'"), `tests/contract/not-found.spec.ts` line 14 ("only that it returns a Comment"), `tests/contract/login.spec.ts` line 4, and `tests/contract/registration.spec.ts` line 146 ("the specification's own example keys a validation message under `body`"). If the specification was never opened, where did "returns a User", "will return an Article" and the shape of the specification's own error example come from, and if it was opened, which of the two statements should a reader of this link believe?
**Risk if ignored:** The report's provenance claim is the only guarantee that the tests were derived from the cases and not from the specification behind them. If it is false, every "no artifact in the chain fixes this" judgement in the Feedback section — which is what the next link acts on — was made by an agent that had the artifact it says it lacked, and the chain's isolation is unaudited.
**Possible alternative:** State which spec-derived phrases entered the test comments and from where, or replace those comments with a claim sourced to `pipeline/02-cases.md`.

### O-014 — "No artifact in the chain fixes a success status" contradicts C-009

**Artifact:** pipeline/03-report.md
**Concerns:** C-009, C-060, C-061, C-072
**Question:** The Feedback section opens "**No artifact in the chain fixes a success status**", and its first bullet says of `POST /users`, `POST /users/login`, `POST /articles` and `POST /articles/:slug/comments` that "No case in the file names a status for any of them"; its second bullet lists `200` for `GET /user`, `GET /articles/:slug`, `GET /tags` and others as "Ten statuses that came from a request rather than from an artifact." But C-009's Expected states "Every response carries status 200", and its Steps name `GET /api/tags`, `GET /api/articles`, `GET /api/articles/:slug`, `GET /api/user` with a token and `POST /api/articles` with a valid body — and the cases file's own Open questions say in terms that "C-009 asserts 200 across a sample that includes `POST /api/articles`, so a deployment answering 201 there fails C-009." Why are `[200, 201]` for `POST /articles` in `tests/contract/articles.spec.ts` and the probed `200` for `GET /user`, `GET /articles/:slug` and `GET /tags` recorded as gaps in the chain when C-009 fixes each of them at 200?
**Risk if ignored:** The report asks a person to close a hole that the cases file already closed, and in the meantime `tests/contract/articles.spec.ts` asserts a two-value set where the input asserted a single value — a silent weakening of C-009's expectation on the same endpoint the report refused C-009 over.
**Possible alternative:** Say that C-009's 200 was declined because C-009 is refused as a whole, and record that as a deliberate narrowing rather than as an absence in the chain.

### O-015 — The report names an enforcing test that is not in `tests/`

**Artifact:** pipeline/03-report.md
**Concerns:** C-003, C-071, C-085
**Question:** The report states that "Every case identifier appears in exactly one of the four sections below; `tests/unit/artifacts.spec.ts` enforces that, because silence about a case is the one outcome this report may not have." The `tests/` artifact contains only `tests/contract/` (nine files) and `tests/defects/` (three files); there is no `tests/unit/` directory and no `artifacts.spec.ts` anywhere in it. What enforces the placement of C-003, C-071 and C-085 in Refused and Uncertain, and of every other identifier in the four tables, if that file is not part of the output?
**Risk if ignored:** The exhaustiveness claim that the whole report rests on — 18 + 3 + 1 + 63 = 85 with no case unmentioned — is asserted rather than checked, and the next batch will regenerate the tables believing a green run guards them.

### O-016 — C-031's "neither creates an account" is not asserted anywhere and is not declared missing

**Artifact:** tests/
**Concerns:** C-030, C-031
**Question:** C-031's Expected has two halves: "Both are answered with 422 and an `errors` envelope, **and neither creates an account**." `tests/contract/registration.spec.ts` asserts the 422s, asserts the `errors` messages, and then registers a wholly fresh account as a control — nothing anywhere checks that the two refused requests left no account behind, and the fresh registration cannot show it because it collides with neither value. The report's own paragraph naming the four tests that carry a second half ("Four of the eighteen assert something a status cannot show") lists the guard sweep, C-030, C-062 and C-072, and not C-031. Why is the second half of C-031 neither implemented — as it was for C-030, where the very account the refusals were built from is re-sent — nor recorded as a gap?
**Risk if ignored:** C-031 is reported as automated while an implementation that answers 422 and creates the duplicate account anyway stays green, which is precisely the failure the case says makes login and the profile path ambiguous.
**Possible alternative:** Log in with the duplicate registration's credentials, or read the profile under the fresh username, and expect the account not to exist.

### O-017 — The stale-identifier feedback describes a name the defects file does not carry

**Artifact:** pipeline/03-report.md
**Concerns:** C-006, C-015
**Question:** The Feedback section says "**A stale identifier survives in a file this agent may not edit.** `tests/defects/not-found.spec.ts` names its test `C-006`, from the previous generation of the cases file. Under the regenerated cases, C-006 is now 'Endpoints with optional authentication serve an anonymous request'... It should be renamed the next time that file is touched." But `tests/defects/not-found.spec.ts` names its only test `'D-6 — deleting an identifier that names nothing is answered 404'` — the rename the report asks for has already happened, and the `D-#` convention the report argues for is already in use there. Which state of that file does this report describe, and is the Triage's claim that the unheld-slug delete "is already reproduced against this deployment in `tests/defects/not-found.spec.ts`" describing the same file?
**Risk if ignored:** A person is handed a work item that does not exist and may edit `tests/defects/` to "fix" a correctly named test; worse, one item of the Feedback section is demonstrably about a file state that is not the one shipped, which puts the rest of that section's observations in doubt.

### O-018 — The guard sweep is said to prove no refusal changed anything, for two endpoints where the read cannot tell

**Artifact:** pipeline/03-report.md
**Concerns:** C-002
**Question:** The report states that "the guard sweep reads the article, the comment list, the account, the profile and the author's own listing back afterwards to prove that nothing the twelve refusals addressed was changed." C-002's preconditions establish only "an article with at least one comment on it", so at the time of the sweep the caller follows nobody and the article is favorited by nobody; `tests/contract/authentication.spec.ts` accordingly asserts `following` is `false` and `favoritesCount` is `0` — the same values they held before the twelve requests were sent. For `DELETE /profiles/:username/follow` and `DELETE /articles/:slug/favorite`, what would the read-back report differently if the guard had let the request through and the deletion had happened?
**Risk if ignored:** The report claims coverage of "none of the mutating ones changes the resource it addressed" across all twelve, and the next link will not re-derive which two of the twelve have an unfalsifiable read-back behind them.
**Possible alternative:** Say which of the twelve the read-backs can and cannot distinguish, or have the precondition establish a follow and a favorite so the two deletions have something to remove.

### O-019 — The Triage calls C-018 and C-029 a contradiction where the cases file says they are deliberately stratified

**Artifact:** pipeline/03-report.md
**Concerns:** C-018, C-029
**Question:** The Triage says "the cases file contradicts itself here on purpose and says so... So one artifact in the chain both allows `\"\"` and forbids it, depending on which case you read", and asks a person to choose between naming the empty value in a rule and relaxing C-029. But C-018 asserts only that `bio` and `image` are "either a string or `null`" — a value of `null` satisfies it — and C-029's own grouping rationale states that R-065 "sits here rather than in C-018 because C-018 accepts a string or `null` for `bio` and `image` by R-020, and only at the moment of creation is `null` the required value." Taken together the two cases are satisfiable at once by a registration that returns `null`; which pair of assertions in C-018 and C-029 cannot both hold?
**Risk if ignored:** A person is asked to relax C-029 — the one assertion in the batch that catches the target returning `bio: ""` at creation — on the strength of a conflict that the input explicitly denies, and the closing paragraph elevates it to "the only place where the cases file, rather than the API, is worth re-reading."
**Possible alternative:** Report it as the target failing C-029 alone, and note separately that C-018 is too weak to catch the same response.

## Verdict

Objections remain.
