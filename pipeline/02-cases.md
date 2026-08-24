# Conduit test cases

The rules in `pipeline/01-rules.md` grouped into units of independent failure. A case is one
place the implementation can be wrong: two rules share a case when a red on either sends the
reader to the same guard, serializer, query or validator, and one rule is split across two cases
when it can fail in two directions that a single response cannot tell apart.

## Cases

### C-001 — A token the API issued authenticates as its account

**Covers:** R-001, R-021, R-054, R-064

- **Grouping rationale:** all four describe one path: the string under `user.token` is handed
  back to the API in the `Authorization` header and resolves to the account it was issued for. A
  red anywhere here is the credential pipeline — token minting on one side, header parsing and
  verification on the other — and it does not matter which of the two endpoints minted the token,
  because a login token and a registration token are the same artefact by R-021.
- **Preconditions:** an account that can be registered and then logged in as.

**Steps:** Register an account and keep the token from the response. Send `GET /api/user` with
that token in the `Authorization` header under the `Token` scheme. Log in as the same account and
send `GET /api/user` again with the token the login returned.
**Expected:** Both authenticated requests are carried out rather than refused, and each answers
with the user document of the account the token was issued for.

### C-002 — Every authentication-required endpoint refuses a request with no credentials

**Covers:** R-003, R-070, R-073, R-092, R-099, R-118, R-130, R-146, R-156, R-162, R-175, R-181,
R-189

- **Grouping rationale:** these twelve are one general rule and its eleven instances, and they
  break for one reason: a route that was never wired to the guard, or a guard that stopped
  refusing. The diagnosis is the same line of the route table in every instance, which is why
  they are swept in one case rather than eleven; what the case is really asserting is that the
  set of guarded routes equals the set the specification marks "Authentication required".
- **Preconditions:** an article with at least one comment on it, so that the mutating endpoints
  have a real path to address.

**Steps:** With no `Authorization` header, send `GET /api/user`, `PUT /api/user`,
`POST /api/profiles/:username/follow`, `DELETE /api/profiles/:username/follow`,
`GET /api/articles/feed`, `POST /api/articles`, `PUT /api/articles/:slug`,
`DELETE /api/articles/:slug`, `POST /api/articles/:slug/comments`,
`DELETE /api/articles/:slug/comments/:id`, `POST /api/articles/:slug/favorite` and
`DELETE /api/articles/:slug/favorite`, each against an existing target.
**Expected:** Every one of the twelve is answered with 401, and none of the mutating ones changes
the resource it addressed.

### C-003 — A credential that is present but unusable is refused

**Covers:** R-002, R-004

- **Grouping rationale:** separated from C-002 because the code is elsewhere. C-002 exercises the
  branch that fires when the header is absent; these two exercise the branch that reads a header
  that is there and decides it means nothing — the wrong scheme, and a token the API did not
  issue or no longer accepts. An implementation that answers 401 whenever the header is missing
  and waves through anything that parses passes C-002 and fails here, which is exactly the
  failure a single anonymous request cannot see.
- **Preconditions:** a registered account holding a token the API accepts.

**Steps:** Send `GET /api/user` three times: once with the valid token under a `Bearer` scheme
instead of `Token`, once with a syntactically plausible string that the API never issued, and
once with the `Token` scheme but an empty value.
**Expected:** Each of the three is answered with 401 and none of them returns a user document.

### C-004 — A token addresses its own account and no other

**Covers:** R-005

- **Grouping rationale:** R-005 fails independently of every other authentication rule because it
  needs two accounts to be visible at once. C-001 stays green on an implementation that resolves
  every token to the same stored account, or to the most recently created one, since it only ever
  has one account in play; only a comparison between two live tokens shows it. A red here is the
  token-to-subject lookup, not the header parsing C-003 covers.
- **Preconditions:** two registered accounts with distinct usernames and emails, each holding its
  own token.

**Steps:** Send `GET /api/user` with the first account's token, then `GET /api/user` with the
second account's token.
**Expected:** Each response names the account whose token was sent — its own username and email —
and the two responses describe different accounts.

### C-005 — Endpoints that require no authentication serve an anonymous request

**Covers:** R-006, R-049, R-058, R-126, R-196

- **Grouping rationale:** the mirror image of C-002 and the same diagnosis in the other
  direction: a guard applied to a route the specification marks "No authentication required". A
  guard that refuses everything passes C-002 and fails this; a guard applied to nothing passes
  this and fails C-002. Neither case can see the other's failure, so the pair has to exist. All
  five instances are read from the same list, so a red says the route table, not the endpoint.
- **Preconditions:** an existing account whose credentials are known, and an existing article.

**Steps:** With no `Authorization` header, send `POST /api/users/login` with valid credentials,
`POST /api/users` with a fresh account, `GET /api/articles/:slug` for the existing article and
`GET /api/tags`.
**Expected:** None of the four is answered with 401; each answers with the document its endpoint
is documented to return.

### C-006 — Endpoints with optional authentication serve an anonymous request

**Covers:** R-007, R-086, R-105, R-170

- **Grouping rationale:** kept apart from C-005 because the specification draws the distinction
  and the implementation usually does too: these routes carry a middleware that may read a token,
  where C-005's carry none at all. A red here is that optional middleware refusing instead of
  shrugging, which is a different line from a guard that should not be on the route. The four
  instances share it, so one case covers them.
- **Preconditions:** an existing account, and an existing article with at least one comment.

**Steps:** With no `Authorization` header, send `GET /api/profiles/:username` for the existing
account, `GET /api/articles`, and `GET /api/articles/:slug/comments` for the existing article.
**Expected:** None is answered with 401; each answers with the profile, the article list and the
comment list respectively.

### C-007 — An optional-authentication endpoint answers as the token's user

**Covers:** R-008, R-089, R-090

- **Grouping rationale:** the completeness half of C-006. C-006 only proves the endpoint does not
  refuse; an implementation that discards the token entirely stays green there and green on C-008
  too, because both expect the anonymous reading. What shows it is a field that has to differ
  between two authenticated callers, and `following` on a profile is that field — R-089 and R-090
  are its two values. All three fail together on one thing: the optional middleware not putting
  the caller into the serializer's context.
- **Preconditions:** two registered accounts, the first following the second and the second
  following nobody.

**Steps:** Send `GET /api/profiles/:username` for the second account, authenticated as the first.
Send `GET /api/profiles/:username` for the first account, authenticated as the first account
itself — a request whose subject the caller does not follow.
**Expected:** The first response reports `following` as `true`; the second reports `following` as
`false`. Neither is refused.

### C-008 — Viewer-relative fields are false when nobody is identified

**Covers:** R-009, R-116

- **Grouping rationale:** the soundness half of the pair whose completeness half is C-007. One
  failure mode: a serializer that computes a relationship without a caller, or that carries over a
  value from some other request. It shows up on both the single documents and the list entries
  for the same reason, so R-009 and R-116 are one case; what they cannot share a case with is
  C-007, because an implementation that hard-codes `false` passes here and fails there.
- **Preconditions:** an account that follows another account and has favorited an article, so
  that a `true` is available for the authenticated reading to produce.

**Steps:** With no `Authorization` header, send `GET /api/profiles/:username` for the followed
account, `GET /api/articles/:slug` for the favorited article and `GET /api/articles` covering it.
**Expected:** `profile.following` is `false`, `article.favorited` is `false`, and `favorited` is
`false` on every entry of the list, including the entry for the article that some account has
favorited.

### C-009 — A carried-out request answers 200 and declares JSON

**Covers:** R-015, R-016

- **Grouping rationale:** both are properties of the response line and headers rather than of any
  endpoint's logic, and both are set in the one place every handler returns through. A red on
  either says the transport layer changed under all the endpoints at once, which is why they are
  read together across a sample of them rather than restated inside every other case. Nothing
  else in this file asserts a success status, so without this case a run of 201s would go
  unnoticed.
- **Preconditions:** a registered account with a token, and an article it authored.

**Steps:** Send `GET /api/tags`, `GET /api/articles`, `GET /api/articles/:slug`, `GET /api/user`
with a token, and `POST /api/articles` with a valid body and a token.
**Expected:** Every response carries status 200 and a `Content-Type` of
`application/json; charset=utf-8`.

### C-010 — A validation failure is 422 in the errors envelope

**Covers:** R-010, R-011, R-012

- **Grouping rationale:** one renderer. The status, the single `errors` key and the array-valued
  entries under it are produced by the same branch, and a red on any of the three means that
  branch is wrong — a different status, a bare message, a string where a list belongs. Splitting
  the status from the shape would send the reader to the same function twice. The individual
  endpoints' validators get their own cases; this one asserts only how a validator's verdict is
  rendered.
