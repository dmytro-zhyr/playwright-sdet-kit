# Conduit API — test cases grouped by unit of independent failure

Produced by the `qa` agent from [`pipeline/01-rules.md`](01-rules.md), and from nothing else. The
specification was not opened here; where a rule is ambiguous the ambiguity is recorded under
`## Open questions` rather than settled.

A case is a **unit of independent failure**. Rules that break together and for the same reason
share a case; a rule whose two directions can fail apart gets two. Forty-five cases carry one
hundred and thirty-five of the one hundred and thirty-eight rules; the remaining three are
accounted for under `## Not covered`.

Vocabulary follows the rules file: paths carry the `/api` prefix, and "with a token" means the
request carries `Authorization: Token <token>` with a token the API issued to that account.

## Cases

### C-001 — A JSON response declares a JSON content type
**Covers:** R-001

- **Grouping rationale:** it stands alone because the content type is decided once, by the layer
  every handler returns through, and no other rule changes value when it is wrong. Every other
  case in this file would stay green against an API that answered `text/plain` throughout. The
  rule is universally quantified over responses, so a case can only sample; one anonymous read
  and one authenticated write are the sample.
- **Preconditions:** none.

**Steps:** GET /api/tags with no Authorization header, then POST /api/users registering a fresh
account.
**Expected:** both bodies parse as JSON, and both responses carry a Content-Type header whose
value begins with `application/json`.

### C-002 — A cross-origin preflight is answered with the access-control headers
**Covers:** R-010, R-011

- **Grouping rationale:** both rules are the CORS middleware and nothing else. When it is not
  mounted the OPTIONS request falls through to the router and is answered 404 or 405 while the
  two headers are absent from that same response; when it is mounted both appear. There is no
  arrangement of the code in which one of these rules holds and the other does not.
- **Preconditions:** none.

**Steps:** send OPTIONS /api/articles carrying `Origin: https://example.test` and
`Access-Control-Request-Method: GET`.
**Expected:** the status is below 400 and is neither 404 nor 405, and the response carries both
an Access-Control-Allow-Origin header and an Access-Control-Allow-Headers header.

### C-003 — An endpoint that requires authentication refuses a caller who sends no credential
**Covers:** R-004, R-030, R-037, R-047, R-051, R-069, R-088, R-100, R-105, R-112, R-120, R-127,
R-132

- **Grouping rationale:** thirteen rules naming one guard — the code that reads the Authorization
  header and stops the request when there is none. R-004 states it in general and the other
  twelve state it at an endpoint. If the guard is gone all thirteen are red at once; if one
  endpoint was left off the list the guard is attached to, that step is red and the reader goes
  to the same declaration to find out why. Twelve cases asserting "401 without a header" would be
  twelve copies of one check, which is the shape this file exists to avoid.
- **Preconditions:** none. The guard is expected to answer before the path is resolved, so the
  username, slug and comment identifier below are placeholders that need not exist.

**Steps:** with no Authorization header, send GET /api/user; PUT /api/user; POST
/api/profiles/:username/follow; DELETE /api/profiles/:username/follow; GET /api/articles/feed;
POST /api/articles; PUT /api/articles/:slug; DELETE /api/articles/:slug; POST
/api/articles/:slug/comments; DELETE /api/articles/:slug/comments/:id; POST
/api/articles/:slug/favorite; DELETE /api/articles/:slug/favorite.
**Expected:** every one of the twelve responses has status 401.

### C-004 — A token the API never issued is not a credential
**Covers:** R-032

- **Grouping rationale:** deliberately not folded into C-003. C-003 goes red when the guard is
  never run; this goes red when the guard runs, finds a value in the header and never verifies
  it. They are opposite bugs in one piece of code and either can be green while the other is red,
  which is what makes them two units of failure rather than two steps of one.
- **Preconditions:** none.

**Steps:** GET /api/user carrying `Authorization: Token not.a.real.token`.
**Expected:** status 401.

### C-005 — An endpoint that does not require authentication serves an anonymous caller
**Covers:** R-009, R-017, R-025, R-042, R-057, R-079, R-115, R-136

- **Grouping rationale:** the mirror of C-003, and the same declaration read from the other side:
  these rules fail together when the guard is attached to an endpoint that must not carry it,
  which is one mis-scoped list. R-009 is the general statement and the other seven name the
  endpoints the rules identify as open. Each step asserts only that the answer is not a 401 and
  that the endpoint's own envelope is present; what is inside those envelopes belongs to the
  cases for those endpoints, which is why nothing here is repeated there.
- **Preconditions:** one registered account with one article, so the profile, article and comment
  paths name something that exists; that account's email, password and username and the
  article's slug are known.

**Steps:** with no Authorization header, send POST /api/users registering a fresh account; POST
/api/users/login with the known account's email and password; GET /api/profiles/:username; GET
/api/articles; GET /api/articles/:slug; GET /api/articles/:slug/comments; GET /api/tags.
**Expected:** no response has status 401, and each body carries the key its endpoint names — in
order `user`, `user`, `profile`, `articles`, `article`, `comments`, `tags`.

