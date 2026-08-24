# Conduit API — rules extracted from the specification

Produced by the `ba` agent from [`spec/conduit-api.md`](../spec/conduit-api.md), and from nothing
else. Every rule below is a statement about **what the API is supposed to do**. Whether the
deployment under test actually does it is not asked here and not answered here.

Vocabulary: paths are written as the specification writes them, with the `/api` prefix. "The
caller is authenticated" means the request carries `Authorization: Token <token>` with a token the
API issued.

## Rules

### R-001 — JSON responses declare a JSON content type
**Source:** §API response format — "Make sure the right content type like `Content-Type: application/json; charset=utf-8` is correctly returned"
**Kind:** explicit
**Statement:** A response carrying a JSON body has a `Content-Type` header of `application/json`.

### R-002 — A failed validation answers 422
**Source:** §Error handling — "If a request fails any validations, expect a 422"
**Kind:** explicit
**Statement:** A request that fails any validation is answered with status 422.

### R-003 — A failed validation answers with an errors object
**Source:** §Error handling — the `{"errors":{"body":["can't be empty"]}}` example
**Kind:** explicit
**Statement:** A 422 body is an object with one key, `errors`, whose values are arrays of strings.

### R-004 — A missing credential answers 401
**Source:** §Error handling — "401 for Unauthorized requests, when a request requires authentication but it isn't provided"
**Kind:** explicit
**Statement:** A request to an endpoint marked "Authentication required" sent with no `Authorization` header is answered with status 401.

### R-005 — A forbidden action answers 403
**Source:** §Error handling — "403 for Forbidden requests, when a request may be valid but the user doesn't have permissions"
**Kind:** explicit
**Statement:** A well-formed request from a caller who lacks permission for the action is answered with status 403.

### R-006 — A missing resource answers 404
**Source:** §Error handling — "404 for Not found requests, when a resource can't be found to fulfill the request"
**Kind:** explicit
**Statement:** A request naming a resource that does not exist is answered with status 404.

### R-007 — Credentials travel in the Authorization header
**Source:** §Endpoints — "Authentication Header: `Authorization: Token jwt.token.here`"
**Kind:** explicit
**Statement:** An authenticated endpoint accepts credentials as the header `Authorization: Token <token>`.

### R-008 — The credential is the token from the User object
**Source:** §Endpoints — Authentication Header, read against §API response format — Users
**Kind:** assumed
**Statement:** The `user.token` returned by registration or login is accepted as `<token>` in the Authorization header.

### R-009 — An optional-authentication endpoint serves anonymous callers
**Source:** §Endpoints — the "Authentication optional" endpoints
**Kind:** assumed
**Statement:** An endpoint marked "Authentication optional" answers a request with no Authorization header without a 401.

### R-010 — Preflight requests are answered
**Source:** §CORS — "make sure to handle `OPTIONS` too"
**Kind:** explicit
**Statement:** An `OPTIONS` request to an API path is answered with a non-error status rather than 404 or 405.

### R-011 — Cross-origin responses carry the access-control headers
**Source:** §CORS — "return correct `Access-Control-Allow-Origin` and `Access-Control-Allow-Headers`"
**Kind:** explicit
**Statement:** A response to a request carrying an `Origin` header includes `Access-Control-Allow-Origin` and `Access-Control-Allow-Headers`.

### R-012 — Registration returns a User
**Source:** §Endpoints — Registration, "returns a User"
**Kind:** explicit
**Statement:** `POST /api/users` with `user.username`, `user.email` and `user.password` answers with a body containing a `user` object.

### R-013 — The User object has five fields
**Source:** §API response format — Users (for authentication)
**Kind:** explicit
**Statement:** A returned `user` object has exactly the fields `email`, `token`, `username`, `bio` and `image`.

### R-014 — Registration requires an email
**Source:** §Endpoints — Registration, "Required fields: `email`, `username`, `password`"
**Kind:** explicit
**Statement:** `POST /api/users` without `user.email` answers 422 with an entry under `errors`.

### R-015 — Registration requires a username
**Source:** §Endpoints — Registration, "Required fields: `email`, `username`, `password`"
**Kind:** explicit
**Statement:** `POST /api/users` without `user.username` answers 422 with an entry under `errors`.

### R-016 — Registration requires a password
**Source:** §Endpoints — Registration, "Required fields: `email`, `username`, `password`"
**Kind:** explicit
**Statement:** `POST /api/users` without `user.password` answers 422 with an entry under `errors`.

### R-017 — Registration is open to anonymous callers
**Source:** §Endpoints — Registration, "No authentication required"
**Kind:** explicit
**Statement:** `POST /api/users` succeeds when the request carries no `Authorization` header.

### R-018 — A new account has no bio and no image
**Source:** §API response format — Users, where `bio` and `image` are `null`
**Kind:** assumed
**Statement:** The `user` object returned by `POST /api/users` has `bio` null and `image` null.