- **Preconditions:** none.

**Steps:** Send `POST /api/users` with a `user` object missing every required field.
**Expected:** The response carries status 422 and a body whose only top-level key is `errors`,
whose value is an object, each of whose values is an array of strings.

### C-011 — A failure response carries no resource document

**Covers:** R-017

- **Grouping rationale:** the soundness half of C-010, and it fails on code C-010 never touches:
  a handler that renders the error alongside a partially built resource, or an error path that
  falls through into the success serializer. C-010 only inspects `errors` and stays green while
  an `article` key sits beside it. Stated as one case because the leak is one behaviour whether
  the failure was a 401, a 403, a 404 or a 422.
- **Preconditions:** two registered accounts, and an article authored by the first.

**Steps:** Collect the bodies of four failures: `GET /api/user` with no token,
`PUT /api/articles/:slug` for the first account's article authenticated as the second,
`GET /api/articles/:slug` for a slug no article holds, and `POST /api/users` with an empty `user`
object.
**Expected:** Each body carries `errors` and none of them carries any of `user`, `profile`,
`article`, `articles`, `comment`, `comments` or `tags`.

### C-012 — A mutation by an account that is not the owner is refused with 403

**Covers:** R-013, R-150, R-159, R-177

- **Grouping rationale:** the ownership guard and its three instances. A red on any of them is
  the same comparison — the authenticated account against the resource's author — reached from
  three controllers; the general rule R-013 has no other place in the specification where it can
  be observed, so it belongs with the instances that observe it. The distinction from C-014 to
  C-016 matters: those are lookups that find nothing, this is a lookup that finds something and
  then refuses.
- **Preconditions:** two registered accounts; an article authored by the first with a comment on
  it also written by the first; a token for the second.

**Steps:** Authenticated as the second account, send `PUT /api/articles/:slug` with a new title,
`DELETE /api/articles/:slug`, and `DELETE /api/articles/:slug/comments/:id` against the first
account's article and comment.
**Expected:** Each of the three is answered with 403.

### C-013 — A refused mutation leaves the resource as it was

**Covers:** R-150, R-159, R-177

- **Grouping rationale:** the second failure mode of the same three rules, and it is independent
  of C-012 in both directions. An implementation that mutates and then discovers it should not
  have, returning 403 afterwards, is green on C-012 and red here; one that refuses correctly but
  where the reader never checks is green on both while the data rots. C-012 reads a status; this
  case reads the resource afterwards, and only the second reading can tell a guard that runs
  before the write from one that runs after it.
- **Preconditions:** the same as C-012, with the article's title, body and comment recorded
  before the refused requests are sent.

**Steps:** Run the three refused requests of C-012, then, authenticated as the first account,
send `GET /api/articles/:slug` and `GET /api/articles/:slug/comments` for the same article.
**Expected:** The article is still fetchable under its original slug with the title, description
and body it had before, and the comment is still present in the comment list with its original
identifier.

### C-014 — A path naming an account nobody holds is answered with 404

**Covers:** R-014, R-088, R-096, R-103

- **Grouping rationale:** one lookup — resolve a `:username` segment to an account — reached from
  three routes, plus the general rule the three instantiate. A red on any of them says that
  lookup returned something instead of refusing, or that a route forgot to consult it and
  operated on a null subject. Kept apart from C-015 and C-016 because those are different
  lookups against different stores, and a repository that resolves usernames correctly can still
  resolve slugs wrongly.
- **Preconditions:** a registered account holding a token, and a username string no account holds.

**Steps:** Send `GET /api/profiles/:username` anonymously for the unheld username, and,
authenticated, `POST /api/profiles/:username/follow` and
`DELETE /api/profiles/:username/follow` for the same unheld username.
**Expected:** All three are answered with 404.

### C-015 — A path naming a slug no article holds is answered with 404

**Covers:** R-128, R-151, R-160, R-167, R-172, R-185, R-193

- **Grouping rationale:** the article lookup, reached from seven routes. Every one of these seven
  is the same two lines — find the article by slug, refuse if there is none — and a red says
  either that the lookup is wrong or that one route ran its handler on a missing article. Sweeping
  them together is deliberate: what the case is really checking is that no route skipped the
  lookup, and that is a property of the set, not of any single endpoint.
- **Preconditions:** a registered account holding a token, and a slug string no article holds.

**Steps:** Send `GET /api/articles/:slug` and `GET /api/articles/:slug/comments` anonymously for
the unheld slug, and, authenticated, `PUT /api/articles/:slug` with a new title,
`DELETE /api/articles/:slug`, `POST /api/articles/:slug/comments` with a valid body,
`POST /api/articles/:slug/favorite` and `DELETE /api/articles/:slug/favorite`.
**Expected:** All seven are answered with 404.

### C-016 — A comment identifier that addresses nothing under that slug is 404

**Covers:** R-178, R-179

- **Grouping rationale:** the comment lookup, which is the only one of the three that takes two
  path segments, and both rules are ways for it to be wrong. R-178 is an identifier that matches
  no comment; R-179 is an identifier that matches a comment belonging to another article — the
  failure of an implementation that keys on `:id` alone and ignores `:slug`. They are one case
  because both reds land on the same query and the fix to either is the same missing condition.
- **Preconditions:** two articles authored by the same registered account, the first carrying a
  comment by that account, the second carrying none.

**Steps:** Authenticated as the comment's author, send
`DELETE /api/articles/:slug/comments/:id` against the first article with an identifier no comment
holds, then against the second article's slug with the identifier of the comment on the first
article. Afterwards send `GET /api/articles/:slug/comments` for the first article.
**Expected:** Both delete requests are answered with 404, and the comment is still present in the
first article's comment list.

### C-017 — A selection that matches nothing is an empty document, not a 404

**Covers:** R-115, R-123, R-171

- **Grouping rationale:** one decision taken in three collection handlers: whether an empty result
  set means the collection is missing. A red on any of them is a handler that treats zero rows as
  not-found, and the reader goes to the same conditional each time. Kept out of C-015 because
  that case is about a path that names nothing, while these three name a collection that exists
  and happens to hold nothing — the two are opposite verdicts on similar-looking requests, and an
  implementation that confuses them fails exactly one of the pair.
- **Preconditions:** a registered account that follows nobody; an article by another author with
  no comments on it; a tag string no article carries.

**Steps:** Send `GET /api/articles?tag=X` with the unused tag, `GET /api/articles/feed`
authenticated as the account that follows nobody, and `GET /api/articles/:slug/comments` for the
article with no comments.
**Expected:** The first two answer with an empty `articles` array and `articlesCount` of 0; the
third answers with an empty `comments` array. None of the three is answered with 404.

### C-018 — The user document carries its five fields

**Covers:** R-018, R-019, R-020

- **Grouping rationale:** one serializer. The `user` wrapper, the five fields inside it and the
  admission that `bio` and `image` may be `null` are decided in the same function, and a red on
  any of them is that function's field list or a type coercion inside it. Every endpoint that
  returns a User goes through it, so the case reads several of them rather than repeating the
  assertion in C-026, C-029, C-033 and C-034.
- **Preconditions:** an account that can be registered, logged in as, read back and updated.

**Steps:** Collect the bodies of `POST /api/users`, `POST /api/users/login`, `GET /api/user` and
`PUT /api/user` for one account.
**Expected:** Each body's only top-level key is `user`; that object carries `email`, `token`,
`username`, `bio` and `image`; the first three are strings; `bio` and `image` are each either a
string or `null`.

### C-019 — No response carries a password

**Covers:** R-022

- **Grouping rationale:** the soundness half of C-018, and it fails on the opposite mistake. C-018
  asks whether the five documented fields are there and stays green on a serializer that returns
  the stored row untouched, which is precisely the serializer that leaks the password. A case
  that enumerates required fields can never see an extra one; only a case that looks for
  something that must be absent can.
- **Preconditions:** an account registered with a known password and then updated with a new one.

**Steps:** Collect the bodies of `POST /api/users`, `POST /api/users/login`, `GET /api/user` and
a `PUT /api/user` that sent a new password.
**Expected:** No key anywhere in any of the four bodies holds either password that was sent, and
the user object carries no field beyond the five the user document is documented to have.

### C-020 — The profile document carries its four fields

**Covers:** R-023, R-024, R-025

