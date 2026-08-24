# Conduit rules

The specification in `spec/conduit-api.md`, enumerated as checkable statements about the
behaviour of the API. Every rule is one thing a request and its response can be held to. The
identifiers are the vocabulary the rest of the chain uses; they are stable and never reused.

## Rules

### R-001 — Credentials travel in the Authorization header

**Source:** Endpoints — "Authentication Header": `Authorization: Token jwt.token.here`
**Kind:** explicit
**Statement:** A request authenticates itself by sending the `Authorization` request header with
the value `Token ` followed by the JWT issued to the user.

### R-002 — Only the `Token` scheme authenticates

**Source:** Endpoints — "Authentication Header"
**Kind:** assumed
**Statement:** A request that presents a valid JWT under any other scheme, such as
`Authorization: Bearer <jwt>`, is not authenticated, and an endpoint that requires authentication
answers it with 401.

### R-003 — A request with no credentials to an authenticated endpoint is refused

**Source:** Error handling — "401 for Unauthorized requests, when a request requires
authentication but it isn't provided"
**Kind:** explicit
**Statement:** An endpoint documented as "Authentication required" answers a request that carries
no `Authorization` header with 401.

### R-004 — An unusable token is refused the same way as no token

**Source:** Error handling — "Other status codes"; Endpoints — "Authentication Header"
**Kind:** assumed
**Statement:** An endpoint documented as "Authentication required" answers a request whose
`Authorization` header carries a token that is not one the API issued, or one it no longer
accepts, with 401.

### R-005 — A token identifies exactly one account

**Source:** Endpoints — "Get Current User"; "API response format" — Users (for authentication)
**Kind:** assumed
**Statement:** A request authenticated with the token issued to one user is carried out as that
user and not as another, so two tokens issued to two accounts never address the same account.

### R-006 — An open endpoint serves an anonymous request

**Source:** Endpoints — "No authentication required" on Authentication, Registration, Get Article
and Get Tags
**Kind:** explicit
**Statement:** An endpoint documented as "No authentication required" answers a request that
carries no `Authorization` header with the document that endpoint returns, not with 401.

### R-007 — An optional-authentication endpoint serves an anonymous request

**Source:** Endpoints — "Authentication optional" on Get Profile, List Articles and Get Comments
**Kind:** explicit
**Statement:** An endpoint documented as "Authentication optional" answers a request that carries
no `Authorization` header with the document that endpoint returns, not with 401.

### R-008 — An optional-authentication endpoint honours a token when one is sent

**Source:** Endpoints — "Authentication optional"
**Kind:** assumed
**Statement:** An endpoint documented as "Authentication optional" answers a request that does
carry a valid token, and answers it as that user rather than as an anonymous caller.

### R-009 — Viewer-relative fields are false for an anonymous caller

**Source:** API response format — Profile, Single Article; Endpoints — "Authentication optional"
**Kind:** assumed
**Statement:** In a response to a request that carries no credentials, every field that describes
the relationship between the caller and the resource — `following` on a profile, `favorited` on
an article — is `false`.

### R-010 — A request that fails validation is answered with 422

**Source:** Error handling — "If a request fails any validations, expect a 422 and errors in the
following format"
**Kind:** explicit
**Statement:** A request whose body does not satisfy the constraints of the endpoint it addresses
is answered with status 422.

### R-011 — Validation failures are reported in the errors envelope

**Source:** Error handling — the `{"errors": {"body": ["can't be empty"]}}` example
**Kind:** explicit
**Statement:** A 422 response carries a JSON body whose single top-level key is `errors` and
whose value is an object keyed by the name of what failed.

### R-012 — Each entry in the errors envelope is a list of messages

**Source:** Error handling — the `{"errors": {"body": ["can't be empty"]}}` example
**Kind:** explicit
**Statement:** Every value inside the `errors` object is an array of strings, even when it holds
a single message.

### R-013 — A permitted-but-not-allowed request is answered with 403

**Source:** Error handling — "403 for Forbidden requests, when a request may be valid but the
user doesn't have permissions to perform the action"
**Kind:** explicit
**Statement:** A well-formed, authenticated request that asks for an action the authenticated
user is not entitled to perform is answered with status 403.

### R-014 — A request naming a resource that does not exist is answered with 404

**Source:** Error handling — "404 for Not found requests, when a resource can't be found to
fulfill the request"
**Kind:** explicit
**Statement:** A request whose path names a resource the API does not hold is answered with
status 404.

### R-015 — A request that succeeds is answered with 200

**Source:** Endpoints — every endpoint's "returns a …"; Error handling — "Other status codes"
**Kind:** assumed
**Statement:** A request that is carried out is answered with status 200 and the document the
endpoint is documented to return; the specification reserves the other listed codes for failures
and names no other success code.

### R-016 — Responses declare JSON and UTF-8