### R-019 — An email identifies one account
**Source:** §Endpoints — Registration, read against §Endpoints — Authentication, which looks an account up by email alone
**Kind:** assumed
**Statement:** `POST /api/users` with an email that is already registered answers 422 with an `errors.email` entry.

### R-020 — A username identifies one account
**Source:** §Endpoints — Get Profile, `GET /api/profiles/:username`, which addresses an account by username alone
**Kind:** assumed
**Statement:** `POST /api/users` with a username that is already registered answers 422 with an `errors.username` entry.

### R-021 — The registration token authenticates the new account
**Source:** §Endpoints — Registration and Get Current User
**Kind:** assumed
**Statement:** `GET /api/user` sent with the token from a registration answers 200 with the email that was registered.

### R-022 — Login returns a User
**Source:** §Endpoints — Authentication, "returns a User"
**Kind:** explicit
**Statement:** `POST /api/users/login` with the email and password of an existing account answers with a body containing a `user` object.

### R-023 — Login requires an email
**Source:** §Endpoints — Authentication, "Required fields: `email`, `password`"
**Kind:** explicit
**Statement:** `POST /api/users/login` without `user.email` answers 422 with an entry under `errors`.

### R-024 — Login requires a password
**Source:** §Endpoints — Authentication, "Required fields: `email`, `password`"
**Kind:** explicit
**Statement:** `POST /api/users/login` without `user.password` answers 422 with an entry under `errors`.

### R-025 — Login is open to anonymous callers
**Source:** §Endpoints — Authentication, "No authentication required"
**Kind:** explicit
**Statement:** `POST /api/users/login` succeeds when the request carries no `Authorization` header.

### R-026 — A wrong password yields no token
**Source:** §Endpoints — Authentication, read against §Error handling
**Kind:** assumed
**Statement:** `POST /api/users/login` with a known email and a password that does not match answers with a body containing no `user.token`.

### R-027 — An unknown email yields no token
**Source:** §Endpoints — Authentication, read against §Error handling
**Kind:** assumed
**Statement:** `POST /api/users/login` with an email that belongs to no account answers with a body containing no `user.token`.

### R-028 — Login returns the account that owns the email
**Source:** §Endpoints — Authentication, "returns a User"
**Kind:** assumed
**Statement:** The `user.email` in a successful login response equals the email sent in the request.

### R-029 — The current user endpoint returns the caller
**Source:** §Endpoints — Get Current User, "returns a User that's the current user"
**Kind:** explicit
**Statement:** `GET /api/user` with a valid token answers with the `user` object of the account that owns the token.

### R-030 — The current user endpoint requires authentication
**Source:** §Endpoints — Get Current User, "Authentication required"
**Kind:** explicit
**Statement:** `GET /api/user` with no `Authorization` header answers 401.

### R-031 — The current user response is a User object
**Source:** §API response format — Users (for authentication)
**Kind:** explicit
**Statement:** The body of a successful `GET /api/user` contains a `user` object with the five User fields.

### R-032 — An unissued token is not a credential
**Source:** §Error handling — 401, read against §Endpoints — Authentication Header
**Kind:** assumed
**Statement:** `GET /api/user` with an `Authorization: Token` value the API never issued answers 401.

### R-033 — Updating the user returns the updated User
**Source:** §Endpoints — Update User, "returns the User"
**Kind:** explicit
**Statement:** `PUT /api/user` with a valid token answers with a `user` object carrying the submitted values.

### R-034 — The update accepts five fields
**Source:** §Endpoints — Update User, "Accepted fields: `email`, `username`, `password`, `image`, `bio`"
**Kind:** explicit
**Statement:** `PUT /api/user` carrying only fields drawn from `email`, `username`, `password`, `image` and `bio` is not answered 422.

### R-035 — An updated bio survives the request
**Source:** §Endpoints — Update User
**Kind:** assumed
**Statement:** A `GET /api/user` issued after a `PUT /api/user` that set `bio` returns that same `bio`.

### R-036 — The update is partial
**Source:** §Endpoints — Update User, whose example body carries three of the five accepted fields
**Kind:** assumed
**Statement:** A `PUT /api/user` that omits an accepted field leaves that field's previous value in place.

### R-037 — The update requires authentication
**Source:** §Endpoints — Update User, "Authentication required"
**Kind:** explicit
**Statement:** `PUT /api/user` with no `Authorization` header answers 401.

### R-038 — A changed password becomes the login password
**Source:** §Endpoints — Update User, `password` among the accepted fields
**Kind:** assumed
**Statement:** `POST /api/users/login` with the password set by a preceding `PUT /api/user` answers with a `user.token`.

### R-039 — An email stays unique across updates
**Source:** §Endpoints — Update User, read against R-019
**Kind:** assumed
**Statement:** `PUT /api/user` setting an email that another account already uses answers 422 with an `errors.email` entry.

### R-040 — A profile is addressed by username
**Source:** §Endpoints — Get Profile, "returns a Profile"
**Kind:** explicit
**Statement:** `GET /api/profiles/:username` for an existing account answers with a body containing a `profile` object.