- **Grouping rationale:** the profile serializer, which is a different function from C-018's and
  is reached from three routes. The wrapper key, the four fields and the JSON type of `following`
  fail together, because all three are that function's output shape; `following` is called out
  separately in the rules only because a string `"false"` is the mistake this shape invites. What
  the case does not assert is the value of `following` — that is the caller-relative logic of
  C-007 and C-008, and it lives elsewhere.
- **Preconditions:** two registered accounts.

**Steps:** Send `GET /api/profiles/:username` anonymously, then
`POST /api/profiles/:username/follow` and `DELETE /api/profiles/:username/follow` authenticated as
the other account, and collect all three bodies.
**Expected:** Each body's only top-level key is `profile`; that object carries `username`, `bio`,
`image` and `following`; `username` is a string, `bio` and `image` are strings or `null`, and
`following` is a JSON boolean.

### C-021 — The single-article document carries its ten fields and its body

**Covers:** R-026, R-027, R-028, R-029, R-030, R-032, R-033, R-034, R-127

- **Grouping rationale:** the single-article serializer, top to bottom. The wrapper key, the ten
  fields, the JSON types of `tagList`, `favorited`, `favoritesCount` and `slug`, the shape of the
  embedded author and the parseability of the two timestamps are all decisions of that one
  function, and a red on any of them sends the reader to the same field list. R-127 belongs here
  rather than with C-023: `body` present on the single document and `body` absent from a list
  entry are decisions of two different serializers, and this case owns the first.
- **Preconditions:** an existing article created with at least one tag.

**Steps:** Send `GET /api/articles/:slug` for the article and read the body of the response.
**Expected:** The only top-level key is `article`; it carries `slug`, `title`, `description`,
`body`, `tagList`, `createdAt`, `updatedAt`, `favorited`, `favoritesCount` and `author`; `slug`
is a string, `tagList` is an array of strings, `favorited` is a boolean, `favoritesCount` is a
number, `createdAt` and `updatedAt` parse as ISO-8601 instants in UTC, and `author` carries
`username`, `bio`, `image` and `following`.

### C-022 — The multiple-articles document carries its envelope and its entries

**Covers:** R-037, R-038, R-040

- **Grouping rationale:** the list serializer, which is not the one C-021 covers. The two-key
  envelope, the numeric count and the nine fields on each entry come out of it together, and a red
  says that function. Kept separate from C-021 because an implementation can have a correct
  single-article document and a list that wraps it wrongly, or a correct envelope around entries
  that lost half their fields, and neither case would notice the other's failure.
- **Preconditions:** at least two articles exist, at least one of them carrying a tag.

**Steps:** Send `GET /api/articles` and read the body.
**Expected:** The body's top-level keys are exactly `articles` and `articlesCount`; `articles` is
an array; `articlesCount` is a JSON number; every entry carries `slug`, `title`, `description`,
`tagList`, `createdAt`, `updatedAt`, `favorited`, `favoritesCount` and `author`.

### C-023 — A listed article carries no body

**Covers:** R-039

- **Grouping rationale:** the soundness half of C-022 and the one assertion that case structurally
  cannot make. C-022 checks that nine named fields are present and is green on a list handler that
  returns whole articles; only a check for an absent field catches that. It is worth its own case
  because the mistake is the commonest one here — reusing the single-article serializer for the
  list — and because it has to be observed on both list endpoints, which C-022 does not visit.
- **Preconditions:** a registered account that follows an author who has at least one article, so
  that the feed is not empty.

**Steps:** Send `GET /api/articles` anonymously and `GET /api/articles/feed` authenticated as
that account.
**Expected:** No entry of the `articles` array of either response carries a `body` field.

### C-024 — The comment documents carry their fields and their envelopes

**Covers:** R-041, R-042, R-043, R-045

- **Grouping rationale:** the comment serializer and the two wrappers it is placed in. The single
  document's `comment` key, the list's `comments` key, the five fields and the numeric identifier
  are one function plus the two callers that wrap its output, and a red on any of them lands on
  that function's field list. The identifier's type is grouped in rather than split out because
  a string identifier is the same serializer bug as a missing field, not a different one — what
  the identifier can be used for is C-078's business.
- **Preconditions:** an article with at least one comment on it.

**Steps:** Collect the body of the `POST /api/articles/:slug/comments` that created the comment
and the body of a later `GET /api/articles/:slug/comments` for the same article.
**Expected:** The first body's only top-level key is `comment`; the second's is `comments`,
holding an array. Every comment object carries `id`, `createdAt`, `updatedAt`, `body` and
`author`, with `id` a JSON number, `body` a string and `author` carrying the four profile fields.

### C-025 — The tags document is an array of strings under one key

**Covers:** R-046, R-047, R-195

- **Grouping rationale:** the smallest serializer in the API, and all three rules are the same
  statement about it — that the endpoint answers, that the answer's single key is `tags`, and that
  the value is an array of strings. There is no way for one of the three to be red while the other
  two are green, so splitting them would be three readings of one line. What the tag list
  contains is C-066 and C-067; this case is only its shape.
- **Preconditions:** at least one article carrying at least one tag exists.

**Steps:** Send `GET /api/tags` with no `Authorization` header.
**Expected:** The body's only top-level key is `tags`, its value is an array, and every entry of
that array is a string.

### C-026 — Login with an account's credentials answers with that account

**Covers:** R-048, R-050, R-053

- **Grouping rationale:** the login success path. The endpoint reads a `user`-wrapped body,
  verifies it and answers with a User document for the account that was named; a red on any of the
  three is that handler — an unwrapped body it cannot read, a refusal where it should succeed, or
  a document describing somebody else. R-053 is grouped in rather than split out because it is
  what makes the response the right one, and the handler that would return the wrong account is
  the same handler.
- **Preconditions:** two registered accounts with known credentials.

**Steps:** Send `POST /api/users/login` with a body whose single top-level key is `user`, holding
the first account's email and password.
**Expected:** The request is carried out and answers with a user document whose `email` is the
email that was sent, and which is not the second account's.

### C-027 — Login refuses a body with no email or no password

**Covers:** R-051, R-052

- **Grouping rationale:** the login validator, one function with two required fields. A red on
  either means that function is not checking presence, and the reader goes to the same list of
  required names. Separate from C-028 because a missing field and a wrong value are decided at
  different moments — the validator runs before anything is looked up — and an implementation
  that treats an absent password as an empty one fails here while passing there.
- **Preconditions:** none.

**Steps:** Send `POST /api/users/login` with a `user` object holding only a password, then with a
`user` object holding only an email.
**Expected:** Both are answered with 422 and an `errors` envelope, and neither returns a user
document.

### C-028 — Login refuses an unknown email and a wrong password

**Covers:** R-055, R-056

- **Grouping rationale:** the credential check, which runs after C-027's validator has passed.
  Both rules are the same verdict reached by the two branches of one comparison — no such account,
  or an account whose stored secret does not match — and the rules deliberately state only that
  no user document comes back, because the specification never says which status a failed login
  carries. A red on either is that check being skipped or inverted, which is the same defect
  whichever branch exposed it.
- **Preconditions:** a registered account with a known password.

**Steps:** Send `POST /api/users/login` with an email no account holds and any password, then
with the registered account's email and a password that is not its own.
**Expected:** Neither response is a success, and neither body carries a `user` key.

### C-029 — Registration creates and echoes the account it was given

**Covers:** R-057, R-059, R-063, R-065

- **Grouping rationale:** the registration success path. The `user`-wrapped body, the User
  document that comes back, the username and email being the ones that were sent and the two
  fields registration cannot set coming back as `null` are all the same handler's doing. R-065 sits
  here rather than in C-018 because C-018 accepts a string or `null` for `bio` and `image` by
  R-020, and only at the moment of creation is `null` the required value.
- **Preconditions:** a username and an email no account holds.

**Steps:** Send `POST /api/users` with a body whose single top-level key is `user`, holding the
username, the email and a password.
**Expected:** The request is carried out and answers with a user document whose `username` and
`email` are the values that were sent, and whose `bio` and `image` are both `null`.

### C-030 — Registration refuses a body missing a required field

**Covers:** R-060, R-061, R-062

- **Grouping rationale:** the registration validator, one function with three required fields. A
  red on any of the three is the same list of required names, and which of the three was omitted
  tells the reader nothing extra. Held apart from C-031, whose refusal comes from a uniqueness
  lookup rather than from a presence check, and which an implementation can get wrong while this
  one is green.
- **Preconditions:** none.

**Steps:** Send `POST /api/users` three times, each with a `user` object holding two of the three
required fields and omitting the third.
**Expected:** Each of the three is answered with 422 and an `errors` envelope, and no account is
created.

### C-031 — Registration refuses an email or a username another account holds