### C-006 — An identifier that names nothing is answered 404
**Covers:** R-006, R-043, R-052, R-080, R-102, R-107, R-117, R-122, R-133

- **Grouping rationale:** R-006 is the general rule and the other eight are it applied wherever a
  path segment is resolved to a record. "Not found" is one decision — the lookup that refuses to
  invent a row — and the status it maps to is one mapping. A wrong mapping turns every step red
  together; a single lenient lookup that answers 200 or 500 turns one step red and names the path
  whose finder is wrong. Both readings send the reader to a finder, which is one kind of thing to
  go and read.
- **Preconditions:** a registered account with a token, and one article created by it, whose slug
  supplies the one path where the article must exist and the comment must not.

**Steps:** GET /api/profiles/:unknown-username; POST /api/profiles/:unknown-username/follow with
the token; GET /api/articles/:unknown-slug; PUT /api/articles/:unknown-slug with the token and a
title; DELETE /api/articles/:unknown-slug with the token; GET
/api/articles/:unknown-slug/comments; DELETE /api/articles/:slug/comments/:unknown-id with the
token; POST /api/articles/:unknown-slug/favorite with the token.
**Expected:** every one of the eight responses has status 404.

### C-007 — Only the author may change or remove an article
**Covers:** R-005, R-101, R-106

- **Grouping rationale:** R-005 is the general 403 rule, and the API offers it exactly three
  occasions; two of them are here. Both are one comparison — the article's author against the
  caller — written into the update action and the delete action of one controller against one
  model. A controller that omits the comparison lets a stranger through both doors, and a
  comparison answered with 404 or 401 instead of 403 is wrong at both. The comment occasion is
  C-008 because it is a different model in a different controller.
- **Preconditions:** two registered accounts, each with a token; one article created by the
  first, whose title and slug are known.

**Steps:** with the second account's token, PUT /api/articles/:slug of the first account's
article with a new title; then DELETE /api/articles/:slug for the same article.
**Expected:** both responses have status 403, and a following GET /api/articles/:slug still
returns the article with its original title.

### C-008 — Only the commenter may delete a comment
**Covers:** R-121

- **Grouping rationale:** deliberately not merged into C-007. The ownership comparison for a
  comment is written in the comments controller against the comment's author; the article one is
  written in the articles controller against the article's author. Either can exist while the
  other does not, and a red here sends the reader to a different file than a red in C-007 does.
- **Preconditions:** two registered accounts with tokens; an article; a comment on that article
  written by the first account, whose identifier is known.

**Steps:** with the second account's token, DELETE /api/articles/:slug/comments/:id naming the
first account's comment; then GET /api/articles/:slug/comments.
**Expected:** the delete has status 403, and the comment is still present in the list.

### C-009 — Registration returns a new User
**Covers:** R-012, R-013, R-018

- **Grouping rationale:** one request and the serializer that answers it. R-012 is the envelope,
  R-013 that the object carries exactly the five User fields, R-018 that a fresh account's bio
  and image are null. A serializer that dropped a field, leaked an identifier or defaulted bio to
  an empty string is the same object in every reading, and an endpoint that answers with nothing
  makes all three red at once. That registration needs no credential is C-005's, because that is
  the guard and not the serializer.
- **Preconditions:** none.

**Steps:** POST /api/users with a username, email and password that no account uses.
**Expected:** the body carries a `user` object whose keys are exactly `email`, `token`,
`username`, `bio` and `image`; `bio` is null; `image` is null; `token` is a non-empty string.

### C-010 — Registration refuses a request that omits a required field
**Covers:** R-002, R-003, R-014, R-015, R-016

- **Grouping rationale:** three requests against one validation declaration. R-002 and R-003 are
  the general shape of a validation failure — status 422, a body whose only key is `errors`,
  values that are arrays of strings — and they are asserted here rather than in a case of their
  own because they cannot be observed without a request that fails validation, and these three
  make one each. A missing presence validator turns one step red; a status mapped elsewhere or an
  error body of another shape turns all three red. Every reading ends at POST /api/users and what
  it does with a user it will not accept.
- **Preconditions:** none.

**Steps:** POST /api/users three times, each carrying a valid username, email and password except
one — the first omitting `user.email`, the second `user.username`, the third `user.password`.
**Expected:** each response has status 422 and a body whose only key is `errors`, whose values
are arrays of strings, and which carries at least one entry.

### C-011 — Registration refuses an email or a username already in use
**Covers:** R-019, R-020

- **Grouping rationale:** two uniqueness constraints on one model, declared side by side and
  enforced in one validation pass. A model with no uniqueness rules fails both; a database that
  enforces uniqueness without translating the violation into a 422 fails both in the same way.
  They are separable in principle — a schema can be unique on one column and not the other — so
  the case makes both requests and the failure names the column.