### R-041 — The Profile object has four fields
**Source:** §API response format — Profile
**Kind:** explicit
**Statement:** A returned `profile` object has exactly the fields `username`, `bio`, `image` and `following`.

### R-042 — Reading a profile does not require authentication
**Source:** §Endpoints — Get Profile, "Authentication optional"
**Kind:** explicit
**Statement:** `GET /api/profiles/:username` with no `Authorization` header answers with a `profile` object.

### R-043 — An unknown username has no profile
**Source:** §Error handling — 404
**Kind:** explicit
**Statement:** `GET /api/profiles/:username` for a username that belongs to no account answers 404.

### R-044 — An anonymous reader follows nobody
**Source:** §API response format — Profile, the `following` field
**Kind:** assumed
**Statement:** `GET /api/profiles/:username` with no `Authorization` header returns `profile.following` false.

### R-045 — Following returns a Profile
**Source:** §Endpoints — Follow user, "returns a Profile"
**Kind:** explicit
**Statement:** `POST /api/profiles/:username/follow` with a valid token answers with a body containing a `profile` object.

### R-046 — Following is recorded in the returned profile
**Source:** §Endpoints — Follow user, read against §API response format — Profile
**Kind:** assumed
**Statement:** The `profile.following` returned by `POST /api/profiles/:username/follow` is true.

### R-047 — Following requires authentication
**Source:** §Endpoints — Follow user, "Authentication required"
**Kind:** explicit
**Statement:** `POST /api/profiles/:username/follow` with no `Authorization` header answers 401.

### R-048 — Following carries no parameters
**Source:** §Endpoints — Follow user, "No additional parameters required"
**Kind:** explicit
**Statement:** `POST /api/profiles/:username/follow` succeeds with an empty request body.

### R-049 — Unfollowing returns a Profile
**Source:** §Endpoints — Unfollow user, "returns a Profile"
**Kind:** explicit
**Statement:** `DELETE /api/profiles/:username/follow` with a valid token answers with a body containing a `profile` object.

### R-050 — Unfollowing is recorded in the returned profile
**Source:** §Endpoints — Unfollow user, read against §API response format — Profile
**Kind:** assumed
**Statement:** The `profile.following` returned by `DELETE /api/profiles/:username/follow` is false.

### R-051 — Unfollowing requires authentication
**Source:** §Endpoints — Unfollow user, "Authentication required"
**Kind:** explicit
**Statement:** `DELETE /api/profiles/:username/follow` with no `Authorization` header answers 401.

### R-052 — An unknown username cannot be followed
**Source:** §Error handling — 404
**Kind:** explicit
**Statement:** `POST /api/profiles/:username/follow` for a username that belongs to no account answers 404.

### R-053 — A follow is visible when reading the profile again
**Source:** §Endpoints — Follow user and Get Profile, read against §API response format — Profile
**Kind:** assumed
**Statement:** `GET /api/profiles/:username` sent with the follower's token after a follow returns `profile.following` true.

### R-054 — Listing articles returns a list and a count
**Source:** §API response format — Multiple Articles
**Kind:** explicit
**Statement:** `GET /api/articles` answers with a body containing an `articles` array and an `articlesCount` number.

### R-055 — A listed article carries no body field
**Source:** §API response format — Multiple Articles, "the endpoints retrieving a list of articles do no longer return the body of an article"
**Kind:** explicit
**Statement:** Every entry of the `articles` array of `GET /api/articles` has no `body` field.

### R-056 — Articles are listed newest first
**Source:** §Endpoints — List Articles, "ordered by most recent first"
**Kind:** explicit
**Statement:** The `createdAt` values of `GET /api/articles` are in non-increasing order.

### R-057 — Listing articles does not require authentication
**Source:** §Endpoints — List Articles, "Authentication optional"
**Kind:** explicit
**Statement:** `GET /api/articles` with no `Authorization` header answers with an `articles` array.

### R-058 — The tag filter restricts the list
**Source:** §Endpoints — List Articles, "Filter by tag: `?tag=AngularJS`"
**Kind:** explicit
**Statement:** Every entry of `GET /api/articles?tag=X` has `X` in its `tagList`.

### R-059 — The author filter restricts the list
**Source:** §Endpoints — List Articles, "Filter by author: `?author=jake`"
**Kind:** explicit
**Statement:** Every entry of `GET /api/articles?author=X` has `author.username` equal to `X`.

### R-060 — The favorited filter restricts the list
**Source:** §Endpoints — List Articles, "Favorited by user: `?favorited=jake`"
**Kind:** explicit
**Statement:** Every entry of `GET /api/articles?favorited=X` is an article that the account `X` has favorited.

### R-061 — The limit parameter caps the page
**Source:** §Endpoints — List Articles, "Limit number of articles"
**Kind:** explicit
**Statement:** `GET /api/articles?limit=N` returns at most `N` entries in `articles`.