**Covers:** R-066, R-067

- **Grouping rationale:** the uniqueness constraint at creation, over the two columns the rest of
  the API addresses accounts by. A red on either means the constraint is missing or is checked
  only on one column, and the reader goes to the same lookup. The consequence is what makes them
  one case: a second holder of either value makes login ambiguous and the profile path ambiguous,
  so the two rules are one requirement seen from two endpoints.
- **Preconditions:** a registered account whose username and email are known.

**Steps:** Send `POST /api/users` with the existing account's email and a fresh username, then
with a fresh email and the existing account's username.
**Expected:** Both are answered with 422 and an `errors` envelope, and neither creates an account.

### C-032 — The credentials a registration was given log in afterwards

**Covers:** R-068

- **Grouping rationale:** the only rule that crosses registration and login, and it fails where
  neither C-026 nor C-029 looks. C-029 reads the registration response and never presents the
  password again; C-026 uses an account that already exists and says nothing about how it came to.
  A registration that stores the password in a form the login comparison cannot reproduce is green
  on both and red only here, and the diagnosis is the shared password handling rather than either
  endpoint.
- **Preconditions:** none.

**Steps:** Send `POST /api/users` with a fresh username, email and password, then send
`POST /api/users/login` with that same email and password.
**Expected:** The login is carried out and answers with a user document whose `email` and
`username` are the ones the registration was given.

### C-033 — The current-user endpoint reports what the account holds

**Covers:** R-069, R-071

- **Grouping rationale:** one read handler. R-069 is that it answers with the caller's document
  and R-071 is that the values in it are the current ones rather than a snapshot; both are the
  same query being right. Separated from C-036, which asserts that a write persisted: a read that
  serves a stale cache fails here on values nothing else changed, while an update that never
  committed fails there — the two reds point at the read side and the write side respectively.
- **Preconditions:** a registered account holding a token, whose bio has been set to a known
  value.

**Steps:** Send `GET /api/user` with that account's token.
**Expected:** The response is the user document of that account, carrying the `email`, `username`
and `bio` the account currently holds, including the bio that was set.

### C-034 — An update reports the fields it was sent

**Covers:** R-072, R-074, R-075, R-076

- **Grouping rationale:** the update handler's success path and the completeness half of its merge.
  The `user`-wrapped body, the five accepted names, the User document that comes back and the new
  values inside it are one function; a field that is silently dropped and a field the handler does
  not recognise are the same red. What this case cannot see is a merge that overwrites the fields
  it was not given, which is why C-035 exists.
- **Preconditions:** a registered account holding a token, with known current values.

**Steps:** Send `PUT /api/user` with a body whose single top-level key is `user`, holding new
values for all five accepted fields.
**Expected:** The response is a user document for the same account carrying the new `email`,
`username`, `bio` and `image` that were sent.

### C-035 — An update leaves the fields it was not sent alone

**Covers:** R-077, R-084

- **Grouping rationale:** the soundness half of C-034's merge, and the two rules are its ordinary
  and its extreme case. An implementation that assigns the whole `user` object over the stored
  record clears every omitted field and stays green on C-034, which only ever looks at what it
  sent. R-084 belongs with R-077 rather than with C-030: an empty update is the same merge with
  nothing in it, and a 422 for it would mean the handler has invented a required field.
- **Preconditions:** a registered account holding a token, whose bio and image are set to known
  values.

**Steps:** Send `PUT /api/user` carrying only a new email, then send `PUT /api/user` with a `user`
object carrying none of the accepted fields, then send `GET /api/user`.
**Expected:** The first response keeps the account's previous username, bio and image. The second
is carried out rather than answered with 422 and returns the document unchanged. The final read
shows the new email and the untouched bio and image.

### C-036 — An update outlives the request that made it

**Covers:** R-078

- **Grouping rationale:** the write half of the update, which C-034 and C-035 both miss because
  they read only the response the writing request returned. A handler that renders the merged
  document and never commits is green on both and red only when a later request under a fresh
  connection asks again. The diagnosis is the persistence layer, not the merge.
- **Preconditions:** a registered account holding a token.

**Steps:** Send `PUT /api/user` with a new bio and a new image, then send `GET /api/user` as the
same account in a later request.
**Expected:** The later read reports the bio and the image the update sent.

### C-037 — A new password logs in

**Covers:** R-079

- **Grouping rationale:** the completeness half of a password change. It is the only rule under
  which changing `password` has any observable effect at all, since C-019 forbids the value from
  ever appearing in a response. It fails independently of C-038: an implementation that writes the
  new secret without retiring the old one is green here and red there, and one that clears the
  stored secret entirely is red here and green there.
- **Preconditions:** a registered account holding a token and a known current password.

**Steps:** Send `PUT /api/user` with a new password, then send `POST /api/users/login` with the
account's email and that new password.
**Expected:** The login is carried out and answers with a user document for the same account.

### C-038 — The replaced password stops logging in

**Covers:** R-080

- **Grouping rationale:** the soundness half of C-037, and the one a single successful login can
  never establish. An implementation that appends credentials rather than replacing them, or that
  writes the new secret to a second column the login check also consults, passes C-037 and leaves
  the retired password working; only a login that must fail shows it. The red points at the write,
  not at the login comparison C-028 covers.
- **Preconditions:** the same account as C-037, immediately after its password was changed.

**Steps:** Send `POST /api/users/login` with the account's email and the password it held before
the update.
**Expected:** The response is not a success and carries no `user` key.

### C-039 — A new username moves the profile address

**Covers:** R-081

- **Grouping rationale:** the only rule that ties the user record to the profile route, and it
  fails where C-034 and C-036 cannot look. Both of those read `GET /api/user`, which is addressed
  by token and would keep working if the profile index were never updated; the profile is
  addressed by name, so a stale index leaves the account reachable under one address and not the
  other. A red here is that index or the join behind it.
- **Preconditions:** a registered account holding a token, and a fresh username no account holds.

**Steps:** Send `PUT /api/user` with the new username, then send `GET /api/profiles/:username`
under the new name.
**Expected:** The request is carried out and answers with that account's profile, whose
`username` is the new name.

### C-040 — An update refuses an email or a username another account holds

**Covers:** R-082, R-083

- **Grouping rationale:** the same uniqueness requirement as C-031 enforced on a different code
  path. Creation and modification are two handlers and the constraint is commonly written into
  only one of them, so C-031 staying green says nothing about this; conversely an update guard is
  useless if creation lets a duplicate in. The two rules share a case because one lookup covers
  both columns and a red on either is that lookup being absent from the update path.
- **Preconditions:** two registered accounts, the second holding a token, with the first's email
  and username known.

**Steps:** Authenticated as the second account, send `PUT /api/user` with the first account's
email, then send `PUT /api/user` with the first account's username.
**Expected:** Both are answered with 422 and an `errors` envelope, and the second account keeps
its own email and username.

### C-041 — A profile answers for the username the path named

**Covers:** R-085, R-087

- **Grouping rationale:** the profile read handler and its lookup. R-085 is that a known username
  produces a Profile and R-087 is that it produces the right one; the second is what makes the
  first worth anything, and both are the same query keyed on the path segment. An implementation
  that answers with the authenticated caller's own profile regardless of the path is red on R-087
  while green on R-085, and both reds are that query.
- **Preconditions:** two registered accounts with distinct usernames.

**Steps:** Send `GET /api/profiles/:username` for the first account, then for the second.
**Expected:** Each response's `profile.username` equals the username in the path that was
requested, and the two responses differ.

### C-042 — Following returns the profile with the relationship it just made

**Covers:** R-091, R-093, R-094

- **Grouping rationale:** the follow handler's response. That it takes no body, that it answers
  with a Profile and that the profile reports `following` as `true` are one function's contract:
  a red on any of them is that handler, whether it demanded a parameter, returned nothing, or
  serialized the state as it stood before its own write. Held apart from C-044, which asks whether
  anything was written at all.
- **Preconditions:** two registered accounts, the first holding a token, not yet following the
  second.

**Steps:** Authenticated as the first account, send `POST /api/profiles/:username/follow` for the
second account, with no request body and no query parameter.
**Expected:** The request is carried out and answers with the second account's profile, whose
`username` is the one in the path and whose `following` is `true`.

### C-043 — Unfollowing returns the profile with the relationship it just ended

**Covers:** R-098, R-100, R-101

- **Grouping rationale:** the mirror of C-042 in a different handler. It is not grouped with
  C-042 because the two are separate methods on the route and commonly separate functions: one
  writes a relationship and one removes it, and an implementation that gets the write right can
  still return a stale `true` from the delete. The three rules within it are one contract for the
  same reason they are in C-042.