- **Preconditions:** one registered account whose email and username are known.

**Steps:** POST /api/users with that account's email and a fresh username; then POST /api/users
with that account's username and a fresh email.
**Expected:** both responses have status 422; the first body carries an `errors.email` entry, the
second an `errors.username` entry.

### C-012 — The token from a registration identifies its account
**Covers:** R-007, R-008, R-021, R-029, R-031

- **Grouping rationale:** one round trip carries all five. The token has to be taken from the
  registration response (R-008), sent as `Authorization: Token <token>` (R-007), accepted
  (R-021), resolved to the account it was issued for (R-029) and answered with a full User object
  (R-031). Break any link and the same request fails: a header nobody reads, a token nobody
  verifies and a lookup that returns the wrong row are all "the credential does not identify its
  owner". R-031 repeats R-013's shape check at a second endpoint on purpose, because a second
  endpoint can serialize differently.
- **Preconditions:** none; the account is registered inside the case, so the email and username
  under test are known to be the ones the token was issued for.

**Steps:** POST /api/users registering a fresh account; take `user.token` from the response; GET
/api/user carrying `Authorization: Token <that token>`.
**Expected:** the body carries a `user` object with exactly the five User fields, whose `email`
and `username` are the ones registered.

### C-013 — Login returns the account that owns the email
**Covers:** R-022, R-028

- **Grouping rationale:** one successful login. R-022 is the envelope and R-028 is that the
  account inside it is the one the email belongs to. A login that answers with no user fails
  both; a lookup keyed on something other than the email fails R-028 while R-022 stays green —
  and both send the reader to that lookup. That login needs no credential is C-005's.
- **Preconditions:** a registered account whose email and password are known.

**Steps:** POST /api/users/login with that email and that password.
**Expected:** the body carries a `user` object whose `email` equals the email sent and whose
`token` is a non-empty string.

### C-014 — Login refuses a request that omits a required field
**Covers:** R-023, R-024

- **Grouping rationale:** login's own required-field declaration, which is not registration's:
  the two endpoints require different fields in different actions, and one can be validated while
  the other is not. The 422 status and the errors envelope are already C-010's; what is new here
  is which fields this endpoint insists on, and a red means this endpoint's list is wrong.
- **Preconditions:** none.

**Steps:** POST /api/users/login twice, once without `user.email` and once without
`user.password`, each carrying the other field.
**Expected:** each response has status 422 with at least one entry under `errors`.

### C-015 — Login issues no token without matching credentials
**Covers:** R-026, R-027

- **Grouping rationale:** one path — find the account by email, compare the password — and the
  two ways of asking it for something that is not there. An implementation that never performs
  the comparison hands a token to both requests; one that answers an unknown email with a token
  has invented an account. Both rules assert the absence of a token rather than a status because
  the rules record no status for a failed login, and both reds land in the same handler.
- **Preconditions:** a registered account whose email and password are known.

**Steps:** POST /api/users/login with that email and a password that is not the account's; then
POST /api/users/login with an email that belongs to no account and any password.
**Expected:** neither response body contains a `user.token`.

### C-016 — Updating the current user stores what it was given and keeps the rest
**Covers:** R-033, R-035, R-036

- **Grouping rationale:** one write and one read back. R-033 is the echo in the response, R-035
  that the value is still there on the next request, R-036 that a field the request never
  mentioned was left alone. All three are the update action's attribute assignment: a handler
  that ignores the payload fails the first two, one that assigns the whole object over the record
  fails the third, and there is a single action to go and read. The password is C-017 because no
  response shows it, and R-034 is not covered — see `## Not covered`.
- **Preconditions:** a registered account with a token, a known username and a known email.

**Steps:** PUT /api/user with `user.bio` set to a new value and no other field; then GET
/api/user with the same token.
**Expected:** the update's `user.bio` is the value sent; the following read's `user.bio` is the
same value; the `username` and `email` in both are the ones the account already had.

### C-017 — A password set through the update becomes the login password
**Covers:** R-038

- **Grouping rationale:** the password is the one accepted field of the update whose effect no
  response shows, so it travels a different write — a digest — and is observed at a different
  endpoint. C-016 would stay green against a handler that accepted the password and threw it
  away, and nothing else in this file would notice either.
- **Preconditions:** a registered account with a token and a known email.

**Steps:** PUT /api/user with `user.password` set to a new value; then POST /api/users/login with
the account's email and that new password.
**Expected:** the login body carries a `user.token`.

### C-018 — The update refuses an email another account already uses
**Covers:** R-039

- **Grouping rationale:** deliberately not merged into C-011. Uniqueness on create is satisfied
  by a constraint on the column; uniqueness on update has additionally to exclude the row being
  written. An implementation that gets create right can still let an update take an address that
  is taken, or refuse an account its own address, and a red here points at the update action
  rather than at the model's constraint.
- **Preconditions:** two registered accounts; the first's email is known, the second holds a
  token.