### R-062 — The default page size is twenty
**Source:** §Endpoints — List Articles, "(default is 20)"
**Kind:** explicit
**Statement:** `GET /api/articles` with no `limit` returns at most 20 entries in `articles`.

### R-063 — The offset parameter skips entries
**Source:** §Endpoints — List Articles, "Offset/skip number of articles"
**Kind:** explicit
**Statement:** The first entry of `GET /api/articles?offset=N` is the entry at index `N` of the same query without an offset.

### R-064 — The default offset is zero
**Source:** §Endpoints — List Articles, "(default is 0)"
**Kind:** explicit
**Statement:** `GET /api/articles` and `GET /api/articles?offset=0` return the same first entry.

### R-065 — The count is not smaller than the page
**Source:** §API response format — Multiple Articles, where `articlesCount` is 2 for two articles
**Kind:** assumed
**Statement:** The `articlesCount` of `GET /api/articles` is greater than or equal to the length of `articles` in the same response.

### R-066 — A listed article names its author as a Profile
**Source:** §API response format — Multiple Articles, the `author` object
**Kind:** explicit
**Statement:** The `author` of every entry of `GET /api/articles` has exactly the four Profile fields.

### R-067 — Timestamps are ISO-8601 in UTC
**Source:** §API response format — the `"2016-02-18T03:22:56.637Z"` examples
**Kind:** assumed
**Statement:** The `createdAt` and `updatedAt` of an article parse as ISO-8601 timestamps ending in `Z`.

### R-068 — An anonymous reader has favorited nothing
**Source:** §API response format — Multiple Articles, the `favorited` field
**Kind:** assumed
**Statement:** Every entry of `GET /api/articles` sent with no `Authorization` header has `favorited` false.

### R-069 — The feed requires authentication
**Source:** §Endpoints — Feed Articles, "Authentication required"
**Kind:** explicit
**Statement:** `GET /api/articles/feed` with no `Authorization` header answers 401.

### R-070 — The feed returns a list and a count
**Source:** §Endpoints — Feed Articles, "will return multiple articles"
**Kind:** explicit
**Statement:** `GET /api/articles/feed` with a valid token answers with an `articles` array and an `articlesCount` number.

### R-071 — The feed is restricted to followed authors
**Source:** §Endpoints — Feed Articles, "created by followed users"
**Kind:** explicit
**Statement:** Every entry of `GET /api/articles/feed` has an `author.username` the caller follows.

### R-072 — The feed is ordered newest first
**Source:** §Endpoints — Feed Articles, "ordered by most recent first"
**Kind:** explicit
**Statement:** The `createdAt` values of `GET /api/articles/feed` are in non-increasing order.

### R-073 — The feed is paginated the same way
**Source:** §Endpoints — Feed Articles, "Can also take `limit` and `offset` query parameters"
**Kind:** explicit
**Statement:** `GET /api/articles/feed?limit=N` returns at most `N` entries in `articles`.

### R-074 — A feed article carries no body field
**Source:** §API response format — Multiple Articles, which names `GET /api/articles/feed`
**Kind:** explicit
**Statement:** Every entry of `GET /api/articles/feed` has no `body` field.

### R-075 — A user who follows nobody has an empty feed
**Source:** §Endpoints — Feed Articles, "created by followed users"
**Kind:** assumed
**Statement:** `GET /api/articles/feed` for an account that follows nobody returns an empty `articles` array and `articlesCount` 0.

### R-076 — A followed author's article reaches the feed
**Source:** §Endpoints — Feed Articles, "created by followed users"
**Kind:** assumed
**Statement:** An article created by an account the caller follows appears in that caller's `GET /api/articles/feed`.

### R-077 — An article is addressed by slug
**Source:** §Endpoints — Get Article, "will return single article"
**Kind:** explicit
**Statement:** `GET /api/articles/:slug` for an existing article answers with a body containing an `article` object.

### R-078 — A single article carries its body
**Source:** §API response format — Single Article, which includes `body`
**Kind:** explicit
**Statement:** The `article` returned by `GET /api/articles/:slug` has a `body` field of type string.

### R-079 — Reading an article does not require authentication
**Source:** §Endpoints — Get Article, "No authentication required"
**Kind:** explicit
**Statement:** `GET /api/articles/:slug` with no `Authorization` header answers with an `article` object.

### R-080 — An unknown slug has no article
**Source:** §Error handling — 404
**Kind:** explicit
**Statement:** `GET /api/articles/:slug` for a slug that belongs to no article answers 404.

### R-081 — The Article object has ten fields
**Source:** §API response format — Single Article
**Kind:** explicit
**Statement:** A returned `article` object has exactly `slug`, `title`, `description`, `body`, `tagList`, `createdAt`, `updatedAt`, `favorited`, `favoritesCount` and `author`.

### R-082 — Creating an article returns the Article
**Source:** §Endpoints — Create Article, "will return an Article"
**Kind:** explicit
**Statement:** `POST /api/articles` with a valid token and a complete article answers with a body containing an `article` object.