- **Preconditions:** two registered accounts, the first holding a token and currently following
  the second.

**Steps:** Authenticated as the first account, send `DELETE /api/profiles/:username/follow` for
the second account, with no request body and no query parameter.
**Expected:** The request is carried out and answers with the second account's profile, whose
`following` is `false`.

### C-044 — The follow relationship outlives the requests that change it

**Covers:** R-095, R-102

- **Grouping rationale:** the store behind the follow, read back through an endpoint that did not
  write it. C-042 and C-043 read only what the writing request returned and are both green on a
  handler that renders the intended state without committing. Both directions share a case because
  the reader goes to the same table either way — a follow that was not inserted and an unfollow
  that was not deleted are both that store failing to record the request — and a single sequence
  observes both.
- **Preconditions:** two registered accounts, the first holding a token and not following the
  second.

**Steps:** Authenticated as the first account, follow the second, then send
`GET /api/profiles/:username` for the second. Then unfollow the second and send
`GET /api/profiles/:username` for it again.
**Expected:** The first read reports `following` as `true` and the second reports it as `false`.

### C-045 — A follow runs one way

**Covers:** R-097

- **Grouping rationale:** the soundness of the relationship's direction, and no other case can see
  it. C-042, C-043 and C-044 all read the relationship from the follower's side, where a
  symmetric implementation looks perfectly correct; only a read from the followed account's side
  shows that a second row was written or that the lookup ignores which column is which. The red
  points at the direction of the stored pair, not at whether it was stored.
- **Preconditions:** two registered accounts, both holding tokens, with the first following the
  second and the second following nobody.

**Steps:** Authenticated as the second account, send `GET /api/profiles/:username` for the first
account.
**Expected:** The response reports `following` as `false`.

### C-046 — The unfiltered list draws from every article

**Covers:** R-104, R-107

- **Grouping rationale:** the default selection of the list endpoint. R-104 is that it answers
  with a multiple-articles document and R-107 is that the document is drawn globally; a red on
  either means the base query is wrong — no rows, or rows narrowed by something nobody asked for,
  such as the caller's own authorship. Kept out of C-022, which reads the shape of whatever came
  back and is green on a list that silently excludes half the articles.
- **Preconditions:** two registered accounts, each having created at least one article.

**Steps:** Send `GET /api/articles` with no query parameter and no `Authorization` header.
**Expected:** The response is a multiple-articles document, and both accounts' articles are among
its entries.

### C-047 — Both article listings are ordered newest first

**Covers:** R-106, R-120

- **Grouping rationale:** one ordering clause. The feed is the list query with a follow condition
  added, and the specification words the two requirements identically; a red on either is the sort
  going missing or inverting, and the reader goes to the same expression. This is the grouping in
  this file most likely to be wrong — if the two endpoints are built by separate query builders,
  one can be sorted and the other not, and a single case would name the wrong one.
- **Preconditions:** a registered account following an author who has created at least three
  articles in a known order.

**Steps:** Send `GET /api/articles?author=X` for that author anonymously, then
`GET /api/articles/feed` authenticated as the follower.
**Expected:** In each response, the `createdAt` of every entry is no earlier than the `createdAt`
of the entry after it.

### C-048 — The tag filter excludes an article that does not carry the tag

**Covers:** R-108

- **Grouping rationale:** the soundness half of the tag clause. A filter that is ignored
  altogether returns everything, including articles with no such tag, and a case that only checks
  that the expected articles are present cannot see it — the expected articles are present in an
  unfiltered list too. The red is the `WHERE` clause missing; C-049's red is the same clause being
  too narrow, and no single response distinguishes them.
- **Preconditions:** two articles, the first carrying a tag no other article carries and the
  second carrying a different tag.

**Steps:** Send `GET /api/articles?tag=X` with the first article's exclusive tag.
**Expected:** Every entry of the `articles` array carries `X` in its `tagList`, and the second
article's slug is not among them.

### C-049 — The tag filter returns every article that carries the tag

**Covers:** R-108

- **Grouping rationale:** the completeness half of the same clause, and the failure C-048 is
  structurally blind to: a filter that matches nothing, or that matches on an exact tag list
  rather than on membership, returns an empty array in which every entry trivially carries the
  tag. C-048 is green on that. Splitting the rule is the whole point — the two reds are opposite
  errors in one expression and a test that inspects only what came back cannot tell them apart.
- **Preconditions:** two articles by different authors, both carrying one tag that no other
  article carries.

**Steps:** Send `GET /api/articles?tag=X` with the shared tag.
**Expected:** Both articles' slugs appear among the entries.

### C-050 — The author filter excludes another author's article

**Covers:** R-109

- **Grouping rationale:** the soundness half of the author clause, which is a different clause
  from C-048's — it joins the article to its author and compares a username rather than searching
  a list. A red here is that join missing or comparing the wrong column, and it is invisible to
  C-051, which is satisfied by an unfiltered list.
- **Preconditions:** two registered accounts, each having created at least one article.

**Steps:** Send `GET /api/articles?author=X` with the first account's username.
**Expected:** Every entry's `author.username` is `X`, and the second account's article is not
among the entries.

### C-051 — The author filter returns the author's own articles

**Covers:** R-109, R-143

- **Grouping rationale:** the completeness half of the author clause, joined by R-143 because
  R-143 is that clause seen from the create side: an article that has just been created must be
  selectable by its creator's name. Both reds are the same join failing to match, whether because
  the filter is too narrow or because creation did not record the author the filter looks for.
  C-050 is green on an empty result and cannot report either.
- **Preconditions:** a registered account holding a token.

**Steps:** Create two articles as that account, then send `GET /api/articles?author=X` with its
username.
**Expected:** Both newly created slugs appear among the entries.

### C-052 — The favorited filter excludes an article that user has not favorited

**Covers:** R-110

- **Grouping rationale:** the soundness half of the favorited clause, which is a third distinct
  query — it joins through the favorites table and is keyed on a username that is not the caller's
  and not the article's author's. That combination is where the parameter is commonly wired to the
  wrong column, and the result then looks like a plausible list. Only an article that must be
  absent shows it.
- **Preconditions:** two articles and a registered account that has favorited the first and not
  the second.

**Steps:** Send `GET /api/articles?favorited=X` with that account's username.
**Expected:** The second article's slug is not among the entries.

### C-053 — The favorited filter returns the articles that user favorited

**Covers:** R-110, R-186

- **Grouping rationale:** the completeness half of the favorited clause, with R-186 as the same
  statement from the write side — the favorite that was just recorded must be visible to the
  filter. A red on either is the join failing to find the row, whether because the filter looks
  in the wrong place or because the favorite was never written. C-052 is green while the array is
  empty, so this case has to exist beside it.
- **Preconditions:** a registered account holding a token and an existing article it has not
  favorited.

**Steps:** Authenticated as that account, send `POST /api/articles/:slug/favorite`, then send
`GET /api/articles?favorited=X` with its username.
**Expected:** The article's slug is among the entries.

### C-054 — An unfavorited article leaves the favorited filter

**Covers:** R-194

- **Grouping rationale:** the removal path, and it fails on code neither C-052 nor C-053 executes.
  C-053 proves the row can be written and C-052 proves the filter is not blanket-true; an
  implementation whose unfavorite never deletes the row is green on both and red only here. The
  diagnosis is the delete, not the query.
- **Preconditions:** a registered account holding a token that has favorited an article.

**Steps:** Authenticated as that account, send `DELETE /api/articles/:slug/favorite`, then send
`GET /api/articles?favorited=X` with its username.
**Expected:** The article's slug is not among the entries.

### C-055 — The list is paginated by limit and offset with their defaults

**Covers:** R-111, R-112, R-113, R-114

- **Grouping rationale:** one pagination expression with two parameters and two defaults. The
  supplied value and its default are the same term of that expression — a red on the default is
  the same missing fallback as a red on the parsed value — and limit and offset are read from the
  same place and applied to the same query. What the case deliberately does not assert is what
  `articlesCount` becomes under pagination, which no rule settles.
- **Preconditions:** more than twenty articles exist, so that the default cap is observable, and
  a known ordering among them.

**Steps:** Send `GET /api/articles?limit=2`, then `GET /api/articles?limit=2&offset=1`, then
`GET /api/articles` with no parameters.
**Expected:** The first response carries at most 2 entries. The second carries at most 2 entries
and begins with the entry that stood second in the first. The third carries at most 20 entries
and begins with the entry the first response began with.