**Steps:** PUT /api/user with the second account's token and `user.email` set to the first
account's email.
**Expected:** status 422 with an `errors.email` entry.

### C-019 — A profile is readable by username
**Covers:** R-040, R-041

- **Grouping rationale:** one read and its serializer — that a username addresses a profile, and
  that the profile carries exactly the four Profile fields. A serializer that leaks the email or
  drops `image` is the same object as an endpoint that answers with no profile at all, and one
  request shows both. What `following` holds for an anonymous reader is C-020, because that is a
  different decision made in a different place.
- **Preconditions:** a registered account with a known username.

**Steps:** GET /api/profiles/:username.
**Expected:** the body carries a `profile` object whose keys are exactly `username`, `bio`,
`image` and `following`, and whose `username` is the one requested.

### C-020 — A reader-relative field is false for a caller the API cannot identify
**Covers:** R-044, R-068

- **Grouping rationale:** `following` and `favorited` are the only two fields in this API whose
  value depends on who is asking, and for an anonymous caller there is nobody to ask about. Both
  rules fail on one mistake made in two serializers — evaluating a relation against a current
  user that does not exist — and the symptom is the same, a true or a crash. Splitting them would
  be splitting one decision along the endpoints that happen to expose it.
- **Preconditions:** a registered account with a known username and at least one article of its
  own, so both reads return something to inspect.

**Steps:** with no Authorization header, GET /api/profiles/:username and GET
/api/articles?author=:username.
**Expected:** `profile.following` is false, and every entry of `articles` has `favorited` false.

### C-021 — Following an author is recorded and survives a re-read
**Covers:** R-045, R-046, R-048, R-053

- **Grouping rationale:** one write and its readback. R-048 is that the write carries no payload,
  R-045 that it answers with a profile, R-046 that the profile says following, R-053 that the
  next read of the same profile still says it. A follow that is answered but not persisted passes
  the first three and fails the fourth; a follow that is not performed fails from R-046 onward;
  every one of those reds is the follow action and the relation it is supposed to write.
- **Preconditions:** two registered accounts; the first's username is known, the second holds a
  token.

**Steps:** POST /api/profiles/:username/follow with the second account's token and an empty
request body; then GET /api/profiles/:username with the same token.
**Expected:** the write's body carries a `profile` object whose `following` is true, and the
following read's `profile.following` is true as well.

### C-022 — Unfollowing clears the follow
**Covers:** R-049, R-050

- **Grouping rationale:** the mirror of C-021 at a different handler. Delete is a separate action
  from create and can be absent or wrong on its own, which is why it is a case and not two more
  steps of C-021; inside it, the envelope and the `following: false` are one answer to one
  request and cannot come apart.
- **Preconditions:** two registered accounts, the second holding a token and already following
  the first.

**Steps:** DELETE /api/profiles/:username/follow with the second account's token.
**Expected:** the body carries a `profile` object whose `following` is false.

### C-023 — The article list is a page of author-bearing summaries
**Covers:** R-054, R-055, R-066

- **Grouping rationale:** one response and the serializer that builds it: the `articles` and
  `articlesCount` envelope, the absence of `body` on a list entry, and the author rendered as a
  full Profile. A list that reaches for the single-article serializer fails R-055 and R-066
  together, because both are exactly the difference between the two serializers. Ordering, paging
  and filtering are separate queries and have cases of their own.
- **Preconditions:** at least one article exists; create one so the array is not empty and the
  assertions are not vacuous.

**Steps:** GET /api/articles.
**Expected:** the body carries an `articles` array and a numeric `articlesCount`; no entry has a
`body` key; every entry's `author` has exactly `username`, `bio`, `image` and `following`.

### C-024 — The article list is ordered newest first
**Covers:** R-056, R-094

- **Grouping rationale:** one ordering clause seen from both ends. R-056 reads a page and checks
  that `createdAt` never increases down it; R-094 writes an article and checks that it arrives at
  the front. An ordering clause that is missing or reversed fails both. Asserting only R-056
  would stay green against a list sorted by an unrelated field that happened to be monotonic;
  asserting only R-094 would stay green against a list of one.
- **Preconditions:** a registered account with a token.

**Steps:** POST /api/articles creating one article; POST /api/articles creating a second; GET
/api/articles?limit=20.
**Expected:** the `createdAt` values of the entries are in non-increasing order, and the second
article appears at a lower index than the first.

### C-025 — A list filter excludes the articles that do not match it
**Covers:** R-058, R-059, R-060

- **Grouping rationale:** the three filters are one dispatch over the query parameters, and the
  failure they share is the one that matters — the parameter is read and the collection comes
  back unfiltered. Each step names a subject created inside this case: a tag no other article
  carries, an author registered here, a favorite made here. The expected result is therefore
  exactly one known article, and an unfiltered answer is visible at once. That a filter also
  finds what it should is the other direction and is C-026.