### R-083 — Creating an article requires a title
**Source:** §Endpoints — Create Article, "Required fields: `title`, `description`, `body`"
**Kind:** explicit
**Statement:** `POST /api/articles` without `article.title` answers 422 with an entry under `errors`.

### R-084 — Creating an article requires a description
**Source:** §Endpoints — Create Article, "Required fields: `title`, `description`, `body`"
**Kind:** explicit
**Statement:** `POST /api/articles` without `article.description` answers 422 with an entry under `errors`.

### R-085 — Creating an article requires a body
**Source:** §Endpoints — Create Article, "Required fields: `title`, `description`, `body`"
**Kind:** explicit
**Statement:** `POST /api/articles` without `article.body` answers 422 with an entry under `errors`.

### R-086 — The tag list is optional
**Source:** §Endpoints — Create Article, "Optional fields: `tagList` as an array of Strings"
**Kind:** explicit
**Statement:** `POST /api/articles` without `article.tagList` answers with an `article` object rather than 422.

### R-087 — The submitted tags come back on the article
**Source:** §Endpoints — Create Article, read against §API response format — Single Article
**Kind:** assumed
**Statement:** The `article.tagList` returned by `POST /api/articles` contains every tag the request sent.

### R-088 — Creating an article requires authentication
**Source:** §Endpoints — Create Article, "Authentication required"
**Kind:** explicit
**Statement:** `POST /api/articles` with no `Authorization` header answers 401.

### R-089 — The returned slug fetches the article
**Source:** §Endpoints — Update Article — "a unique string that you can use to fetch, update, and delete the article"
**Kind:** explicit
**Statement:** `GET /api/articles/:slug` using the slug returned by a creation answers with an article of the same title.

### R-090 — Duplicate titles produce distinct slugs
**Source:** §Endpoints — Update Article — "duplicate titles must still produce distinct slugs"
**Kind:** explicit
**Statement:** Two articles created with the same title are returned with two different `slug` values.

### R-091 — The creator is the author
**Source:** §Endpoints — Create Article, read against §API response format — Single Article
**Kind:** assumed
**Statement:** The `article.author.username` returned by `POST /api/articles` is the username of the authenticated caller.

### R-092 — A new article has no favorites
**Source:** §API response format — Single Article, where `favoritesCount` is 0
**Kind:** assumed
**Statement:** The `article.favoritesCount` returned by `POST /api/articles` is 0.

### R-093 — A new article is not favorited by its creator
**Source:** §API response format — Single Article, where `favorited` is false
**Kind:** assumed
**Statement:** The `article.favorited` returned by `POST /api/articles` is false.

### R-094 — A created article joins the global list
**Source:** §Endpoints — List Articles, "Returns most recent articles globally"
**Kind:** assumed
**Statement:** An article created by `POST /api/articles` appears in `GET /api/articles?limit=20` ahead of older articles.

### R-095 — Updating an article returns the updated Article
**Source:** §Endpoints — Update Article, "returns the updated Article"
**Kind:** explicit
**Statement:** `PUT /api/articles/:slug` by the author answers with an `article` object carrying the submitted values.

### R-096 — Every updatable field is optional
**Source:** §Endpoints — Update Article, "Optional fields: `title`, `description`, `body`", and its one-field example
**Kind:** explicit
**Statement:** `PUT /api/articles/:slug` carrying only `article.title` answers with an `article` object rather than 422.

### R-097 — A new title produces a new slug
**Source:** §Endpoints — Update Article, "The `slug` also gets updated when the `title` is changed"
**Kind:** explicit
**Statement:** The `article.slug` returned by a `PUT /api/articles/:slug` that changed the title differs from the slug in the request path.

### R-098 — The previous slug stops resolving
**Source:** §Endpoints — Update Article, read against §Error handling — 404
**Kind:** assumed
**Statement:** `GET /api/articles/:slug` using the slug an article had before its title changed answers 404.

### R-099 — An article update is partial
**Source:** §Endpoints — Update Article, whose example body carries only `title`
**Kind:** assumed
**Statement:** A `PUT /api/articles/:slug` that omits `description` leaves the article's previous `description` in place.

### R-100 — Updating an article requires authentication
**Source:** §Endpoints — Update Article, "Authentication required"
**Kind:** explicit
**Statement:** `PUT /api/articles/:slug` with no `Authorization` header answers 401.

### R-101 — Only the author may update an article
**Source:** §Error handling — 403, read against §Endpoints — Update Article
**Kind:** assumed
**Statement:** `PUT /api/articles/:slug` sent with the token of an account that did not create the article answers 403.

### R-102 — An unknown slug cannot be updated
**Source:** §Error handling — 404
**Kind:** explicit
**Statement:** `PUT /api/articles/:slug` for a slug that belongs to no article answers 404.

### R-103 — An update moves the update timestamp
**Source:** §API response format — Single Article, where `updatedAt` is later than `createdAt`
**Kind:** assumed
**Statement:** The `article.updatedAt` returned by `PUT /api/articles/:slug` is later than the value it had before the request.