### C-056 — The feed carries the articles of the authors the caller follows

**Covers:** R-117, R-119

- **Grouping rationale:** the completeness half of the feed's selection. R-117 is that the
  endpoint answers with a multiple-articles document at all and R-119 is that a followed author's
  article is in it; a red on either is the join between the follow relationship and the article
  table returning nothing. C-017 already covers the legitimately empty feed, so an empty result
  here is a real failure and not the same one.
- **Preconditions:** two registered accounts, the first holding a token and following the second,
  and at least one article by the second created after the follow.

**Steps:** Send `GET /api/articles/feed` authenticated as the first account.
**Expected:** The response is a multiple-articles document and the second account's article is
among its entries.

### C-057 — The feed excludes an author the caller does not follow

**Covers:** R-119

- **Grouping rationale:** the soundness half of R-119, and the failure C-056 cannot see: a feed
  that ignores the follow condition and returns the global list satisfies C-056 completely.
  Splitting the rule is what separates "the feed works" from "the feed is a feed". The red is the
  join condition missing, where C-056's is the join finding nothing.
- **Preconditions:** three registered accounts, the first holding a token and following only the
  second, with articles by both the second and the third.

**Steps:** Send `GET /api/articles/feed` authenticated as the first account.
**Expected:** No entry has an `author.username` equal to the third account's, and every entry's
`author.username` is one the first account follows.

### C-058 — The feed honours limit and offset

**Covers:** R-121, R-122

- **Grouping rationale:** the feed's own pagination. It is a separate case from C-055 because the
  feed's query is built separately, and the commonest failure is exactly that the parameters were
  wired into the list endpoint and forgotten on the feed; a red here with C-055 green is that
  omission. The two parameters share the case for the same reason they do in C-055.
- **Preconditions:** a registered account holding a token, following an author with at least three
  articles.

**Steps:** Send `GET /api/articles/feed?limit=2`, then `GET /api/articles/feed?offset=1`.
**Expected:** The first response carries at most 2 entries. The second begins with the entry that
stood second in an unpaginated feed for the same account.

### C-059 — Unfollowing empties the feed of that author

**Covers:** R-124

- **Grouping rationale:** the feed read against a relationship that has changed since, which
  neither C-056 nor C-057 exercises: both take the follow set as fixed. An implementation that
  materialises the feed when the follow is created, rather than selecting on the relationship as
  it stands, is green on both and red here. The red is the feed reading a stored copy instead of
  the live join.
- **Preconditions:** two registered accounts, the first following the second, with at least one
  article by the second present in the first's feed.

**Steps:** Authenticated as the first account, send `DELETE /api/profiles/:username/follow` for
the second, then send `GET /api/articles/feed`.
**Expected:** No entry has an `author.username` equal to the second account's.

### C-060 — Creating an article returns it authored by the caller

**Covers:** R-129, R-131, R-137

- **Grouping rationale:** the create handler's response. The `article`-wrapped request body, the
  single-article document that comes back and the author being the authenticated account are one
  function; a red is that it could not read the body, returned the wrong shape, or attributed the
  article to somebody else. Authorship belongs here rather than in C-021 because C-021 checks only
  that `author` has the four profile fields and is green when the name in it is wrong.
- **Preconditions:** a registered account holding a token.

**Steps:** Send `POST /api/articles` with a body whose single top-level key is `article`, holding
a title, a description and a body.
**Expected:** The response is a single-article document whose `author.username` is the
authenticated account's username.

### C-061 — A created article is fetched by its slug and keeps what it was given

**Covers:** R-125, R-138, R-142

- **Grouping rationale:** the create-then-read round trip. R-138 is that the returned slug is the
  address, R-125 is that the address resolves to a single-article document, and R-142 is that the
  document holds the values the create request sent; all three are the same write having been
  committed under the identifier the response advertised. C-060 reads only the create response and
  is green on a handler that never persisted anything.
- **Preconditions:** a registered account holding a token.

**Steps:** Create an article with a known title, description and body, take the `slug` from the
response, and send `GET /api/articles/:slug` under it.
**Expected:** The read is carried out and answers with a single-article document whose `title`,
`description` and `body` are the values the create request sent.

### C-062 — Creating an article refuses a body missing a required field

**Covers:** R-132, R-133, R-134

- **Grouping rationale:** the article validator, one function with three required fields, exactly
  as C-030 is for registration. A red on any of the three is that function's list of required
  names, and which field was omitted adds nothing to the diagnosis. Separate from C-063, which
  concerns a field the validator must not require.
- **Preconditions:** a registered account holding a token.

**Steps:** Send `POST /api/articles` three times, each with an `article` object holding two of
title, description and body and omitting the third.
**Expected:** Each is answered with 422 and an `errors` envelope, and no article is created.

### C-063 — The tag list of a created article holds what was sent, or nothing

**Covers:** R-135, R-136

- **Grouping rationale:** the one optional field of the create body, and its two readings. Whether
  the tags sent are stored and whether an absent `tagList` becomes an empty array are the same
  expression — the fallback applied to the incoming value — so a red on either sends the reader
  there. The absent case is grouped in rather than treated as a separate default because, unlike
  C-055's defaults, there is no parameter parsing involved: the field is simply not present.
- **Preconditions:** a registered account holding a token.

**Steps:** Create an article whose `article` object carries a `tagList` of two known strings, then
create a second article whose `article` object carries no `tagList` at all.
**Expected:** The first response's `tagList` holds exactly the two strings that were sent. The
second response's `tagList` is an empty array.

### C-064 — A new article is favorited by nobody

**Covers:** R-140, R-141

- **Grouping rationale:** the initial state of the two favorite fields, which is one line of the
  create handler. A red on either — a flag that starts `true`, a count that starts at something
  other than zero, or either field left absent and read as a default by the caller — is that
  initialisation. Held apart from C-081 and C-084, which are about how the two fields move once
  somebody acts on them; a correct initial state proves nothing about the increment.
- **Preconditions:** a registered account holding a token.

**Steps:** Send `POST /api/articles` with a valid body and read the response.
**Expected:** The article reports `favorited` as `false` and `favoritesCount` as `0`.

### C-065 — Two articles with one title get two slugs

**Covers:** R-035, R-139

- **Grouping rationale:** the slug generator's uniqueness. R-035 is the requirement and R-139 is
  the only way the API lets anybody observe it, so they are one case; the read of R-035 adopted
  here is the observable one, since nothing in the API enumerates every article that exists. A red
  is the generator being a pure function of the title with no disambiguation, and it is invisible
  to C-061, which only ever creates one article.
- **Preconditions:** a registered account holding a token.

**Steps:** Send `POST /api/articles` twice with the same `title` and different bodies, then send
`GET /api/articles/:slug` under each returned slug.
**Expected:** The two responses carry different `slug` values, and each slug fetches the article
that returned it rather than the other one.

### C-066 — A created article's tags reach the tag list

**Covers:** R-144

- **Grouping rationale:** the only link the specification gives between article creation and the
  tags endpoint, and it fails where C-025 and C-063 cannot look. C-063 proves the tag was stored
  on the article and C-025 proves the tags endpoint answers with an array of strings; an
  implementation whose tags endpoint reads a table nothing writes to is green on both and returns
  an empty list forever. The red is the missing write or the wrong source.
- **Preconditions:** a registered account holding a token, and a tag string no existing article
  carries.

**Steps:** Create an article carrying that tag, then send `GET /api/tags`.
**Expected:** The tag the article was created with is among the entries of the `tags` array.

### C-067 — A tag is listed once however many articles carry it

**Covers:** R-198

- **Grouping rationale:** the distinctness of the tags query, which C-066 cannot see because one
  article produces one occurrence either way. A tags endpoint that selects taggings rather than
  tags passes C-066 and repeats every popular tag; the red is the missing distinctness in that
  query, not the source C-066 covers.
- **Preconditions:** a registered account holding a token, and a tag string no existing article
  carries.

**Steps:** Create two articles both carrying that same tag, then send `GET /api/tags`.
**Expected:** The tag appears exactly once in the `tags` array.

### C-068 — Updating an article returns it as it now stands

**Covers:** R-145, R-147

- **Grouping rationale:** the article update handler's success path and its accepted-field list.
  A red is that handler — a refusal where none of the three fields is required, a field it does
  not recognise, or a document that is not the article. It is the counterpart of C-034 for
  articles, and it is split from C-070 for the same reason C-034 is split from C-035: what was
  sent and what was not sent fail in opposite directions.
- **Preconditions:** a registered account holding a token and an article it authored.