- **Preconditions:** a registered account with a token and a known username; one article created
  by it carrying a tag string unique to this run; that article favorited by that account.

**Steps:** GET /api/articles?tag=:tag; GET /api/articles?author=:username; GET
/api/articles?favorited=:username.
**Expected:** every entry of the first response carries that tag in its `tagList`; every entry of
the second has `author.username` equal to that username; every entry of the third is the article
that account favorited.

### C-026 — A favorite is visible to the favorited filter
**Covers:** R-134

- **Grouping rationale:** the completeness direction of the filter C-025 checks for soundness.
  The two fail apart: a filter that ignores its parameter returns everything, which is red in
  C-025 and green here; a filter joined against the wrong relation returns nothing, which is
  green in C-025 and red here. This one also depends on the Favorite endpoint having done
  something, which C-025's tag and author steps do not.
- **Preconditions:** two registered accounts; an article created by the first; the second holds a
  token and a known username.

**Steps:** POST /api/articles/:slug/favorite with the second account's token; then GET
/api/articles?favorited=:username naming the second account.
**Expected:** the `articles` array contains an entry whose `slug` is that article's.

### C-027 — limit and offset cut a page out of the list
**Covers:** R-061, R-063, R-065

- **Grouping rationale:** one limit-and-offset clause. R-061 is that the page is capped, R-063
  that the offset skips from the front of the same query, R-065 that the count accompanying a
  page is never smaller than the page. A clause that is not applied fails R-061 and R-063
  together; a count computed after the cut rather than before fails R-065 alone — still the same
  query object and the same place to read. The steps run against a tag no other article carries,
  so "the same query without the offset" names a set this case created and nobody else is writing
  to. The two default values are not covered — see `## Not covered`.
- **Preconditions:** a registered account with a token; three articles created by it one after
  another, all carrying one tag string unique to this run.

**Steps:** GET /api/articles?tag=:tag; GET /api/articles?tag=:tag&limit=2; GET
/api/articles?tag=:tag&offset=1.
**Expected:** the unrestricted response lists the three articles; the limited response holds at
most two entries; the offset response's first entry is the second entry of the unrestricted one;
and in every one of the three, `articlesCount` is greater than or equal to the length of its own
`articles` array.

### C-028 — Timestamps are ISO-8601 in UTC
**Covers:** R-067

- **Grouping rationale:** the timestamp format is one serializer setting, shared by articles and
  comments and independent of every value it prints: a list can be ordered correctly and an
  update can move `updatedAt` while both are rendered as epoch seconds, and C-024, C-036 and
  C-041 would all stay green. Nothing else in this file looks at the shape of a timestamp.
- **Preconditions:** a registered account with a token; one article created by it, carrying one
  comment.

**Steps:** GET /api/articles/:slug; GET /api/articles/:slug/comments.
**Expected:** the `createdAt` and `updatedAt` of the article and of the comment all end in `Z`,
match an ISO-8601 timestamp, and parse to a valid date.

### C-029 — The feed carries nothing from an author the caller does not follow
**Covers:** R-070, R-071, R-074, R-075

- **Grouping rationale:** one query with one join. R-075 is R-071's limiting case — a caller who
  follows nobody is a caller for whom every author is unfollowed — so a feed that ignores the
  join fails both, one by returning articles to an empty follow set and the other by returning
  strangers' articles. R-070 and R-074 are the envelope and the summary serializer, which the
  feed shares with the list; they are asserted here because this is the only response that shows
  the feed's own copy of them, and a feed that answers with single articles has drifted from the
  list at exactly one place.
- **Preconditions:** two registered accounts, the second holding a token and following nobody; at
  least one article created by the first, whose username is known.

**Steps:** GET /api/articles/feed with the second account's token; then POST
/api/profiles/:username/follow naming the first account; then GET /api/articles/feed again.
**Expected:** both bodies carry an `articles` array and a numeric `articlesCount`; the first
array is empty and its count is 0; every entry of the second has `author.username` equal to the
followed account's; no entry of either has a `body` key.

### C-030 — An article by a followed author reaches the feed
**Covers:** R-076

- **Grouping rationale:** the completeness direction of C-029. A feed whose join returns nothing
  at all is green throughout C-029 — an empty page satisfies both "nothing from a stranger" and
  "empty when following nobody" — and only this case notices. It also depends on the follow and
  the creation having taken effect, which C-029's first step does not.
- **Preconditions:** two registered accounts with tokens, the second already following the first.

**Steps:** POST /api/articles with the first account's token; then GET /api/articles/feed with
the second account's token.
**Expected:** the `articles` array contains an entry whose `slug` is the created article's.

### C-031 — The feed is ordered and paginated like the list
**Covers:** R-072, R-073

- **Grouping rationale:** the feed's query is the list's query with a join added, so its ordering
  clause and its limit are a second copy of the same two clauses and drift together when that
  copy is edited. They are not part of C-029 because that case asserts membership only and would
  stay green with the order reversed and the limit ignored.