### R-104 — A deleted article is gone
**Source:** §Endpoints — Delete Article, read against §Error handling — 404
**Kind:** explicit
**Statement:** `GET /api/articles/:slug` after a successful `DELETE /api/articles/:slug` answers 404.

### R-105 — Deleting an article requires authentication
**Source:** §Endpoints — Delete Article, "Authentication required"
**Kind:** explicit
**Statement:** `DELETE /api/articles/:slug` with no `Authorization` header answers 401.

### R-106 — Only the author may delete an article
**Source:** §Error handling — 403, read against §Endpoints — Delete Article
**Kind:** assumed
**Statement:** `DELETE /api/articles/:slug` sent with the token of an account that did not create the article answers 403.

### R-107 — An unknown slug cannot be deleted
**Source:** §Error handling — 404
**Kind:** explicit
**Statement:** `DELETE /api/articles/:slug` for a slug that belongs to no article answers 404.

### R-108 — Deletion returns no article
**Source:** §Endpoints — Delete Article, the only endpoint whose entry names no return value
**Kind:** assumed
**Statement:** The body of a successful `DELETE /api/articles/:slug` contains no `article` object.

### R-109 — Adding a comment returns the Comment
**Source:** §Endpoints — Add Comments to an Article, "returns the created Comment"
**Kind:** explicit
**Statement:** `POST /api/articles/:slug/comments` with a valid token and a body answers with a body containing a `comment` object.

### R-110 — The Comment object has five fields
**Source:** §API response format — Single Comment
**Kind:** explicit
**Statement:** A returned `comment` object has exactly `id`, `createdAt`, `updatedAt`, `body` and `author`.

### R-111 — A comment requires a body
**Source:** §Endpoints — Add Comments to an Article, "Required field: `body`"
**Kind:** explicit
**Statement:** `POST /api/articles/:slug/comments` without `comment.body` answers 422 with an entry under `errors`.

### R-112 — Adding a comment requires authentication
**Source:** §Endpoints — Add Comments to an Article, "Authentication required"
**Kind:** explicit
**Statement:** `POST /api/articles/:slug/comments` with no `Authorization` header answers 401.

### R-113 — The commenter is the comment's author
**Source:** §API response format — Single Comment, the `author` object
**Kind:** assumed
**Statement:** The `comment.author.username` returned by `POST /api/articles/:slug/comments` is the username of the authenticated caller.

### R-114 — Listing comments returns an array
**Source:** §API response format — Multiple Comments
**Kind:** explicit
**Statement:** `GET /api/articles/:slug/comments` answers with a body whose only key is `comments`, holding an array.

### R-115 — Listing comments does not require authentication
**Source:** §Endpoints — Get Comments from an Article, "Authentication optional"
**Kind:** explicit
**Statement:** `GET /api/articles/:slug/comments` with no `Authorization` header answers with a `comments` array.

### R-116 — A posted comment appears in the list
**Source:** §Endpoints — Add Comments to an Article and Get Comments from an Article
**Kind:** assumed
**Statement:** The `id` returned by `POST /api/articles/:slug/comments` is present in the `comments` array of the same article.

### R-117 — An unknown slug has no comments
**Source:** §Error handling — 404
**Kind:** explicit
**Statement:** `GET /api/articles/:slug/comments` for a slug that belongs to no article answers 404.

### R-118 — An article without comments has an empty array
**Source:** §API response format — Multiple Comments
**Kind:** assumed
**Statement:** `GET /api/articles/:slug/comments` for a freshly created article returns an empty `comments` array.

### R-119 — A deleted comment leaves the list
**Source:** §Endpoints — Delete Comment
**Kind:** explicit
**Statement:** The `comments` array of an article no longer contains the `id` of a comment removed by `DELETE /api/articles/:slug/comments/:id`.

### R-120 — Deleting a comment requires authentication
**Source:** §Endpoints — Delete Comment, "Authentication required"
**Kind:** explicit
**Statement:** `DELETE /api/articles/:slug/comments/:id` with no `Authorization` header answers 401.

### R-121 — Only the commenter may delete a comment
**Source:** §Error handling — 403, read against §Endpoints — Delete Comment
**Kind:** assumed
**Statement:** `DELETE /api/articles/:slug/comments/:id` sent with the token of an account that did not write the comment answers 403.

### R-122 — An unknown comment cannot be deleted
**Source:** §Error handling — 404
**Kind:** explicit
**Statement:** `DELETE /api/articles/:slug/comments/:id` for an identifier that belongs to no comment answers 404.

### R-123 — A comment identifier is a number
**Source:** §API response format — Single Comment, where `id` is `1` and is not quoted
**Kind:** explicit
**Statement:** The `comment.id` of a returned comment is a JSON number.

### R-124 — Favoriting returns the Article
**Source:** §Endpoints — Favorite Article, "returns the Article"
**Kind:** explicit
**Statement:** `POST /api/articles/:slug/favorite` with a valid token answers with a body containing an `article` object.