**Steps:** Authenticated as the author, send `PUT /api/articles/:slug` with an `article` object
carrying a new description and a new body.
**Expected:** The response is a single-article document for the same article carrying the new
description and the new body.

### C-069 — A new title moves the slug, and the new slug fetches the article

**Covers:** R-148, R-152

- **Grouping rationale:** the one side effect a title change has beyond the field itself. R-148 is
  that the returned slug differs from the one in the path and R-152 is that the new value actually
  resolves; they are one case because a slug that changed but does not fetch anything is the same
  defect half-done, and both reds are the regeneration and its index. This case says nothing about
  the old slug, which no rule settles.
- **Preconditions:** a registered account holding a token and an article it authored.

**Steps:** Authenticated as the author, send `PUT /api/articles/:slug` with a new `title`, then
send `GET /api/articles/:slug` under the slug the update returned.
**Expected:** The slug in the update response differs from the slug in the request path, and the
read under the new slug answers with that article carrying the new title.

### C-070 — An article update leaves the fields it was not sent alone

**Covers:** R-149

- **Grouping rationale:** the soundness half of C-068's merge. An update that assigns the incoming
  `article` object over the stored record clears the two fields it was not given and stays green
  on C-068, which only inspects what it sent. The red is the merge, and it is the same class of
  defect as C-035's on a different resource — but a different function, so a different case.
- **Preconditions:** a registered account holding a token and an article it authored with a known
  title, description and body.

**Steps:** Authenticated as the author, send `PUT /api/articles/:slug` carrying only a new
`title`, then send `GET /api/articles/:slug` under the slug the update returned.
**Expected:** Both responses carry the article's original description and body unchanged.

### C-071 — An update moves updatedAt and leaves createdAt alone

**Covers:** R-153, R-154

- **Grouping rationale:** the timestamp handling of one write. The two rules are the two halves of
  it — one field must move and the other must not — and both reds are the same assignment, whether
  it touches neither field or touches both. Kept out of C-021, which only checks that the two
  values parse, and out of C-068, which is green while both timestamps are frozen.
- **Preconditions:** a registered account holding a token and an article it authored, with both
  its timestamps recorded.

**Steps:** Send `GET /api/articles/:slug` and record both timestamps, then, authenticated as the
author, send `PUT /api/articles/:slug` with a new body, and read the response.
**Expected:** The `updatedAt` in the update response is later than the one recorded before, and
the `createdAt` is unchanged.

### C-072 — Deleting an article answers success and its slug stops resolving

**Covers:** R-155, R-157

- **Grouping rationale:** the delete handler and the by-slug read that must stop finding the
  article. They are one case because the read is what gives the success status any meaning: a
  handler that answers success and deletes nothing fails both in one step. C-015 covers a slug
  that never existed, which is a different question — this one is a slug that used to work.
- **Preconditions:** a registered account holding a token and an article it authored.

**Steps:** Authenticated as the author, send `DELETE /api/articles/:slug`, then send
`GET /api/articles/:slug` under the same slug.
**Expected:** The delete answers with a success status, and the read is answered with 404.

### C-073 — A deleted article leaves the collection

**Covers:** R-158

- **Grouping rationale:** split from C-072 because the two reads select differently. A deletion
  implemented as a flag that the by-slug lookup honours and the list query does not is green on
  C-072 and leaves the article visible in every listing; the reverse — hidden from the list,
  fetchable by slug — is the failure C-072 catches and this case does not. Only having both cases
  distinguishes the two.
- **Preconditions:** a registered account holding a token and an article it authored whose slug
  appears in the unfiltered list.

**Steps:** Authenticated as the author, send `DELETE /api/articles/:slug`, then send
`GET /api/articles?author=X` with the author's username.
**Expected:** No entry carries the deleted slug.

### C-074 — Commenting returns the comment authored by the caller

**Covers:** R-161, R-163, R-165

- **Grouping rationale:** the comment create handler's response, the counterpart of C-060. The
  `comment`-wrapped body, the single-comment document that comes back and the author being the
  authenticated account are one function, and a red is that it could not read the body, returned
  the wrong shape, or attributed the comment elsewhere. C-024 checks the document's fields and is
  green when the author names the wrong person.
- **Preconditions:** a registered account holding a token and an existing article.

**Steps:** Send `POST /api/articles/:slug/comments` with a body whose single top-level key is
`comment`, holding a known body string.
**Expected:** The response is a single-comment document whose `body` is the string that was sent
and whose `author.username` is the authenticated account's username.

### C-075 — Commenting refuses a comment with no body

**Covers:** R-164

- **Grouping rationale:** the comment validator, which has exactly one required field. It fails
  independently of C-074 in the way every validator fails independently of its handler: an
  endpoint that accepts anything is green on C-074 and creates an empty comment here. It has its
  own case rather than joining C-062 because it is a different endpoint's validator, and the
  reader who sees this red goes to the comment controller, not the article one.
- **Preconditions:** a registered account holding a token and an existing article.

**Steps:** Send `POST /api/articles/:slug/comments` with a `comment` object carrying no `body`.
**Expected:** The response carries 422 and an `errors` envelope, and no comment is created on the
article.

### C-076 — A comment joins its article's list

**Covers:** R-166, R-169

- **Grouping rationale:** the create-then-list round trip for comments, the counterpart of C-061.
  R-169 is that the list endpoint answers with a multiple-comments document and R-166 is that the
  comment just created is in it carrying the body that was sent; both reds are the same write not
  having reached the store the list reads. C-074 reads only the create response and is green on a
  handler that persisted nothing.
- **Preconditions:** a registered account holding a token and an existing article.

**Steps:** Create a comment on the article with a known body, then send
`GET /api/articles/:slug/comments` for the same article.
**Expected:** The response is a multiple-comments document, and one of its entries carries the
body that was sent and the identifier the create response returned.

### C-077 — An article's comments are only that article's

**Covers:** R-173

- **Grouping rationale:** the soundness of the comment list's article condition, which C-076
  cannot see: a list endpoint that ignores `:slug` and returns every comment in the system
  contains the one just created and passes C-076 completely. The red is the missing condition on
  the query — the same class of defect as C-048 and C-057, on a third query.
- **Preconditions:** two existing articles, each carrying at least one comment by a registered
  account.

**Steps:** Send `GET /api/articles/:slug/comments` for the first article.
**Expected:** The identifier of the comment made on the second article is not among the entries.

### C-078 — A comment is deleted through the identifier its creation returned

**Covers:** R-044, R-168, R-174

- **Grouping rationale:** the identifier's role as an address. R-168 is that the value the create
  response carried is the one the delete path takes, R-174 is that the delete is then carried out,
  and R-044 is the uniqueness without which neither statement is well defined; all three are the
  same identifier being usable, and a red on any of them is the create response handing back a
  value the delete route cannot resolve. The uniqueness is read as the observable one — two
  comments created in succession carry different identifiers — since nothing in the API
  enumerates every comment.
- **Preconditions:** a registered account holding a token and an existing article.

**Steps:** Create two comments on the article as that account, then send
`DELETE /api/articles/:slug/comments/:id` using the identifier the first create response
returned.
**Expected:** The two create responses carry different `id` values, and the delete answers with a
success status.

### C-079 — A deleted comment leaves the list

**Covers:** R-176

- **Grouping rationale:** the persistence half of C-078, and it fails on the same split C-072 and
  C-073 draw for articles: a delete that answers success without committing, or that hides the
  comment from one read and not another. C-078 stops at the status and is green on both. The red
  is the delete not having reached the store the list reads.
- **Preconditions:** the article and the two comments of C-078, with the first already deleted.

**Steps:** Send `GET /api/articles/:slug/comments` for the same article.
**Expected:** No entry carries the identifier of the deleted comment, and the second comment is
still present.

### C-080 — Favoriting returns the article marked favorited

**Covers:** R-180, R-182, R-183

- **Grouping rationale:** the favorite handler's response, structurally identical to C-042's
  place among the follow rules. That it takes no body, that it answers with the Article and that
  the article reports `favorited` as `true` are one function's contract, and a red on any of them
  is that handler serializing the state before its own write or demanding a parameter it was told
  not to need. The count is deliberately not asserted here — see C-081.
- **Preconditions:** a registered account holding a token and an article it has not favorited.

**Steps:** Send `POST /api/articles/:slug/favorite` with no request body and no query parameter.
**Expected:** The request is carried out and answers with a single-article document for that
article whose `favorited` is `true`.

### C-081 — Favoriting raises the count by one

**Covers:** R-184