- **Preconditions:** two registered accounts, the second holding a token and following the first;
  two articles created by the first one after another.

**Steps:** GET /api/articles/feed with the second account's token; then GET
/api/articles/feed?limit=1 with the same token.
**Expected:** the `createdAt` values of the first response are in non-increasing order and the
newer of the two articles precedes the older; the second response holds at most one entry.

### C-032 — An article is fetched whole by the slug its creation returned
**Covers:** R-077, R-078, R-081, R-089

- **Grouping rationale:** one read of one article. R-089 is that the slug the creation handed back
  is an address that works, R-077 that the address answers with an article envelope, R-081 that
  the object carries exactly the ten Article fields, R-078 that `body` is among them and is a
  string. A slug that does not resolve, a missing envelope and a serializer that dropped `body`
  are three steps of one failure to hand back what was stored. R-081 is read here as governing
  the single-article response only: list entries are required to lack `body` by R-055, so the
  rule cannot govern both — see `## Open questions`.
- **Preconditions:** a registered account with a token; an article created by it whose title and
  returned slug are known.

**Steps:** GET /api/articles/:slug using the slug from the creation response.
**Expected:** the body carries an `article` object whose keys are exactly `slug`, `title`,
`description`, `body`, `tagList`, `createdAt`, `updatedAt`, `favorited`, `favoritesCount` and
`author`; `body` is a string; `title` is the title that was created.

### C-033 — Two articles with one title get two slugs
**Covers:** R-090

- **Grouping rationale:** it is the slug generator's collision handling and nothing else
  exercises it: every other case here creates titles that do not repeat and would stay green
  against a generator that returns the same slug twice — or against one that refuses the second
  article outright, which is the other way this can be wrong.
- **Preconditions:** a registered account with a token.

**Steps:** POST /api/articles twice with the same `article.title` and no other difference.
**Expected:** both responses carry an `article` object, and their `slug` values differ.

### C-034 — Creating an article returns the article the caller sent
**Covers:** R-082, R-086, R-087, R-091, R-092, R-093

- **Grouping rationale:** the create action and its serializer, in two requests. R-082 is the
  envelope, R-087 that the tags sent came back, R-091 that the author is the caller and not
  whoever the payload named, R-092 and R-093 the two favorite fields an article nobody has seen
  must start at. R-086 needs the second request, the one without `tagList`, and belongs here
  because "the field is optional" and "the field comes back as sent" are the same argument about
  the same field. A handler that drops the payload fails every line; a serializer that takes the
  author from the payload fails R-091 alone; both live in the create action.
- **Preconditions:** a registered account with a token and a known username.

**Steps:** POST /api/articles with a title, description, body and a `tagList` of two tags; then
POST /api/articles with a title, description and body and no `tagList`.
**Expected:** both responses carry an `article` object and neither is a 422; the first article's
`tagList` contains both tags sent; in both, `author.username` is the caller's username,
`favoritesCount` is 0 and `favorited` is false.

### C-035 — Creating an article refuses a request that omits a required field
**Covers:** R-083, R-084, R-085

- **Grouping rationale:** the article model's presence validators — three fields declared
  together and enforced in one pass, the same shape as C-010 at a different model. The 422 status
  and the errors envelope belong to C-010; what is under test here is which fields this endpoint
  insists on, and a red means this model's declaration is short one.
- **Preconditions:** a registered account with a token.

**Steps:** POST /api/articles three times with a valid article except one field — the first
without `article.title`, the second without `article.description`, the third without
`article.body`.
**Expected:** each response has status 422 with at least one entry under `errors`.

### C-036 — Updating an article changes the fields it was given and keeps the rest
**Covers:** R-095, R-096, R-099, R-103

- **Grouping rationale:** one write. R-096 is that a one-field payload is accepted, R-095 that the
  response carries the value written, R-099 that the field left out kept what it had, R-103 that
  `updatedAt` moved. All four are the update action's assignment: one that ignores the payload
  fails the first two, one that assigns over the whole record fails R-099, one that writes
  without touching the timestamp fails R-103, and there is a single action to read. The slug's
  reaction to a new title is C-037, because it is the one consequence that leaves this endpoint.
- **Preconditions:** a registered account with a token; an article created by it whose slug,
  description and `updatedAt` are known.

**Steps:** PUT /api/articles/:slug with `article.title` set to a new value and no other field.
**Expected:** the response is not a 422; its `article.title` is the value sent; its
`article.description` is the description the article already had; its `article.updatedAt` is
later than the value recorded before the request.

### C-037 — Changing the title moves the article to a new slug
**Covers:** R-097, R-098

- **Grouping rationale:** one fact seen from both ends. The slug is the article's address and the
  update regenerates it from the title, so a new address that works and an old address that
  stopped working are the same move. A generator that never runs leaves the response's slug equal
  to the path's and the old address still resolving, which is both rules red at once. They part
  only for an implementation that keeps old slugs as aliases, which would be R-098 alone; the
  rules do not allow that, and this case says so by asserting the 404.