### R-125 — A favorited article says so to the caller
**Source:** §Endpoints — Favorite Article, read against §API response format — Single Article
**Kind:** assumed
**Statement:** The `article.favorited` returned by `POST /api/articles/:slug/favorite` is true.

### R-126 — Favoriting raises the count
**Source:** §API response format — Single Article, the `favoritesCount` field
**Kind:** assumed
**Statement:** The `article.favoritesCount` returned by `POST /api/articles/:slug/favorite` is one greater than before the request.

### R-127 — Favoriting requires authentication
**Source:** §Endpoints — Favorite Article, "Authentication required"
**Kind:** explicit
**Statement:** `POST /api/articles/:slug/favorite` with no `Authorization` header answers 401.

### R-128 — Favoriting carries no parameters
**Source:** §Endpoints — Favorite Article, "No additional parameters required"
**Kind:** explicit
**Statement:** `POST /api/articles/:slug/favorite` succeeds with an empty request body.

### R-129 — Unfavoriting returns the Article
**Source:** §Endpoints — Unfavorite Article, "returns the Article"
**Kind:** explicit
**Statement:** `DELETE /api/articles/:slug/favorite` with a valid token answers with a body containing an `article` object.

### R-130 — An unfavorited article says so to the caller
**Source:** §Endpoints — Unfavorite Article, read against §API response format — Single Article
**Kind:** assumed
**Statement:** The `article.favorited` returned by `DELETE /api/articles/:slug/favorite` is false.

### R-131 — Unfavoriting lowers the count
**Source:** §API response format — Single Article, the `favoritesCount` field
**Kind:** assumed
**Statement:** The `article.favoritesCount` returned by `DELETE /api/articles/:slug/favorite` is one smaller than before the request.

### R-132 — Unfavoriting requires authentication
**Source:** §Endpoints — Unfavorite Article, "Authentication required"
**Kind:** explicit
**Statement:** `DELETE /api/articles/:slug/favorite` with no `Authorization` header answers 401.

### R-133 — An unknown slug cannot be favorited
**Source:** §Error handling — 404
**Kind:** explicit
**Statement:** `POST /api/articles/:slug/favorite` for a slug that belongs to no article answers 404.

### R-134 — The favorited filter sees the favorite
**Source:** §Endpoints — List Articles, "Favorited by user", read against §Endpoints — Favorite Article
**Kind:** assumed
**Statement:** An article favorited by an account appears in `GET /api/articles?favorited=<that username>`.

### R-135 — The tag endpoint returns a tag list
**Source:** §API response format — List of Tags
**Kind:** explicit
**Statement:** `GET /api/tags` answers with a body whose only key is `tags`, holding an array.

### R-136 — Reading tags does not require authentication
**Source:** §Endpoints — Get Tags, "No authentication required"
**Kind:** explicit
**Statement:** `GET /api/tags` with no `Authorization` header answers with a `tags` array.

### R-137 — Tags are strings
**Source:** §API response format — List of Tags, `["reactjs", "angularjs"]`
**Kind:** explicit
**Statement:** Every entry of the `tags` array of `GET /api/tags` is a JSON string.

### R-138 — A tag used by an article is a known tag
**Source:** §Endpoints — Get Tags, read against §Endpoints — Create Article
**Kind:** assumed
**Statement:** A tag supplied in the `tagList` of a created article appears in the `tags` array of `GET /api/tags`.

## Assumed rules

Forty-four of the one hundred and thirty-eight rules are `assumed`. Each one is listed here with
the reason the specification is taken to imply it. Disagreeing with any single line below costs
one rule, not the set.

- **R-008** — the header section shows a token in the header and the response format shows a token
  in the User object; nothing else in the specification issues a token, so they must be the same one.
- **R-009** — "Authentication optional" would mean nothing if an anonymous request were refused.
- **R-018** — the User example prints `bio` and `image` as `null`, and registration accepts neither
  field, so a fresh account can hold no other value.
- **R-019** — login identifies an account by email alone; two accounts sharing an email would make
  that lookup ambiguous.
- **R-020** — a profile is addressed as `/profiles/:username`; two accounts sharing a username
  would make that address ambiguous.
- **R-021** — a token that did not authenticate the account it was issued for would serve no purpose.
- **R-026** — a password that is checked nowhere is not a credential; the specification requires it
  on login, which only makes sense if a wrong one is refused.
- **R-027** — the same reasoning as R-026, applied to an account that does not exist.
- **R-028** — "returns a User" without saying which user would leave the response meaningless.
- **R-032** — 401 exists for requests whose authentication "isn't provided"; a token the API never
  issued provides nothing.
- **R-035** — an update that did not survive the request would not be an update.
- **R-036** — the example body carries three of the five accepted fields; if the missing two were
  cleared, the example would silently destroy the username and password.
- **R-038** — `password` is an accepted field of the update, and the only thing a password does in
  this API is authenticate a login.