- **Grouping rationale:** the counter, which is a different piece of state from the flag C-080
  reads. The flag is a membership test against the caller and the count is an aggregate over
  everyone; an implementation that records the favorite without touching the count, or that
  recomputes the count from a stale source, is green on C-080 and red here. Kept apart from C-083
  for the same reason C-037 is kept apart from C-038 — the increment and the decrement are
  separate writes.
- **Preconditions:** a registered account holding a token and an article it has not favorited,
  with the article's current `favoritesCount` recorded.

**Steps:** Read the article's `favoritesCount`, then send `POST /api/articles/:slug/favorite` and
read the count in the response.
**Expected:** The count in the response is exactly one greater than the count recorded before.

### C-082 — Unfavoriting returns the article marked not favorited

**Covers:** R-188, R-190, R-191

- **Grouping rationale:** the mirror of C-080 in the other handler, and separate for the same
  reason C-043 is separate from C-042: the two methods on the route are two functions, and a
  correct write says nothing about the delete. The three rules within it are one contract — no
  body, an Article back, and the flag showing the state the request just produced.
- **Preconditions:** a registered account holding a token and an article it has favorited.

**Steps:** Send `DELETE /api/articles/:slug/favorite` with no request body and no query parameter.
**Expected:** The request is carried out and answers with a single-article document for that
article whose `favorited` is `false`.

### C-083 — Unfavoriting lowers the count by one

**Covers:** R-192

- **Grouping rationale:** the decrement, which C-081 cannot vouch for and C-082 does not read. An
  implementation that increments on favorite and forgets to decrement is green on C-081, C-082 and
  C-054 while the count drifts upward forever; only reading the count across the delete shows it.
  The red is that one write.
- **Preconditions:** a registered account holding a token and an article it has just favorited,
  with the raised `favoritesCount` recorded.

**Steps:** Read the article's `favoritesCount` while it is favorited, then send
`DELETE /api/articles/:slug/favorite` and read the count in the response.
**Expected:** The count in the response is exactly one less than the count recorded before.

### C-084 — The favorite flag is per caller while the count is not

**Covers:** R-031, R-187

- **Grouping rationale:** the one place the two fields are required to disagree, and neither
  C-080 nor C-081 can reach it: both read the article as the account that did the favoriting,
  where `favorited` is `true` and the count is raised, and an implementation that derives the flag
  from the count being non-zero looks perfectly correct. A second, uninvolved caller separates
  them. R-031 belongs here because a count that varied by caller is the same defect from the other
  side.
- **Preconditions:** two registered accounts holding tokens and an article the first has
  favorited and the second has not.

**Steps:** Send `GET /api/articles/:slug` authenticated as the second account, and again with no
`Authorization` header.
**Expected:** Both responses report `favorited` as `false` while reporting the same
`favoritesCount` the first account's favorite produced, and that count is not negative.

### C-085 — A preflight request is answered and names what is allowed

**Covers:** R-199, R-200, R-201

- **Grouping rationale:** one middleware. Whether `OPTIONS` is handled at all and which two
  headers the answer carries are decided in the same place, and a red on any of them is that
  middleware being absent or misconfigured; there is no implementation in which the method is
  handled by one component and the headers set by another. The rules are stated unconditionally
  while their source is conditional on how the deployment is served — that is recorded under the
  open questions rather than resolved here.
- **Preconditions:** none.

**Steps:** Send an `OPTIONS` request to `/api/articles` carrying an `Origin` request header.
**Expected:** The request is answered rather than refused as an unknown method, and the response
carries both an `Access-Control-Allow-Origin` header and an `Access-Control-Allow-Headers` header
whose value lists at least `Content-Type`.

## Not covered

- R-036 — "No particular slug format is required" states that a constraint does not exist. There
  is no response that can violate it: any slug an implementation returns satisfies it, including
  one derived from the title and one that is not. A case covering it would be green against every
  possible implementation, which makes it a statement about the test suite rather than about the
  API. The part of the slug contract that is checkable — that it is unique and that it addresses
  its article — is covered by C-065 and C-021.
- R-197 — "a tag no article carries is absent from the `tags` array" cannot be checked over the
  HTTP API. Establishing it needs the full set of tags every article carries, and nothing in the
  API enumerates that; the only affordable check is that some arbitrary string is absent from the
  list, which is green whatever the endpoint does. The half of the tag list's provenance that can
  be checked — that a newly created article's tags appear — is C-066, and the distinctness is
  C-067. If the rules gain a way to observe an article losing its last tag, this becomes testable
  and should be picked up.

## Open questions

- R-015 assumes 200 for every success, and the rules' own open questions record that 201 is the
  conventional answer for `POST /api/users` and `POST /api/articles`. C-009 asserts 200 across a
  sample that includes `POST /api/articles`, so a deployment answering 201 there fails C-009 on a
  point the specification never settles. If the BA agent can resolve the creation codes, C-009
  should be narrowed; as written it takes R-015 literally, which is the only reading the rules
  offer.
- R-155 and R-174 say "a success status" without naming it, while R-015 says every carried-out
  request answers 200. C-072 and C-078 therefore assert only a success status, and C-009 does not
  include either delete in its sample. Whether that is the intended reading of R-015 is
  undecidable from the rules.
- R-093, R-100, R-182 and R-190 say the request "is carried out with no request body and no query
  parameter". Read as a permission — none is needed — the case sends none, which is what C-042,
  C-043, C-080 and C-082 do. Read as a prohibition — one must be refused — the cases would need a
  request that carries a body and expects a failure, and no rule names a status for it. The
  permissive reading was adopted.
- R-125 and R-126 mark Get Article "No authentication required" while R-009, R-029 and R-116 make
  `favorited` and `author.following` caller-relative. The rules' own open questions raise this and
  leave it open. C-084 reads the single article as an authenticated second account and expects
  `favorited` false, which is true under both readings; but C-007's completeness argument would
  extend to Get Article under the second reading and there is no rule that says so. No case
  asserts a `true` on a single-article read.
- R-035 and R-044 are stated over every article and every comment that exists at the same time.
  Neither is observable that way through the API: nothing enumerates all articles or all comments
  of a deployment. C-065 and C-078 adopt the observable reading — two resources created in
  succession carry different identifiers — which is strictly weaker than what the rules say.
- R-112 requires more than twenty articles to exist before the default cap can be observed at all.
  On a deployment with fewer, C-055 is vacuous on that point and the rules give no way to tell the
  two situations apart. The precondition is stated, but nothing in the rules guarantees it can be
  met.
- R-111 to R-114 say nothing about `articlesCount` under pagination, and the rules' open questions
  confirm it is undefined. C-055 therefore asserts only the size of the `articles` array. This is
  the largest hole in the pagination coverage and it is the BA agent's to close.
- R-108, R-109 and R-110 each describe one parameter alone and no rule covers a request carrying
  two. C-048 to C-053 send one parameter each. A deployment that ignores the second of two
  parameters is unobserved by this file.
- R-148 and R-152 settle the new slug and nothing settles the old one. C-069 reads only the new
  slug. Whether the previous slug should now answer 404 — which would make it an instance of
  C-015 — or keep working is undecidable from the rules.
- R-150 and R-151, and R-159 and R-160, each describe one condition in isolation, so a non-author
  addressing a slug that does not exist has no expected status. C-012 uses an existing article and
  C-015 uses the author's own token, so neither case enters the overlap.
- R-091, R-098, R-180 and R-188 describe only the first such request, and R-184 and R-192 are
  written against the state before the request. Repeating a follow or a favorite is therefore
  unspecified, and every case here is written to run against a clean starting relationship. A
  deployment that double-counts a repeated favorite is unobserved.
- R-004 covers only endpoints that require authentication. Whether an unusable token on an
  optional-authentication endpoint is refused or read as anonymous is undecided, so C-003 sends
  its three bad credentials only to `GET /api/user`.
- R-119 is silent on whether a user's own articles appear in their feed, because the rules leave
  self-following undecided. C-056 and C-057 use articles by other accounts throughout and neither
  asserts anything about the caller's own.
- R-147 lists three accepted fields for the article update and no rule says what happens to a
  `tagList` sent to it. C-068 and C-070 send only the three, so the behaviour is unobserved.
- R-199 to R-201 are stated as rules of the API while their source is conditional on the API being
  served to a frontend on another host or port. C-085 assumes the condition holds. If it does not
  for a given deployment, the case is not a defect report but a mismatch between the rule and the
  deployment, and the rules give no way to tell which.
- R-060 to R-062 cover only the absence of `username`, `email` and `password`, and no rule
  constrains their content. C-030 therefore sends absences only; an empty string, a very long
  value or an email that is not an address are all outside this file.