- **Preconditions:** a registered account with a token; an article created by it whose slug is
  known.

**Steps:** PUT /api/articles/:slug with a new `article.title`; then GET /api/articles/:slug using
the slug from the request path; then GET /api/articles/:slug using the slug the update returned.
**Expected:** the update's `article.slug` differs from the slug in the request path; the read of
the old slug has status 404; the read of the new slug returns the article.

### C-038 — A deleted article is gone and the deletion returns no article
**Covers:** R-104, R-108

- **Grouping rationale:** one request and its consequence. R-108 reads the delete response and
  R-104 the read that follows it. A handler that answers with the article it was asked to remove
  is the same handler as one that answers and removes nothing — both are a delete that behaved
  like a read — and this pair of steps separates them without needing a second case.
- **Preconditions:** a registered account with a token; an article created by it.

**Steps:** DELETE /api/articles/:slug with the author's token; then GET /api/articles/:slug.
**Expected:** the delete response body contains no `article` object; the read has status 404.

### C-039 — Adding a comment returns the caller's Comment
**Covers:** R-109, R-110, R-113, R-123

- **Grouping rationale:** one write and its serializer. R-109 is the envelope, R-110 the five
  fields, R-123 that `id` is a JSON number and not a quoted string, R-113 that the author is the
  caller. A serializer that stringifies the identifier and one that omits `author` are the same
  object; R-113 sits here rather than alone because the only way it goes red without R-110 going
  red is an author taken from the payload, which is still this create action.
- **Preconditions:** two registered accounts; an article created by the first; the second holds a
  token and a known username.

**Steps:** POST /api/articles/:slug/comments with the second account's token and a
`comment.body`.
**Expected:** the body carries a `comment` object whose keys are exactly `id`, `createdAt`,
`updatedAt`, `body` and `author`; `id` is a JSON number; `body` is the text sent;
`author.username` is the second account's username.

### C-040 — A comment requires a body
**Covers:** R-111

- **Grouping rationale:** the comment model's only validator. It is separate from C-039 because a
  create action that stores what it was given and a create action that refuses what it was not
  are different halves of the handler: C-039 stays green when the validator is missing, and this
  stays green when the serializer is broken.
- **Preconditions:** a registered account with a token; an article whose slug is known.

**Steps:** POST /api/articles/:slug/comments with the token and an empty `comment` object.
**Expected:** status 422 with at least one entry under `errors`.

### C-041 — An article's comment list holds exactly the comments it has
**Covers:** R-114, R-116, R-118, R-119

- **Grouping rationale:** one list read three times, around the writes that change it. R-118 is
  the list of a fresh article, R-116 the list after a comment was added, R-119 the list after it
  was removed, R-114 the envelope all three use. Every one of them is the same index action and
  the association it reads: an association not scoped to the article fails R-118 and R-116 alike,
  and a delete that does not delete fails R-119 while the rest stay green — still in the same
  controller. The 404 for an unknown slug is C-006 and the ownership check is C-008.
- **Preconditions:** a registered account with a token; an article created by it that carries no
  comments yet.

**Steps:** GET /api/articles/:slug/comments; POST /api/articles/:slug/comments with a body,
keeping the returned identifier; GET the comments again; DELETE
/api/articles/:slug/comments/:id with the author's token; GET the comments a third time.
**Expected:** every body's only key is `comments` and it holds an array; the first array is
empty; the second contains an entry whose `id` is the returned one; the third does not.

### C-042 — Favoriting marks the article and raises its count
**Covers:** R-124, R-125, R-126, R-128

- **Grouping rationale:** one write. R-128 is that it carries no payload, R-124 the envelope,
  R-125 that the article now reports itself favorited to this caller, R-126 that
  `favoritesCount` went up by exactly one. A handler that records nothing fails R-125 and R-126
  together; one that records the favorite twice fails R-126 alone; both are the same relation
  write. What the list filter makes of the same favorite is C-026, because that is another query.
- **Preconditions:** two registered accounts; an article created by the first, whose
  `favoritesCount` is known; the second holds a token.

**Steps:** POST /api/articles/:slug/favorite with the second account's token and an empty request
body.
**Expected:** the body carries an `article` object; its `favorited` is true; its
`favoritesCount` is one greater than the value recorded before the request.

### C-043 — Unfavoriting clears the mark and lowers the count
**Covers:** R-129, R-130, R-131

- **Grouping rationale:** the mirror of C-042 at a different handler, which can be absent or
  wrong on its own; inside it the envelope, the flag and the decrement are one answer to one
  request and cannot come apart.
- **Preconditions:** two registered accounts; an article created by the first and already
  favorited by the second, whose `favoritesCount` is then known; the second holds a token.

**Steps:** DELETE /api/articles/:slug/favorite with the second account's token.
**Expected:** the body carries an `article` object; its `favorited` is false; its
`favoritesCount` is one smaller than the value recorded before the request.