**Source:** API response format — "Make sure the right content type like `Content-Type:
application/json; charset=utf-8` is correctly returned"
**Kind:** explicit
**Statement:** A response that carries a JSON document sets the `Content-Type` response header to
`application/json; charset=utf-8`.

### R-017 — A failed request returns no resource document

**Source:** Error handling — "Errors and Status Codes"
**Kind:** assumed
**Statement:** A response that reports a failure carries the `errors` envelope alone and none of
the `user`, `profile`, `article`, `articles`, `comment`, `comments` or `tags` keys, so that a
caller can tell the two apart by the body as well as by the status.

### R-018 — The user document is wrapped in a `user` key

**Source:** API response format — Users (for authentication)
**Kind:** explicit
**Statement:** Every response that returns a User carries a JSON object whose single top-level
key is `user`.

### R-019 — The user document carries five fields

**Source:** API response format — Users (for authentication)
**Kind:** explicit
**Statement:** The object under `user` carries `email`, `token`, `username`, `bio` and `image`,
with `email`, `token` and `username` as strings.

### R-020 — A user's bio and image may be empty

**Source:** API response format — Users (for authentication), where both are shown as `null`
**Kind:** explicit
**Statement:** The `bio` and `image` fields of the user document are either strings or `null`,
and `null` is a valid value the caller must accept.

### R-021 — The token in the user document is the credential

**Source:** API response format — Users (for authentication); Endpoints — "Authentication Header"
**Kind:** assumed
**Statement:** The value of `user.token` is the JWT that a later request sends in its
`Authorization` header to be authenticated as that user; the two places the specification writes
`jwt.token.here` refer to the same string.

### R-022 — A password is never part of a response

**Source:** API response format — Users (for authentication)
**Kind:** assumed
**Statement:** No response body carries the password a user registered or updated with, in the
user document or anywhere else, since the documented user document has no such field.

### R-023 — The profile document is wrapped in a `profile` key

**Source:** API response format — Profile
**Kind:** explicit
**Statement:** Every response that returns a Profile carries a JSON object whose single top-level
key is `profile`.

### R-024 — The profile document carries four fields

**Source:** API response format — Profile
**Kind:** explicit
**Statement:** The object under `profile` carries `username`, `bio`, `image` and `following`,
where `username` is a string and `bio` and `image` are strings or `null`.

### R-025 — Following is a boolean

**Source:** API response format — Profile, where `following` is shown as `false`
**Kind:** explicit
**Statement:** The `following` field of a profile is a JSON boolean, not a string and not a
number.

### R-026 — The single-article document is wrapped in an `article` key

**Source:** API response format — Single Article
**Kind:** explicit
**Statement:** Every response that returns one Article carries a JSON object whose single
top-level key is `article`.

### R-027 — The single-article document carries ten fields

**Source:** API response format — Single Article
**Kind:** explicit
**Statement:** The object under `article` carries `slug`, `title`, `description`, `body`,
`tagList`, `createdAt`, `updatedAt`, `favorited`, `favoritesCount` and `author`.

### R-028 — A tag list is an array of strings

**Source:** API response format — Single Article; Endpoints — Create Article, "Optional fields:
`tagList` as an array of Strings"
**Kind:** explicit
**Statement:** The `tagList` field of an article is a JSON array whose every entry is a string.

### R-029 — Favorited is a boolean

**Source:** API response format — Single Article, where `favorited` is shown as `false`
**Kind:** explicit
**Statement:** The `favorited` field of an article is a JSON boolean.

### R-030 — The favorites count is a number

**Source:** API response format — Single Article, where `favoritesCount` is shown as `0`
**Kind:** explicit
**Statement:** The `favoritesCount` field of an article is a JSON number, not a string.

### R-031 — The favorites count is how many users favorited the article

**Source:** API response format — Single Article; Endpoints — Favorite Article
**Kind:** assumed
**Statement:** The `favoritesCount` of an article is the number of users that currently have it
among their favorites, so it is never negative and it does not depend on who is asking.

### R-032 — An article's author is a profile

**Source:** API response format — Single Article
**Kind:** explicit
**Statement:** The `author` field of an article is an object carrying `username`, `bio`, `image`
and `following`, the same four fields as a profile document.

### R-033 — Article timestamps are ISO-8601 instants

**Source:** API response format — Single Article, `"createdAt": "2016-02-18T03:22:56.637Z"`
**Kind:** assumed
**Statement:** The `createdAt` and `updatedAt` fields of an article are strings holding an
ISO-8601 timestamp in UTC, in the form the response format section shows, so that a caller can
parse and order them.

### R-034 — A slug addresses its article

**Source:** Endpoints — "The `slug` is the article's URL identifier … a unique string that you
can use to fetch, update, and delete the article"
**Kind:** explicit
**Statement:** The `slug` of an article is a string, and it is the path segment under which that
article can be fetched, updated and deleted.

### R-035 — Two articles never share a slug

**Source:** Endpoints — "duplicate titles must still produce distinct slugs"
**Kind:** explicit
**Statement:** No two articles that exist at the same time carry the same `slug`, including two
articles created with identical titles.

### R-036 — No particular slug format is required

**Source:** Endpoints — "How you derive it is up to your implementation … no particular format is
enforced by the test suite"
**Kind:** explicit
**Statement:** The `slug` of an article is required to be unique and usable in a path, and is not
required to be any transformation of the title.

### R-037 — A list of articles is wrapped in `articles` and `articlesCount`

**Source:** API response format — Multiple Articles
**Kind:** explicit
**Statement:** Every response that returns several articles carries a JSON object with exactly
the two top-level keys `articles`, an array, and `articlesCount`.

### R-038 — The article count is a number

**Source:** API response format — Multiple Articles, where `articlesCount` is shown as `2`
**Kind:** explicit
**Statement:** The `articlesCount` field is a JSON number.

### R-039 — A listed article carries no body

**Source:** API response format — Multiple Articles, "the endpoints retrieving a list of articles
do no longer return the body of an article … `GET /api/articles`, `GET /api/articles/feed`"
**Kind:** explicit
**Statement:** An entry of the `articles` array returned by `GET /api/articles` or
`GET /api/articles/feed` has no `body` field.

### R-040 — A listed article carries the rest of the article fields

**Source:** API response format — Multiple Articles
**Kind:** explicit
**Statement:** An entry of the `articles` array carries `slug`, `title`, `description`,
`tagList`, `createdAt`, `updatedAt`, `favorited`, `favoritesCount` and `author`.

### R-041 — The single-comment document is wrapped in a `comment` key

**Source:** API response format — Single Comment
**Kind:** explicit
**Statement:** Every response that returns one Comment carries a JSON object whose single
top-level key is `comment`.

### R-042 — The comment document carries five fields

**Source:** API response format — Single Comment
**Kind:** explicit
**Statement:** The object under `comment` carries `id`, `createdAt`, `updatedAt`, `body` and
`author`, where `body` is a string and `author` is a profile object.

### R-043 — A comment identifier is a number

**Source:** API response format — Single Comment, where `id` is shown as `1`
**Kind:** explicit
**Statement:** The `id` field of a comment is a JSON number.

### R-044 — A comment identifier addresses one comment

**Source:** Endpoints — Delete Comment, `DELETE /api/articles/:slug/comments/:id`
**Kind:** assumed
**Statement:** The `id` of a comment is the path segment that addresses it for deletion, so no
two comments that exist at the same time share an `id`.

### R-045 — A list of comments is wrapped in a `comments` key

**Source:** API response format — Multiple Comments
**Kind:** explicit
**Statement:** Every response that returns several comments carries a JSON object whose single
top-level key is `comments`, holding an array of comment objects.

### R-046 — The tag list is wrapped in a `tags` key

**Source:** API response format — List of Tags
**Kind:** explicit
**Statement:** The response of the tags endpoint carries a JSON object whose single top-level key
is `tags`.

### R-047 — The tag list holds strings

**Source:** API response format — List of Tags
**Kind:** explicit
**Statement:** The value of `tags` is an array whose every entry is a string.

### R-048 — Login returns a user document

**Source:** Endpoints — Authentication, `POST /api/users/login`, "returns a User"
**Kind:** explicit
**Statement:** A `POST /api/users/login` carrying the email and password of an existing account is
answered with a User document.

### R-049 — Login needs no credentials

**Source:** Endpoints — Authentication, "No authentication required"
**Kind:** explicit
**Statement:** `POST /api/users/login` is served without an `Authorization` header.

### R-050 — The login body is wrapped in a `user` key

**Source:** Endpoints — Authentication, the example request body
**Kind:** explicit
**Statement:** The request body of `POST /api/users/login` is a JSON object whose single
top-level key is `user`, holding the credentials.

### R-051 — Login requires an email

**Source:** Endpoints — Authentication, "Required fields: `email`, `password`"
**Kind:** explicit
**Statement:** A `POST /api/users/login` whose `user` object has no `email` is answered with 422
and an `errors` envelope.

### R-052 — Login requires a password

**Source:** Endpoints — Authentication, "Required fields: `email`, `password`"
**Kind:** explicit
**Statement:** A `POST /api/users/login` whose `user` object has no `password` is answered with
422 and an `errors` envelope.

### R-053 — Login answers with the account that was named

**Source:** Endpoints — Authentication, "returns a User"
**Kind:** assumed
**Statement:** The `user.email` of a successful login response is the email the request sent, so
the document describes the account whose credentials were presented.

### R-054 — A login token authenticates

**Source:** Endpoints — Authentication; "Authentication Header"
**Kind:** assumed
**Statement:** The `user.token` returned by a successful login authenticates a later request to
an endpoint that requires authentication, as the account that logged in.

### R-055 — An unknown account cannot log in

**Source:** Endpoints — Authentication; Error handling — "Errors and Status Codes"
**Kind:** assumed
**Statement:** A `POST /api/users/login` naming an email no account holds is answered with a
failure status and no user document, since a token handed out for an account that does not exist
would contradict R-005.

### R-056 — A wrong password cannot log in

**Source:** Endpoints — Authentication; Error handling — "Errors and Status Codes"
**Kind:** assumed
**Statement:** A `POST /api/users/login` naming an existing email with a password that is not
that account's is answered with a failure status and no user document.

### R-057 — Registration returns a user document

**Source:** Endpoints — Registration, `POST /api/users`, "returns a User"
**Kind:** explicit
**Statement:** A `POST /api/users` carrying a username, an email and a password is answered with
a User document for the account it created.

### R-058 — Registration needs no credentials

**Source:** Endpoints — Registration, "No authentication required"
**Kind:** explicit
**Statement:** `POST /api/users` is served without an `Authorization` header.

### R-059 — The registration body is wrapped in a `user` key

**Source:** Endpoints — Registration, the example request body
**Kind:** explicit
**Statement:** The request body of `POST /api/users` is a JSON object whose single top-level key
is `user`, holding the fields of the account to create.

### R-060 — Registration requires an email

**Source:** Endpoints — Registration, "Required fields: `email`, `username`, `password`"
**Kind:** explicit
**Statement:** A `POST /api/users` whose `user` object has no `email` is answered with 422 and an
`errors` envelope.

### R-061 — Registration requires a username

**Source:** Endpoints — Registration, "Required fields: `email`, `username`, `password`"
**Kind:** explicit
**Statement:** A `POST /api/users` whose `user` object has no `username` is answered with 422 and
an `errors` envelope.

### R-062 — Registration requires a password

**Source:** Endpoints — Registration, "Required fields: `email`, `username`, `password`"
**Kind:** explicit
**Statement:** A `POST /api/users` whose `user` object has no `password` is answered with 422 and
an `errors` envelope.

### R-063 — Registration echoes the account it created

**Source:** Endpoints — Registration, "returns a User"
**Kind:** assumed
**Statement:** The `user.username` and `user.email` of a successful registration response are the
username and email the request sent.

### R-064 — A registration token authenticates

**Source:** Endpoints — Registration; "Authentication Header"
**Kind:** assumed
**Statement:** The `user.token` returned by a successful registration authenticates a later
request to an endpoint that requires authentication, as the account just created.

### R-065 — A new account has no bio and no image

**Source:** API response format — Users (for authentication), where both are `null`; Endpoints —
Registration, whose accepted fields are only username, email and password
**Kind:** assumed
**Statement:** The `bio` and `image` of an account that has just been registered are `null`,
since registration takes no value for either.

### R-066 — An email identifies one account

**Source:** Endpoints — Registration; Authentication, whose credentials are an email and a
password
**Kind:** assumed
**Statement:** A `POST /api/users` naming an email an account already holds is answered with 422
and an `errors` envelope, because a second account on the same email would make R-048 ambiguous.

### R-067 — A username identifies one account

**Source:** Endpoints — Get Profile, `GET /api/profiles/:username`
**Kind:** assumed
**Statement:** A `POST /api/users` naming a username an account already holds is answered with
422 and an `errors` envelope, because profiles are addressed by username and a second holder
would make that path ambiguous.

### R-068 — A registered password logs in

**Source:** Endpoints — Registration; Authentication
**Kind:** assumed
**Statement:** The email and password a registration was given are accepted by
`POST /api/users/login` afterwards, and answer with the same account.

### R-069 — The current-user endpoint returns the caller

**Source:** Endpoints — Get Current User, `GET /api/user`, "returns a User that's the current
user"
**Kind:** explicit
**Statement:** A `GET /api/user` authenticated with a user's token is answered with the User
document of that user.

### R-070 — The current-user endpoint requires a token

**Source:** Endpoints — Get Current User, "Authentication required"
**Kind:** explicit
**Statement:** A `GET /api/user` that carries no `Authorization` header is answered with 401.

### R-071 — The current-user endpoint reports what is stored

**Source:** Endpoints — Get Current User; Update User
**Kind:** assumed
**Statement:** The `email`, `username`, `bio` and `image` of a `GET /api/user` response are the
values the account currently holds, including any set by an earlier `PUT /api/user`.

### R-072 — Updating the user returns the updated document

**Source:** Endpoints — Update User, `PUT /api/user`, "returns the User"
**Kind:** explicit
**Statement:** A `PUT /api/user` that is carried out is answered with the User document of the
authenticated account.

### R-073 — Updating the user requires a token

**Source:** Endpoints — Update User, "Authentication required"
**Kind:** explicit
**Statement:** A `PUT /api/user` that carries no `Authorization` header is answered with 401.

### R-074 — The update accepts five fields

**Source:** Endpoints — Update User, "Accepted fields: `email`, `username`, `password`, `image`,
`bio`"
**Kind:** explicit
**Statement:** `PUT /api/user` accepts `email`, `username`, `password`, `image` and `bio`, and
requires none of them.

### R-075 — The update body is wrapped in a `user` key

**Source:** Endpoints — Update User, the example request body
**Kind:** explicit
**Statement:** The request body of `PUT /api/user` is a JSON object whose single top-level key is
`user`, holding the fields to change.

### R-076 — An updated field is reported with its new value

**Source:** Endpoints — Update User, "returns the User"
**Kind:** assumed
**Statement:** A field the request sent among the accepted ones is carried by the response with
the value that was sent; a document that still showed the old value would not be the updated user
the endpoint is documented to return.

### R-077 — A field the update omits keeps its value

**Source:** Endpoints — Update User, the example body sending three of the five accepted fields
**Kind:** assumed
**Statement:** A field the request did not send keeps the value the account already held, since
the endpoint documents accepted fields rather than required ones and its own example omits two.

### R-078 — An update outlives the request that made it

**Source:** Endpoints — Update User; Get Current User
**Kind:** assumed
**Statement:** A later `GET /api/user` authenticated as the same account reports the values that
`PUT /api/user` set.

### R-079 — A new password logs in

**Source:** Endpoints — Update User, whose accepted fields include `password`
**Kind:** assumed
**Statement:** After a `PUT /api/user` that sent a new password, `POST /api/users/login` with the
account's email and that new password is answered with a User document.

### R-080 — The replaced password stops logging in

**Source:** Endpoints — Update User, whose accepted fields include `password`
**Kind:** assumed
**Statement:** After a `PUT /api/user` that sent a new password, `POST /api/users/login` with the
account's email and the previous password is answered with a failure status and no user document.

### R-081 — A new username moves the profile

**Source:** Endpoints — Update User; Get Profile
**Kind:** assumed
**Statement:** After a `PUT /api/user` that sent a new username, `GET /api/profiles/:username`
under the new name is answered with that account's profile.

### R-082 — An update cannot take another account's email

**Source:** Endpoints — Update User; Registration
**Kind:** assumed
**Statement:** A `PUT /api/user` sending an email another account already holds is answered with
422 and an `errors` envelope, for the same reason as R-066.

### R-083 — An update cannot take another account's username

**Source:** Endpoints — Update User; Get Profile
**Kind:** assumed
**Statement:** A `PUT /api/user` sending a username another account already holds is answered
with 422 and an `errors` envelope, for the same reason as R-067.

### R-084 — An update that changes nothing still succeeds

**Source:** Endpoints — Update User, "Accepted fields"
**Kind:** assumed
**Statement:** A `PUT /api/user` whose `user` object carries none of the accepted fields is
answered with the unchanged User document rather than with 422, since none of the five is
required.

### R-085 — A profile is returned for a username

**Source:** Endpoints — Get Profile, `GET /api/profiles/:username`, "returns a Profile"
**Kind:** explicit
**Statement:** A `GET /api/profiles/:username` naming an existing account is answered with a
Profile document.

### R-086 — A profile may be read anonymously

**Source:** Endpoints — Get Profile, "Authentication optional"
**Kind:** explicit
**Statement:** A `GET /api/profiles/:username` that carries no `Authorization` header is answered
with the profile, not with 401.

### R-087 — A profile names the account that was asked for

**Source:** Endpoints — Get Profile; API response format — Profile
**Kind:** assumed
**Statement:** The `profile.username` of the response equals the `:username` segment of the path
that was requested.

### R-088 — An unknown profile is not found

**Source:** Endpoints — Get Profile; Error handling — "404 for Not found requests"
**Kind:** explicit
**Statement:** A `GET /api/profiles/:username` naming a username no account holds is answered
with 404.

### R-089 — A followed profile reports following true

**Source:** API response format — Profile; Endpoints — Follow user
**Kind:** assumed
**Statement:** A `GET /api/profiles/:username` authenticated as a user who follows that account
reports `following` as `true`.

### R-090 — An unfollowed profile reports following false

**Source:** API response format — Profile; Endpoints — Follow user
**Kind:** assumed
**Statement:** A `GET /api/profiles/:username` authenticated as a user who does not follow that
account reports `following` as `false`.

### R-091 — Following returns the profile

**Source:** Endpoints — Follow user, `POST /api/profiles/:username/follow`, "returns a Profile"
**Kind:** explicit
**Statement:** A `POST /api/profiles/:username/follow` naming an existing account is answered
with that account's Profile document.

### R-092 — Following requires a token

**Source:** Endpoints — Follow user, "Authentication required"
**Kind:** explicit
**Statement:** A `POST /api/profiles/:username/follow` that carries no `Authorization` header is
answered with 401.

### R-093 — Following takes no body

**Source:** Endpoints — Follow user, "No additional parameters required"
**Kind:** explicit
**Statement:** A `POST /api/profiles/:username/follow` is carried out with no request body and no
query parameter.

### R-094 — The profile returned by following reports following true

**Source:** Endpoints — Follow user, "returns a Profile"
**Kind:** assumed
**Statement:** The profile in the response to `POST /api/profiles/:username/follow` reports
`following` as `true`, since the request has just established that relationship.

### R-095 — Following outlives the request that made it

**Source:** Endpoints — Follow user; Get Profile
**Kind:** assumed
**Statement:** After a `POST /api/profiles/:username/follow`, a later `GET /api/profiles/:username`
authenticated as the same user reports `following` as `true`.

### R-096 — Following an unknown user is not found

**Source:** Endpoints — Follow user; Error handling — "404 for Not found requests"
**Kind:** explicit
**Statement:** A `POST /api/profiles/:username/follow` naming a username no account holds is
answered with 404.

### R-097 — Following runs one way

**Source:** API response format — Profile; Endpoints — Follow user
**Kind:** assumed
**Statement:** After one user follows another, a `GET /api/profiles/:username` for the follower,
authenticated as the account that was followed, still reports `following` as `false`.

### R-098 — Unfollowing returns the profile

**Source:** Endpoints — Unfollow user, `DELETE /api/profiles/:username/follow`, "returns a
Profile"
**Kind:** explicit
**Statement:** A `DELETE /api/profiles/:username/follow` naming an existing account is answered
with that account's Profile document.

### R-099 — Unfollowing requires a token

**Source:** Endpoints — Unfollow user, "Authentication required"
**Kind:** explicit
**Statement:** A `DELETE /api/profiles/:username/follow` that carries no `Authorization` header
is answered with 401.

### R-100 — Unfollowing takes no body

**Source:** Endpoints — Unfollow user, "No additional parameters required"
**Kind:** explicit
**Statement:** A `DELETE /api/profiles/:username/follow` is carried out with no request body and
no query parameter.

### R-101 — The profile returned by unfollowing reports following false

**Source:** Endpoints — Unfollow user, "returns a Profile"
**Kind:** assumed
**Statement:** The profile in the response to `DELETE /api/profiles/:username/follow` reports
`following` as `false`, since the request has just ended that relationship.

### R-102 — Unfollowing outlives the request that made it

**Source:** Endpoints — Unfollow user; Get Profile
**Kind:** assumed
**Statement:** After a `DELETE /api/profiles/:username/follow`, a later
`GET /api/profiles/:username` authenticated as the same user reports `following` as `false`.

### R-103 — Unfollowing an unknown user is not found

**Source:** Endpoints — Unfollow user; Error handling — "404 for Not found requests"
**Kind:** explicit
**Statement:** A `DELETE /api/profiles/:username/follow` naming a username no account holds is
answered with 404.

### R-104 — Listing articles returns several articles

**Source:** Endpoints — List Articles, `GET /api/articles`, "will return multiple articles"
**Kind:** explicit
**Statement:** A `GET /api/articles` is answered with a multiple-articles document.

### R-105 — Articles may be listed anonymously

**Source:** Endpoints — List Articles, "Authentication optional"
**Kind:** explicit
**Statement:** A `GET /api/articles` that carries no `Authorization` header is answered with the
list, not with 401.

### R-106 — The list is ordered newest first

**Source:** Endpoints — List Articles, "ordered by most recent first"
**Kind:** explicit
**Statement:** The entries of the `articles` array of `GET /api/articles` are ordered by
`createdAt` descending, so no entry is older than the entry after it.

### R-107 — An unfiltered list is global

**Source:** Endpoints — List Articles, "Returns most recent articles globally by default"
**Kind:** explicit
**Statement:** A `GET /api/articles` with no `tag`, `author` or `favorited` query parameter draws
from every article in the system, whoever wrote it.

### R-108 — The tag parameter filters by tag

**Source:** Endpoints — List Articles, "Filter by tag: `?tag=AngularJS`"
**Kind:** explicit
**Statement:** A `GET /api/articles?tag=X` returns only articles whose `tagList` contains `X`.

### R-109 — The author parameter filters by author

**Source:** Endpoints — List Articles, "Filter by author: `?author=jake`"
**Kind:** explicit
**Statement:** A `GET /api/articles?author=X` returns only articles whose `author.username` is
`X`.

### R-110 — The favorited parameter filters by who favorited

**Source:** Endpoints — List Articles, "Favorited by user: `?favorited=jake`"
**Kind:** explicit
**Statement:** A `GET /api/articles?favorited=X` returns only articles the account named `X` has
favorited.

### R-111 — The limit parameter caps the page

**Source:** Endpoints — List Articles, "Limit number of articles (default is 20): `?limit=20`"
**Kind:** explicit
**Statement:** A `GET /api/articles?limit=N` returns at most `N` entries in its `articles` array.

### R-112 — The limit defaults to twenty

**Source:** Endpoints — List Articles, "Limit number of articles (default is 20)"
**Kind:** explicit
**Statement:** A `GET /api/articles` with no `limit` parameter returns at most 20 entries in its
`articles` array.

### R-113 — The offset parameter skips from the front

**Source:** Endpoints — List Articles, "Offset/skip number of articles (default is 0):
`?offset=0`"
**Kind:** explicit
**Statement:** A `GET /api/articles?offset=N` omits the first `N` entries of the ordered result
and starts from the one after them.

### R-114 — The offset defaults to zero

**Source:** Endpoints — List Articles, "Offset/skip number of articles (default is 0)"
**Kind:** explicit
**Statement:** A `GET /api/articles` with no `offset` parameter starts from the most recent
article of the result.

### R-115 — A filter that matches nothing returns an empty list

**Source:** Endpoints — List Articles; API response format — Multiple Articles
**Kind:** assumed
**Statement:** A `GET /api/articles` whose filter matches no article is answered with an empty
`articles` array and `articlesCount` of 0, rather than with 404, since the collection exists and
the resource being addressed is the list.

### R-116 — Favorited in a list is relative to the caller

**Source:** API response format — Multiple Articles; Endpoints — List Articles, "Authentication
optional"
**Kind:** assumed
**Statement:** The `favorited` field of each entry of `GET /api/articles` describes whether the
authenticated caller has favorited that article, and is `false` for every entry when the request
is anonymous.

### R-117 — The feed returns several articles

**Source:** Endpoints — Feed Articles, `GET /api/articles/feed`, "will return multiple articles"
**Kind:** explicit
**Statement:** A `GET /api/articles/feed` is answered with a multiple-articles document.

### R-118 — The feed requires a token

**Source:** Endpoints — Feed Articles, "Authentication required"
**Kind:** explicit
**Statement:** A `GET /api/articles/feed` that carries no `Authorization` header is answered with
401.

### R-119 — The feed holds only followed authors

**Source:** Endpoints — Feed Articles, "will return multiple articles created by followed users"
**Kind:** explicit
**Statement:** Every entry of `GET /api/articles/feed` has an `author.username` the authenticated
user follows, and an article by an author that user does not follow is absent.

### R-120 — The feed is ordered newest first

**Source:** Endpoints — Feed Articles, "ordered by most recent first"
**Kind:** explicit
**Statement:** The entries of the `articles` array of `GET /api/articles/feed` are ordered by
`createdAt` descending.

### R-121 — The feed accepts a limit

**Source:** Endpoints — Feed Articles, "Can also take `limit` and `offset` query parameters like
List Articles"
**Kind:** explicit
**Statement:** A `GET /api/articles/feed?limit=N` returns at most `N` entries in its `articles`
array.

### R-122 — The feed accepts an offset

**Source:** Endpoints — Feed Articles, "Can also take `limit` and `offset` query parameters like
List Articles"
**Kind:** explicit
**Statement:** A `GET /api/articles/feed?offset=N` omits the first `N` entries of the ordered
result.

### R-123 — A feed with nothing followed is empty

**Source:** Endpoints — Feed Articles; API response format — Multiple Articles
**Kind:** assumed
**Statement:** A `GET /api/articles/feed` authenticated as a user who follows nobody is answered
with an empty `articles` array and `articlesCount` of 0.

### R-124 — Unfollowing empties the feed of that author

**Source:** Endpoints — Feed Articles; Unfollow user
**Kind:** assumed
**Statement:** After a user unfollows an author, no article by that author appears in that user's
`GET /api/articles/feed`, since the feed is defined by the follow relationship as it stands.

### R-125 — An article is returned for a slug

**Source:** Endpoints — Get Article, `GET /api/articles/:slug`, "will return single article"
**Kind:** explicit
**Statement:** A `GET /api/articles/:slug` naming an existing article is answered with a
single-article document for that article.

### R-126 — An article may be read anonymously

**Source:** Endpoints — Get Article, "No authentication required"
**Kind:** explicit
**Statement:** A `GET /api/articles/:slug` that carries no `Authorization` header is answered
with the article, not with 401.

### R-127 — A single article carries its body

**Source:** API response format — Single Article; the list-endpoint exception naming only
`GET /api/articles` and `GET /api/articles/feed`
**Kind:** explicit
**Statement:** The document returned by `GET /api/articles/:slug` carries the `body` field, which
the list endpoints omit.

### R-128 — An unknown slug is not found

**Source:** Endpoints — Get Article; Error handling — "404 for Not found requests"
**Kind:** explicit
**Statement:** A `GET /api/articles/:slug` naming a slug no article holds is answered with 404.

### R-129 — Creating an article returns it

**Source:** Endpoints — Create Article, `POST /api/articles`, "will return an Article"
**Kind:** explicit
**Statement:** A `POST /api/articles` carrying a title, a description and a body is answered with
a single-article document for the article it created.

### R-130 — Creating an article requires a token

**Source:** Endpoints — Create Article, "Authentication required"
**Kind:** explicit
**Statement:** A `POST /api/articles` that carries no `Authorization` header is answered with
401.

### R-131 — The create body is wrapped in an `article` key

**Source:** Endpoints — Create Article, the example request body
**Kind:** explicit
**Statement:** The request body of `POST /api/articles` is a JSON object whose single top-level
key is `article`.

### R-132 — Creating an article requires a title

**Source:** Endpoints — Create Article, "Required fields: `title`, `description`, `body`"
**Kind:** explicit
**Statement:** A `POST /api/articles` whose `article` object has no `title` is answered with 422
and an `errors` envelope.

### R-133 — Creating an article requires a description

**Source:** Endpoints — Create Article, "Required fields: `title`, `description`, `body`"
**Kind:** explicit
**Statement:** A `POST /api/articles` whose `article` object has no `description` is answered
with 422 and an `errors` envelope.

### R-134 — Creating an article requires a body

**Source:** Endpoints — Create Article, "Required fields: `title`, `description`, `body`"
**Kind:** explicit
**Statement:** A `POST /api/articles` whose `article` object has no `body` is answered with 422
and an `errors` envelope.

### R-135 — A tag list may be supplied at creation

**Source:** Endpoints — Create Article, "Optional fields: `tagList` as an array of Strings"
**Kind:** explicit
**Statement:** A `POST /api/articles` may carry a `tagList` array of strings, and the created
article carries those tags in its `tagList`.

### R-136 — An article created without tags has none

**Source:** Endpoints — Create Article, "Optional fields: `tagList`"; API response format —
Single Article
**Kind:** assumed
**Statement:** A `POST /api/articles` that sends no `tagList` creates an article whose `tagList`
is an empty array, since the field is documented as part of every article document and the
request supplied no entries.

### R-137 — The creator is the author

**Source:** Endpoints — Create Article, "Authentication required"; API response format — Single
Article
**Kind:** assumed
**Statement:** The `author.username` of the article returned by `POST /api/articles` is the
username of the authenticated account that sent the request.

### R-138 — A created article has a slug that fetches it

**Source:** Endpoints — Create Article; "The `slug` is the article's URL identifier … you can use
to fetch, update, and delete the article"
**Kind:** explicit
**Statement:** The article returned by `POST /api/articles` carries a `slug`, and
`GET /api/articles/:slug` under that value is answered with the same article.

### R-139 — Two articles with one title get two slugs

**Source:** Endpoints — Update Article, "duplicate titles must still produce distinct slugs"
**Kind:** explicit
**Statement:** Two successive `POST /api/articles` requests sending the same `title` are answered
with articles whose `slug` values differ.

### R-140 — A new article is not favorited

**Source:** API response format — Single Article, where `favorited` is `false`
**Kind:** assumed
**Statement:** The article returned by `POST /api/articles` reports `favorited` as `false`, since
nobody has had the opportunity to favorite it.

### R-141 — A new article has no favorites

**Source:** API response format — Single Article, where `favoritesCount` is `0`
**Kind:** assumed
**Statement:** The article returned by `POST /api/articles` reports `favoritesCount` as `0`.

### R-142 — A created article keeps what it was given

**Source:** Endpoints — Create Article; Get Article
**Kind:** assumed
**Statement:** A `GET /api/articles/:slug` for an article just created reports the same `title`,
`description` and `body` the create request sent.

### R-143 — A created article joins its author's articles

**Source:** Endpoints — Create Article; List Articles, "Filter by author"
**Kind:** assumed
**Statement:** An article just created appears in `GET /api/articles?author=X` where `X` is the
username of the account that created it.

### R-144 — A created article's tags join the tag list

**Source:** Endpoints — Get Tags, "returns a List of Tags"; Create Article
**Kind:** assumed
**Statement:** A tag sent in the `tagList` of a `POST /api/articles` appears in the `tags` array
of a later `GET /api/tags`, since a tag list nothing feeds would always be empty.

### R-145 — Updating an article returns it

**Source:** Endpoints — Update Article, `PUT /api/articles/:slug`, "returns the updated Article"
**Kind:** explicit
**Statement:** A `PUT /api/articles/:slug` that is carried out is answered with a single-article
document for the article as it now stands.

### R-146 — Updating an article requires a token

**Source:** Endpoints — Update Article, "Authentication required"
**Kind:** explicit
**Statement:** A `PUT /api/articles/:slug` that carries no `Authorization` header is answered
with 401.

### R-147 — The update accepts three fields

**Source:** Endpoints — Update Article, "Optional fields: `title`, `description`, `body`"
**Kind:** explicit
**Statement:** `PUT /api/articles/:slug` accepts `title`, `description` and `body` inside an
`article` object, and requires none of them.

### R-148 — Changing the title changes the slug

**Source:** Endpoints — Update Article, "The `slug` also gets updated when the `title` is
changed"
**Kind:** explicit
**Statement:** The article returned by a `PUT /api/articles/:slug` that sent a new `title`
carries a `slug` different from the one in the request path.

### R-149 — A field the article update omits keeps its value

**Source:** Endpoints — Update Article, the example body sending only `title`
**Kind:** assumed
**Statement:** A field the update did not send keeps the value the article already held, since
all three fields are documented as optional and the example sends one of them.

### R-150 — Only the author may update an article

**Source:** Error handling — "403 for Forbidden requests, when a request may be valid but the
user doesn't have permissions to perform the action"
**Kind:** assumed
**Statement:** A `PUT /api/articles/:slug` authenticated as an account other than the article's
author is answered with 403 and leaves the article unchanged.

### R-151 — Updating an unknown slug is not found

**Source:** Endpoints — Update Article; Error handling — "404 for Not found requests"
**Kind:** explicit
**Statement:** A `PUT /api/articles/:slug` naming a slug no article holds is answered with 404.

### R-152 — The new slug fetches the article

**Source:** Endpoints — Update Article, "The `slug` also gets updated when the `title` is
changed"; "you can use to fetch, update, and delete the article"
**Kind:** assumed
**Statement:** After a title change, `GET /api/articles/:slug` under the slug the update returned
is answered with that article.

### R-153 — An update moves the updated timestamp

**Source:** API response format — Single Article, whose example shows `updatedAt` later than
`createdAt`
**Kind:** assumed
**Statement:** The `updatedAt` of an article that a `PUT /api/articles/:slug` changed is later
than the `updatedAt` it carried before the request.

### R-154 — An update leaves the created timestamp alone

**Source:** API response format — Single Article
**Kind:** assumed
**Statement:** The `createdAt` of an article is the same before and after a
`PUT /api/articles/:slug`, since it records when the article was created and not when it was last
touched.

### R-155 — An article can be deleted

**Source:** Endpoints — Delete Article, `DELETE /api/articles/:slug`
**Kind:** explicit
**Statement:** A `DELETE /api/articles/:slug` sent by the article's author is answered with a
success status.

### R-156 — Deleting an article requires a token

**Source:** Endpoints — Delete Article, "Authentication required"
**Kind:** explicit
**Statement:** A `DELETE /api/articles/:slug` that carries no `Authorization` header is answered
with 401.

### R-157 — A deleted article can no longer be fetched

**Source:** Endpoints — Delete Article; Error handling — "404 for Not found requests"
**Kind:** assumed
**Statement:** After a `DELETE /api/articles/:slug`, a `GET /api/articles/:slug` under the same
slug is answered with 404.

### R-158 — A deleted article leaves the list

**Source:** Endpoints — Delete Article; List Articles
**Kind:** assumed
**Statement:** After a `DELETE /api/articles/:slug`, no entry with that slug appears in
`GET /api/articles`.

### R-159 — Only the author may delete an article

**Source:** Error handling — "403 for Forbidden requests, when a request may be valid but the
user doesn't have permissions to perform the action"
**Kind:** assumed
**Statement:** A `DELETE /api/articles/:slug` authenticated as an account other than the
article's author is answered with 403 and leaves the article fetchable.

### R-160 — Deleting an unknown slug is not found

**Source:** Endpoints — Delete Article; Error handling — "404 for Not found requests"
**Kind:** explicit
**Statement:** A `DELETE /api/articles/:slug` naming a slug no article holds is answered with
404.

### R-161 — Commenting returns the comment

**Source:** Endpoints — Add Comments to an Article, `POST /api/articles/:slug/comments`, "returns
the created Comment"
**Kind:** explicit
**Statement:** A `POST /api/articles/:slug/comments` carrying a body is answered with a
single-comment document for the comment it created.

### R-162 — Commenting requires a token

**Source:** Endpoints — Add Comments to an Article, "Authentication required"
**Kind:** explicit
**Statement:** A `POST /api/articles/:slug/comments` that carries no `Authorization` header is
answered with 401.

### R-163 — The comment body is wrapped in a `comment` key

**Source:** Endpoints — Add Comments to an Article, the example request body
**Kind:** explicit
**Statement:** The request body of `POST /api/articles/:slug/comments` is a JSON object whose
single top-level key is `comment`.

### R-164 — A comment requires a body

**Source:** Endpoints — Add Comments to an Article, "Required field: `body`"
**Kind:** explicit
**Statement:** A `POST /api/articles/:slug/comments` whose `comment` object has no `body` is
answered with 422 and an `errors` envelope.

### R-165 — The commenter is the comment's author

**Source:** Endpoints — Add Comments to an Article, "Authentication required"; API response
format — Single Comment
**Kind:** assumed
**Statement:** The `author.username` of the comment returned by
`POST /api/articles/:slug/comments` is the username of the authenticated account that sent the
request.

### R-166 — A comment joins its article

**Source:** Endpoints — Add Comments to an Article; Get Comments from an Article
**Kind:** assumed
**Statement:** A comment just created appears in the `comments` array of a
`GET /api/articles/:slug/comments` for the same article, carrying the body that was sent.

### R-167 — Commenting on an unknown slug is not found

**Source:** Endpoints — Add Comments to an Article; Error handling — "404 for Not found requests"
**Kind:** explicit
**Statement:** A `POST /api/articles/:slug/comments` naming a slug no article holds is answered
with 404.

### R-168 — A created comment carries the identifier that deletes it

**Source:** Endpoints — Delete Comment, `DELETE /api/articles/:slug/comments/:id`
**Kind:** assumed
**Statement:** The `id` of the comment returned by `POST /api/articles/:slug/comments` is the
value that addresses that comment as `:id` in a later delete request.

### R-169 — An article's comments can be listed

**Source:** Endpoints — Get Comments from an Article, `GET /api/articles/:slug/comments`,
"returns multiple comments"
**Kind:** explicit
**Statement:** A `GET /api/articles/:slug/comments` naming an existing article is answered with a
multiple-comments document.

### R-170 — Comments may be read anonymously

**Source:** Endpoints — Get Comments from an Article, "Authentication optional"
**Kind:** explicit
**Statement:** A `GET /api/articles/:slug/comments` that carries no `Authorization` header is
answered with the comments, not with 401.

### R-171 — An article with no comments has an empty list

**Source:** Endpoints — Get Comments from an Article; API response format — Multiple Comments
**Kind:** assumed
**Statement:** A `GET /api/articles/:slug/comments` for an article nobody has commented on is
answered with an empty `comments` array, not with 404, since the article exists.

### R-172 — Listing comments of an unknown slug is not found

**Source:** Endpoints — Get Comments from an Article; Error handling — "404 for Not found
requests"
**Kind:** explicit
**Statement:** A `GET /api/articles/:slug/comments` naming a slug no article holds is answered
with 404.

### R-173 — Comments belong to one article

**Source:** Endpoints — Get Comments from an Article, whose path names the article
**Kind:** assumed
**Statement:** Every entry of `GET /api/articles/:slug/comments` was created against that slug,
and a comment made on another article is absent.

### R-174 — A comment can be deleted

**Source:** Endpoints — Delete Comment, `DELETE /api/articles/:slug/comments/:id`
**Kind:** explicit
**Statement:** A `DELETE /api/articles/:slug/comments/:id` sent by the comment's author is
answered with a success status.

### R-175 — Deleting a comment requires a token

**Source:** Endpoints — Delete Comment, "Authentication required"
**Kind:** explicit
**Statement:** A `DELETE /api/articles/:slug/comments/:id` that carries no `Authorization` header
is answered with 401.

### R-176 — A deleted comment leaves the list

**Source:** Endpoints — Delete Comment; Get Comments from an Article
**Kind:** assumed
**Statement:** After a `DELETE /api/articles/:slug/comments/:id`, no entry with that `id` appears
in `GET /api/articles/:slug/comments`.

### R-177 — Only the author may delete a comment

**Source:** Error handling — "403 for Forbidden requests, when a request may be valid but the
user doesn't have permissions to perform the action"
**Kind:** assumed
**Statement:** A `DELETE /api/articles/:slug/comments/:id` authenticated as an account other than
the comment's author is answered with 403 and leaves the comment in the list.

### R-178 — Deleting an unknown comment is not found

**Source:** Endpoints — Delete Comment; Error handling — "404 for Not found requests"
**Kind:** explicit
**Statement:** A `DELETE /api/articles/:slug/comments/:id` naming an `id` no comment holds is
answered with 404.

### R-179 — A comment is deleted through its own article

**Source:** Endpoints — Delete Comment, whose path names both the slug and the identifier
**Kind:** assumed
**Statement:** A `DELETE /api/articles/:slug/comments/:id` whose `id` belongs to a comment on a
different article is answered with 404 and leaves that comment in place.

### R-180 — Favoriting returns the article

**Source:** Endpoints — Favorite Article, `POST /api/articles/:slug/favorite`, "returns the
Article"
**Kind:** explicit
**Statement:** A `POST /api/articles/:slug/favorite` naming an existing article is answered with
a single-article document for that article.

### R-181 — Favoriting requires a token

**Source:** Endpoints — Favorite Article, "Authentication required"
**Kind:** explicit
**Statement:** A `POST /api/articles/:slug/favorite` that carries no `Authorization` header is
answered with 401.

### R-182 — Favoriting takes no body

**Source:** Endpoints — Favorite Article, "No additional parameters required"
**Kind:** explicit
**Statement:** A `POST /api/articles/:slug/favorite` is carried out with no request body and no
query parameter.

### R-183 — The article returned by favoriting is favorited

**Source:** Endpoints — Favorite Article, "returns the Article"
**Kind:** assumed
**Statement:** The article in the response to `POST /api/articles/:slug/favorite` reports
`favorited` as `true`, since the request has just established that relationship.

### R-184 — Favoriting raises the count by one

**Source:** API response format — Single Article, `favoritesCount`; Endpoints — Favorite Article
**Kind:** assumed
**Statement:** The `favoritesCount` of the article in the response to
`POST /api/articles/:slug/favorite` is one greater than the value the same article carried before
the request.

### R-185 — Favoriting an unknown slug is not found

**Source:** Endpoints — Favorite Article; Error handling — "404 for Not found requests"
**Kind:** explicit
**Statement:** A `POST /api/articles/:slug/favorite` naming a slug no article holds is answered
with 404.

### R-186 — A favorited article joins the favorited filter

**Source:** Endpoints — Favorite Article; List Articles, "Favorited by user: `?favorited=jake`"
**Kind:** assumed
**Statement:** After a user favorites an article, that article appears in
`GET /api/articles?favorited=X` where `X` is that user's username.

### R-187 — Favoriting is personal but the count is not

**Source:** API response format — Single Article; Endpoints — Favorite Article
**Kind:** assumed
**Statement:** A `GET /api/articles/:slug` authenticated as a second account, for an article the
first account favorited, reports the raised `favoritesCount` while reporting `favorited` as
`false`.

### R-188 — Unfavoriting returns the article

**Source:** Endpoints — Unfavorite Article, `DELETE /api/articles/:slug/favorite`, "returns the
Article"
**Kind:** explicit
**Statement:** A `DELETE /api/articles/:slug/favorite` naming an existing article is answered
with a single-article document for that article.

### R-189 — Unfavoriting requires a token

**Source:** Endpoints — Unfavorite Article, "Authentication required"
**Kind:** explicit
**Statement:** A `DELETE /api/articles/:slug/favorite` that carries no `Authorization` header is
answered with 401.

### R-190 — Unfavoriting takes no body

**Source:** Endpoints — Unfavorite Article, "No additional parameters required"
**Kind:** explicit
**Statement:** A `DELETE /api/articles/:slug/favorite` is carried out with no request body and no
query parameter.

### R-191 — The article returned by unfavoriting is not favorited

**Source:** Endpoints — Unfavorite Article, "returns the Article"
**Kind:** assumed
**Statement:** The article in the response to `DELETE /api/articles/:slug/favorite` reports
`favorited` as `false`, since the request has just ended that relationship.

### R-192 — Unfavoriting lowers the count by one

**Source:** API response format — Single Article, `favoritesCount`; Endpoints — Unfavorite
Article
**Kind:** assumed
**Statement:** The `favoritesCount` of the article in the response to
`DELETE /api/articles/:slug/favorite`, sent by a user who had favorited it, is one less than the
value the same article carried before the request.

### R-193 — Unfavoriting an unknown slug is not found

**Source:** Endpoints — Unfavorite Article; Error handling — "404 for Not found requests"
**Kind:** explicit
**Statement:** A `DELETE /api/articles/:slug/favorite` naming a slug no article holds is answered
with 404.

### R-194 — An unfavorited article leaves the favorited filter

**Source:** Endpoints — Unfavorite Article; List Articles, "Favorited by user: `?favorited=jake`"
**Kind:** assumed
**Statement:** After a user unfavorites an article, that article is absent from
`GET /api/articles?favorited=X` where `X` is that user's username.

### R-195 — The tags endpoint returns the tag list

**Source:** Endpoints — Get Tags, `GET /api/tags`, "returns a List of Tags"
**Kind:** explicit
**Statement:** A `GET /api/tags` is answered with a document carrying the `tags` array.

### R-196 — Tags may be read anonymously

**Source:** Endpoints — Get Tags, "No authentication required"
**Kind:** explicit
**Statement:** A `GET /api/tags` that carries no `Authorization` header is answered with the tag
list, not with 401.

### R-197 — The tag list is drawn from the articles

**Source:** Endpoints — Get Tags; Create Article, "Optional fields: `tagList`"
**Kind:** assumed
**Statement:** The `tags` array holds the tags that articles carry, and a tag no article carries
is absent from it.

### R-198 — A tag is listed once

**Source:** API response format — List of Tags
**Kind:** assumed
**Statement:** No string appears twice in the `tags` array, however many articles carry that tag,
since the document is a list of tags rather than a list of taggings.

### R-199 — A preflight request is answered

**Source:** CORS — "make sure to handle `OPTIONS` too"
**Kind:** explicit
**Statement:** An `OPTIONS` request to an endpoint of the API is answered rather than refused as
an unknown method, when the API is served to a frontend on another host or port.

### R-200 — A preflight response names the allowed origin

**Source:** CORS — "return correct `Access-Control-Allow-Origin`"
**Kind:** explicit
**Statement:** The response to an `OPTIONS` request carries the `Access-Control-Allow-Origin`
header.

### R-201 — A preflight response names the allowed headers

**Source:** CORS — "return correct … `Access-Control-Allow-Headers` (e.g. `Content-Type`)"
**Kind:** explicit
**Statement:** The response to an `OPTIONS` request carries the `Access-Control-Allow-Headers`
header, listing at least `Content-Type`.

## Assumed rules

Every rule above whose `Kind` is `assumed`, with the reason the specification is taken to imply
it. Each is a place where the prose is silent and the behaviour would otherwise be undefined or
self-contradictory.

- R-002 — the specification writes the header exactly one way, and a server that also accepted
  `Bearer` would be honouring a credential format no client is told about.
- R-004 — 401 is defined for a request that "requires authentication but it isn't provided"; a
  token the API cannot accept provides nothing, so the two cases cannot sensibly differ.
- R-005 — "returns a User that's the current user" only means something if a token picks out one
  account.
- R-008 — "optional" would be a strange word for a header that is ignored, and `following` and
  `favorited` have no value to report unless a caller can be identified.
- R-009 — the same two fields have to hold something when nobody is identified, and `false` is
  the only value that does not claim a relationship that does not exist.
- R-015 — the specification lists 401, 403, 404 and 422 as the failures and never names the
  success code, while stating for every endpoint what it returns; 200 is the only code under
  which those documents are the response to a plain GET or POST.
- R-017 — a body that carried both `errors` and a resource document would leave a client unable
  to tell whether the request was carried out.
- R-021 — the specification prints `jwt.token.here` as the value of `user.token` and as the value
  of the `Authorization` header; nothing else in the document connects the two, and without the
  connection no client could ever authenticate.
- R-022 — the user document is enumerated field by field and holds no password, and a password
  travelling back out would make the field list wrong.
- R-031 — the field is named a count of favorites and Favorite Article is the only thing that
  creates one; a count that varied by caller would duplicate `favorited`.
- R-033 — the response format defines the field only by example, and a caller has to be able to
  parse and order the value for "ordered by most recent first" to be checkable at all.
- R-044 — `DELETE /api/articles/:slug/comments/:id` addresses a comment by its identifier, which
  is only well defined if the identifier belongs to one comment.
- R-053 — a login that answered with somebody else's document would make the endpoint useless.
- R-054 — the endpoint's whole purpose is to hand out the credential the header rule describes.
- R-055 — issuing a token for an email no account holds would contradict R-005.
- R-056 — a password that is not checked is not a credential, and the field would have no reason
  to be required.
- R-063 — an account created under a different name than the one that was sent would make the
  request unrepeatable and the response unreadable.
- R-064 — registration returns a User, whose token field is the credential by R-021.
- R-065 — registration accepts no bio and no image, and the response format shows both as `null`
  for exactly this reason.
- R-066 — login takes an email and a password; two accounts on one email would make the login
  result undefined.
- R-067 — `GET /api/profiles/:username` addresses an account by username; two holders would make
  that path undefined.
- R-068 — registration and login are the same credential pair, and an account that could not log
  in afterwards would be unreachable.
- R-071 — an endpoint that returned values other than the current ones would make Update User
  unverifiable.
- R-076 — "returns the User" after an update means the updated user; the old values would not be
  that.
- R-077 — the fields are accepted, not required, and the specification's own example sends three
  of the five; a request that silently cleared the other two would make partial updates
  impossible.
- R-078 — an update that did not persist would leave nothing for Get Current User to return.
- R-079 — `password` is an accepted field, and changing it has no observable meaning other than
  which password logs in.
- R-080 — a password change that left the old one working would not be a change.
- R-081 — profiles are addressed by username, so a username change has to move the address or
  R-067 breaks.
- R-082 — the uniqueness that R-066 requires cannot depend on which endpoint set the value.
- R-083 — the uniqueness that R-067 requires cannot depend on which endpoint set the value.
- R-084 — none of the five fields is required, so their absence cannot be a validation failure.
- R-087 — a profile endpoint that answered for a different account than the path named would make
  every other profile rule uncheckable.
- R-089 — `following` is a field of the profile and Follow user is the only thing that sets it;
  `true` after following is the only reading that makes the endpoint pair meaningful.
- R-090 — the same field must be `false` when no such relationship exists, or it carries no
  information.
- R-094 — the endpoint returns a Profile rather than nothing, which is only useful if the profile
  shows the state the request just produced.
- R-095 — a follow that did not persist would leave the feed with nothing to select on.
- R-097 — the endpoint follows the account named in the path and says nothing about the reverse
  direction; a follow that worked both ways would make Unfollow ambiguous about whose
  relationship it ends.
- R-101 — the same reasoning as R-094, in the other direction.
- R-102 — the same reasoning as R-095, in the other direction.
- R-115 — the resource being addressed is the collection, which exists; 404 is defined for a
  resource that cannot be found, and the multiple-articles document has a shape for holding
  nothing.
- R-116 — `favorited` is a per-caller field by R-009 and R-031, and the list entries carry it.
- R-123 — the feed is defined as the articles of followed users; with no followed users the
  selection is empty, and the document has a shape for that.
- R-124 — the feed is defined by the follow relationship, so it has to follow the relationship
  when it ends.
- R-136 — `tagList` is part of every article document, and an article created without tags has to
  carry something; an empty array is the only value consistent with R-028.
- R-137 — creation requires authentication and the article carries an author; no other account is
  named anywhere in the request.
- R-140 — the article has just come into existence, so no user can yet have favorited it.
- R-141 — the same reasoning as R-140, for the count.
- R-142 — an article that did not keep the fields it was created with would make Create Article
  meaningless.
- R-143 — `?author=` selects by author, and the article's author is the creator by R-137.
- R-144 — the tags endpoint returns a list of tags and nothing else in the specification creates
  a tag; if creation did not feed it, it could only ever be empty.
- R-149 — all three fields are optional and the example sends one; an update that cleared the
  others would make partial updates impossible.
- R-150 — 403 is defined for a valid request by a user without the permission, and article
  editing is the case the definition fits; the alternative is that anyone may rewrite anyone's
  article.
- R-152 — the slug is the identifier used to fetch the article, and the update is documented to
  change it; the new value has to be the one that works.
- R-153 — the two timestamps are separate fields and the example shows them differing; a field
  named `updatedAt` that never moved would carry no information.
- R-154 — `createdAt` records creation, which an update does not repeat.
- R-157 — deletion that left the article fetchable would not be deletion, and 404 is the defined
  answer for a resource that is not there.
- R-158 — the same reasoning as R-157, for the collection.
- R-159 — the same reasoning as R-150, for deletion.
- R-165 — commenting requires authentication and the comment carries an author; no other account
  is named in the request.
- R-166 — a comment that did not join its article would make the create endpoint pointless and
  the list endpoint always empty.
- R-168 — the delete path takes the identifier the create response returns; there is no other
  place to get one.
- R-171 — the article exists, so 404 does not apply, and the multiple-comments document has a
  shape for holding nothing.
- R-173 — the path names the article, so a list that mixed in other articles' comments would make
  the segment meaningless.
- R-176 — a deletion that left the comment listed would not be a deletion.
- R-177 — the same reasoning as R-150, for comments.
- R-179 — both segments are part of the address; honouring the identifier alone would let a
  comment be deleted through an article it does not belong to.
- R-183 — the endpoint returns the Article rather than nothing, which is only useful if it shows
  the state the request just produced.
- R-184 — `favoritesCount` counts favorites by R-031, and this request adds one.
- R-186 — `?favorited=` selects the articles a user has favorited, which is what this request
  records.
- R-187 — `favorited` is per-caller by R-009 while `favoritesCount` is not by R-031; the two
  statements only coexist if a second caller sees the count but not the flag.
- R-191 — the same reasoning as R-183, in the other direction.
- R-192 — the same reasoning as R-184, in the other direction.
- R-194 — the same reasoning as R-186, in the other direction.
- R-197 — the specification gives no other way for a tag to come into existence than an article
  carrying it.
- R-198 — the document is called a list of tags, and repetition would make it a list of usages
  with no way to tell how many.

## Open questions

- The specification names itself the lesser authority: "the OpenAPI spec and the Hurl suite are
  what actually define it. Where the prose and the tests disagree, the tests win." Neither the
  OpenAPI document nor the Hurl suite is part of `spec/conduit-api.md`, so every rule above rests
  on prose the source itself calls secondary. Nothing in this file can be resolved against them.
- No success status code is stated anywhere. R-015 assumes 200 throughout, including for the two
  endpoints that create a resource, `POST /api/users` and `POST /api/articles`, where 201 would
  be the conventional answer. R-129, R-155, R-161 and R-174 inherit the same uncertainty.
- What `articlesCount` counts is undefined. In the example it equals the number of entries
  returned, but with `limit` or `offset` in play it could be the size of the page or the size of
  the whole filtered set. R-038 therefore states only that it is a number, and R-111 to R-114 say
  nothing about it.
- Whether the list filters combine is undefined. List Articles says "provide `tag`, `author` or
  `favorited`", which reads as a choice of one; R-108, R-109 and R-110 each describe one
  parameter alone, and a request carrying two is not covered by any rule here.
- How a failed login is reported is undefined. 401 is defined for credentials that are not
  provided, 403 for a user without permission, 422 for a request that fails validation, and a
  wrong password fits none of the three cleanly. R-055 and R-056 therefore state only that no
  user document comes back.
- Whether the old slug still resolves after a title change is undefined. R-148 and R-152 cover
  the new slug; the specification says the slug "gets updated" without saying whether the
  previous one becomes a 404, redirects, or keeps working.
- What the delete endpoints return is undefined. Delete Article and Delete Comment are the only
  two entries with no "returns" clause at all, so R-155 and R-174 state a success status and say
  nothing about the body.
- Whether repeating an action that has already been taken is an error is undefined. Following a
  user already followed, unfollowing a user not followed, and favoriting an article already
  favorited are all unmentioned; R-091, R-098, R-180 and R-188 describe only the first such
  request, and R-184 and R-192 are written against the state before the request.
- Whether an account can follow itself, and whether its own articles appear in its feed, is
  undefined. R-119 says the feed holds articles by followed authors, which settles the question
  only once the self-follow question is settled.
- No constraint on the content of `username`, `email` or `password` is stated — no length, no
  character set, not even that `email` looks like an address. R-060 to R-062 therefore cover only
  absence, and any rule about a too-long username would be invention rather than assumption.
- Whether `tagList` can be changed after creation is undefined. Create Article accepts it and
  Update Article lists only `title`, `description` and `body`; R-147 records the accepted three
  without saying whether a `tagList` sent to the update is ignored or refused.
- Which of 403 and 404 wins when both apply is undefined — a request by a non-author against a
  slug that does not exist. R-150, R-151, R-159 and R-160 each describe one condition in
  isolation.
- Whether an invalid token on an optional-authentication endpoint is refused or treated as
  anonymous is undefined. R-004 covers the endpoints that require authentication; for Get
  Profile, List Articles and Get Comments the specification says nothing.
- How the API answers a `limit` or `offset` that is not a number, or is negative, is undefined.
  R-111 to R-114 describe only well-formed values.
- The CORS section is conditional — "if the backend is about to run on a different host/port than
  the frontend". R-199 to R-201 are stated as rules of the API, but whether they apply to a given
  deployment depends on how it is served, which the specification leaves to the implementer.
- Get Article is documented as "No authentication required", the same phrase as Registration and
  Get Tags, while List Articles and Get Comments are documented as "Authentication optional". The
  single article it returns nevertheless carries `favorited` and an `author.following`, both of
  which are relative to the caller by R-009, R-029 and R-116. Either the phrase means the token is
  ignored, in which case those two fields can never be `true` on R-125, or the two phrases mean
  the same thing and the distinction the endpoint list draws is empty.