- **R-039** — R-019 makes an email unique; an update is the other way to set one.
- **R-044** — `following` is a statement about the reader, and an anonymous reader is nobody.
- **R-046** — the endpoint is named Follow and returns a Profile; returning `following: false` from
  it would contradict the endpoint's own name.
- **R-050** — the mirror of R-046 for Unfollow.
- **R-053** — a follow that were invisible to the next read would not have been recorded.
- **R-065** — the example shows `articlesCount` 2 alongside two articles, and pagination exists, so
  the count cannot be smaller than the page it accompanies.
- **R-067** — every timestamp in the specification is printed in this one format; no other is shown.
- **R-068** — `favorited` is a statement about the reader, and an anonymous reader has favorited
  nothing.
- **R-075** — "created by followed users" describes an empty set when there are no followed users.
- **R-076** — the same sentence read in the other direction: if a followed author's article could
  be missing, the feed would not be the feed.
- **R-087** — `tagList` is accepted on creation and present on the returned Article; a tag list that
  came back different would make the field pointless.
- **R-091** — the endpoint requires authentication and returns an Article with an author; the only
  account the request names is the caller.
- **R-092** — an article nobody has seen yet cannot have been favorited by anyone.
- **R-093** — the same, from the creator's point of view.
- **R-094** — List Articles returns articles "globally" and newest first; a created article is both
  global and newest.
- **R-098** — the slug is described as the identifier used to fetch the article, and Update Article
  says it changes with the title; an old identifier that still worked would mean two identifiers.
- **R-099** — the update example sends only `title`; if the omitted fields were cleared, the example
  would erase the article's body.
- **R-101** — 403 is defined for a valid request from a caller without permission, and the only
  permission an article carries is its authorship.
- **R-103** — the Single Article example shows `updatedAt` later than `createdAt`, which is only
  possible if an update moves it.
- **R-106** — the same reasoning as R-101, applied to deletion.
- **R-108** — Delete Article is the only endpoint entry that names no return value, while every
  other entry names one.
- **R-113** — the comment carries an author and the endpoint requires authentication; the only
  account the request names is the caller.
- **R-116** — a created comment that did not appear in the article's comments would not have been
  added to the article.
- **R-118** — the comments response is an array, and an article that has no comments has to be
  representable.
- **R-121** — the same reasoning as R-101, applied to comment authorship.
- **R-125** — the endpoint is named Favorite and returns the Article; `favorited: false` would
  contradict the endpoint's own name.
- **R-126** — `favoritesCount` counts favorites, and this endpoint adds one.
- **R-130** — the mirror of R-125 for Unfavorite.
- **R-131** — the mirror of R-126 for Unfavorite.
- **R-134** — `?favorited=` is documented as "Favorited by user"; the only way to become favorited
  by a user is the Favorite Article endpoint.
- **R-138** — the tag list is global and articles are the only place tags are created.

## Open questions

The specification is formal but incomplete in ways that change what a test may assert. Each entry
below is a decision the specification does not make.

1. **No success status code is stated anywhere.** Not one endpoint says whether it answers 200 or
   201, and creation endpoints are the ones where it matters. Every rule above is written in terms
   of the response body for that reason. R-012, R-082 and R-109 are the rules that would gain a
   status assertion the moment this is settled.
2. **A failed login has no documented status.** 401 ("authentication required but not provided")
   does not fit a request that provides credentials, and 422 ("fails any validations") is a stretch
   for a password that is merely wrong. R-026 and R-027 therefore assert the absence of a token
   rather than a code.
3. **`articlesCount` is not defined.** It could be the number of articles matching the filter or
   the number returned in this page; the example has two of each and settles nothing. R-065 states
   only the weaker claim that survives either reading.
4. **A malformed request body has no documented behaviour.** 422 is specified for "failed
   validations"; whether unparseable JSON, a missing `user` envelope or a `tagList` that is a string
   count as validation failures or as something else is not said. No rule above claims it.
5. **`limit` and `offset` are not bounded.** Nothing says what a negative, zero, non-numeric or
   very large value does. R-061 and R-063 describe only well-formed values.
6. **Whether following yourself, favoriting your own article or commenting twice is allowed** is not
   addressed. These are the cases where implementations differ most, and no rule above takes a side.
7. **The 403 rules rest entirely on the general error-handling sentence.** The endpoint entries for
   Update Article, Delete Article and Delete Comment say "Authentication required" and never say
   "by the author". R-101, R-106 and R-121 are the rules that would be wrong if the API deliberately
   let anyone edit anything, which is why they are marked `assumed` rather than `explicit`.
8. **The slug's format is deliberately unspecified** — "no particular format is enforced by the test
   suite" — so no rule asserts one. R-089 and R-090 assert only that a slug fetches its article and
   that duplicate titles do not collide.
9. **The specification says its own prose is not authoritative:** "Where the prose and the tests
   disagree, the tests win." The rules above are extracted from the prose alone, because the Hurl
   suite and the OpenAPI document are not part of `spec/conduit-api.md`. Every rule here is
   therefore one revision away from being contradicted by a document this agent cannot read.