### C-044 — The tag endpoint returns an array of strings
**Covers:** R-135, R-137

- **Grouping rationale:** one response and its shape — a body whose only key is `tags`, holding an
  array, whose entries are strings rather than objects. An endpoint that serializes tag records
  instead of tag names fails both rules in the same breath, and there is one serializer to go and
  read.
- **Preconditions:** at least one article carrying at least one tag exists; create one so the
  array is not empty and the assertion about its entries is not vacuous.

**Steps:** GET /api/tags.
**Expected:** the body's only key is `tags`; it holds an array; every entry is a JSON string.

### C-045 — A tag introduced by a new article becomes a known tag
**Covers:** R-138

- **Grouping rationale:** C-044 reads the tag list and would stay green against a list that never
  grows; this is the only place the write side of tags is exercised, and it is a different piece
  of code — the create action's handling of `tagList` — from the endpoint that lists them.
- **Preconditions:** a registered account with a token.

**Steps:** POST /api/articles with a `tagList` holding one tag string unique to this run; then
GET /api/tags.
**Expected:** the `tags` array contains that tag.

## Not covered

- **R-034** — "`PUT /api/user` carrying only fields drawn from `email`, `username`, `password`,
  `image` and `bio` is not answered 422." Read as written, R-039 contradicts it: a request that
  sets `email` to an address another account holds carries only accepted fields and must be
  answered 422. The rule becomes testable only under a reading it does not state — that it is
  about field names and not about values — and adopting that reading here would be amending a
  rule that belongs to the BA agent. What it was reaching for is already asserted by R-033 and
  R-036 in C-016.
- **R-062** — "`GET /api/articles` with no `limit` returns at most 20 entries." The assertion is
  satisfied by any deployment holding fewer than twenty articles, so a green says nothing unless
  the test first establishes that the collection is larger than one page. The only figure the API
  offers for that is `articlesCount`, and Open question 3 of `01-rules.md` records that its
  meaning is undeclared — it may be the size of the page itself. Establishing the precondition by
  creating twenty-one articles is a cost this rule does not repay.
- **R-064** — "`GET /api/articles` and `GET /api/articles?offset=0` return the same first entry."
  Both requests read the unfiltered global list, which any other caller may write to between
  them. Nothing in the rules gives a test a way to hold that list still, so the assertion is a
  race whose red would read "somebody published an article", not "the default offset is wrong".
  R-063, in C-027, covers what the offset parameter actually does, against a set this suite
  created.

## Open questions

1. **R-081 and R-055 contradict each other if R-081 is read broadly.** R-081 says a returned
   `article` object has exactly ten fields, `body` among them; R-055 says no entry of the article
   list has a `body` field. C-032 reads R-081 as governing the single-article response only. The
   BA agent should say which responses it governs.
2. **R-011 asks for a preflight header on every cross-origin response.** It requires both
   `Access-Control-Allow-Origin` and `Access-Control-Allow-Headers` on "a response to a request
   carrying an `Origin` header". C-002 satisfies it on a preflight, where both headers are
   defined. Read as a statement about every cross-origin response it would also demand
   `Access-Control-Allow-Headers` on an ordinary GET, which is not a header that mechanism sends
   there. The rule wants splitting in two.
3. **R-009 names a set the rules never enumerate.** It governs "an endpoint marked Authentication
   optional", and `01-rules.md` nowhere lists which endpoints carry that marking. C-005
   reconstructs the set from R-017, R-025, R-042, R-057, R-079, R-115 and R-136; if the
   specification marks another endpoint that way, this file cannot know. R-004, R-005 and R-006
   have the same shape, but their instances are enumerated by the per-endpoint rules, so they
   were recoverable.
4. **"Succeeds" is undefined.** R-017, R-025, R-048 and R-128 say a request "succeeds", while
   Open question 1 of `01-rules.md` records that no success status is documented anywhere. Every
   case here reads "succeeds" as "answers with the envelope that endpoint's own rule names, and
   is not an error status". No status assertion can be written until the rules make the choice.
5. **R-026 and R-027 are satisfied by a crash.** They assert only the absence of a token, so any
   response without a `user` object passes — a 500 included. The rules decline to name a status
   for a failed login and this file does not add one, but the resulting assertions are weak by
   construction, and a green in C-015 should not be read as evidence that a failed login is
   handled well.
6. **R-103 depends on a timestamp resolution no rule states.** It requires `updatedAt` to be
   later after an update. The examples behind R-067 carry milliseconds and C-036 assumes that; at
   second resolution a fast update would be indistinguishable from one that never moved the
   field.
7. **R-005 names no action.** It gives 403 to "a caller who lacks permission" without saying which
   permissions exist. C-007 and C-008 take the three owner-only actions named by R-101, R-106 and
   R-121 to be the whole of it. If the API has another permission, no rule in the file describes
   it.
