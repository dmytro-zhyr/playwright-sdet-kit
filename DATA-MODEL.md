# Data model: schemas, types, factories, classes, fixtures

What each kind of thing is for, and the test that decides where a new one belongs.

`CONVENTIONS.md` says how to write a test. This says what a test is written _out of_. It exists
because one type — `NewUser`, `{ username, email, password }` — turned out to be neither
credentials (a login needs no username) nor a user (`GET /user` returns no password), and nobody
could say what it was. The answer was that it had been named for the first job it did rather than
for what it is, and that mistake does not stay small: it is the same one that produced a directory
called `support/`.

⚠️ **This is written with a second system already in view.** Salesforce API tests are planned, the
org has been probed, and the findings are in `spec/FINDINGS.md` under "Salesforce reconnaissance".
Every rule below was checked against both systems, because a rule derived from one system is a
description of that system.

---

## 1. Five kinds, one job each

| Kind         | Holds                             | Decision test                                                                  |
| ------------ | --------------------------------- | ------------------------------------------------------------------------------ |
| **Schema**   | a shape the _system_ speaks       | would it change if the API changed? → schema                                    |
| **Type**     | a shape the _code_ passes around  | does it cross the wire? → derive it from the schema                             |
| **Factory**  | how to build a request body       | could this value exist before the request was sent? → no, then it is not its    |
| **Class**    | behaviour                         | does it _do_ something, or only hold? → holds, so it is a type                   |
| **Fixture**  | wiring and lifetime               | does it need setup or teardown per test? → fixture                              |

### Schemas are the single source of shape

`schemas/` describes what the system says, and it already validates every response. The types must
come from the same place, or there are two sources of truth for one shape and the second one drifts
silently:

```ts
export const UserSchema = z.strictObject({ … });
export type User = z.infer<typeof UserSchema>;
```

⛔ **Never hand-write a type that mirrors a schema.** A hand-written twin cannot be wrong at compile
time and cannot be caught by a test — it just stops matching.

📌 Request bodies get schemas too, not only responses. `RegistrationRequest` is a shape the system
speaks; that it travels outbound does not make it different in kind.

### Factories build requests, never state

A factory runs **before** the request. It cannot know an id, a token, a role the server assigns or a
count the server maintains, because none of them exist yet. That is not a convention — it is the
only information available at the moment it is called.

```ts
export const userFactory = Factory.define<RegistrationRequest>('user')…
```

⛔ **A standing account — an admin, a moderator, a seeded fixture user — is not factory output.**
Overriding every field of a generated object uses the factory for nothing but its shape, and a shape
is a type. A standing account is a fact about a deployment, and this repository already holds those
one way: a name in `.env`, resolved in one place, erroring with the list of valid names rather than
falling back. See `deployments/registry.ts`.

### Classes only where there is behaviour

There is exactly one class here today — `ConduitClient` — and it earns it: it sends requests,
attaches a token, and classifies an unreachable target. A record of fields is a type.

📌 The second class this design expects is an **actor**, and it earns it for a concrete reason given
in §3: authenticating is something an actor _does_, and on Salesforce it is something it may have to
do **twice**.

---

## 2. Three layers of "a user", and why the arrows only go one way

```
RegistrationRequest   →   User            →   Actor
what I send               what the            who is acting:
                          system says         identity + session + the ability to act
```

The separation is not taste. Each arrow is a fact about when information exists:

- **The request cannot carry an id** — the server has not assigned one.
- **The resource cannot carry a password** — the server never returns it.
- **The actor knows both**, because it exists only after a round trip.

Every field that feels awkward to place is answered by asking which of those three moments it
becomes true in. The id you want to remember is an actor's; the password is not.

The same three layers hold in Salesforce, with different contents:

|          | Conduit                                            | Salesforce                                              |
| -------- | -------------------------------------------------- | ------------------------------------------------------- |
| Request  | `RegistrationRequest` — `{ username, email, password }` | `AccountCreateRequest` — `Name` required, 69 others optional |
| Resource | `User` — `z.infer<typeof UserSchema>`               | `Account` — 18-character `Id`, system fields             |
| Actor    | a product user, or a standing admin                 | an org connection                                        |

⛔ **Do not build a `User` type shared across systems.** A Conduit user and a Salesforce User object
share a word and nothing else. A common supertype would have to be the intersection of two unrelated
things, which is empty, or the union of everything, which asserts nothing.

### Naming rule

**A shape that crosses the wire is named for its place on the wire** — `RegistrationRequest`,
`LoginRequest`, `UserResponse`. Not for the role it plays in one test, which is what produced
`NewUser`.

**A shape that never crosses the wire is named for what the test does with it** — an expected-state
model, a fixture bundle.

---

## 3. `Credentials` is per system, and Salesforce is what proves it

On Conduit, credentials are `{ email, password }`, and they happen to be exactly the body of
`POST /users/login`. That coincidence is Conduit's, not a rule.

|             | Conduit                        | Salesforce                                                    |
| ----------- | ------------------------------ | ------------------------------------------------------------- |
| Credentials | `{ email, password }`          | `{ clientId, clientSecret, loginUrl }`                        |
| Exchange    | `POST /users/login` → token    | OAuth 2.0 client credentials → access token                    |
| Recovery    | none needed                    | **`authorize()` again — this flow carries no refresh token**   |

🔑 So `Credentials<S>` means **what it takes to become an actor in system S**, and in general it is
not a request body at all. The Salesforce finding is the evidence: its recovery path is a _call_,
not a field, which is why an actor is a class and not a record.

⛔ **A token is not a credential.** Credentials are what you present in order to obtain one; a token
is proof that you already did. Holding both in one type makes the type unable to answer "have I
authenticated yet".

---

## 4. What an actor is

An actor is who is acting, and a test with two of them is the case that breaks a shared client.

```ts
type Actor<S extends System> = {
  identity: Identity<S>; // ids, role, credentials, foreign ids such as sfUserId
  api: Client<S>; // a client carrying this actor's token
  ui?: Surface<S>; // a browser context carrying this actor's session
};
```

Two things this buys, both lost without it:

- **Two actors are two clients.** Today a token is attached with `withToken`, which is fine while
  one person acts. A test where an admin reads what a regular user wrote otherwise becomes a game of
  whose token is on the client right now.
- **Where the account came from is part of the call**, not a guess.
  `actors.product.register('regular')` and `actors.product.existing('admin')` are different
  sentences because they are different things: one creates, one selects.

📌 **`sfUserId` is an ordinary field on the identity.** It is the Salesforce id of the record mapped
to a product user — an opaque foreign key, stored because you need it in order to _address_ the
other system. It is not a mapping layer and does not need one.

---

## 5. Expected state: what is written down, and what is read

A test that drives the UI and then verifies through the API has to remember what it changed. That is
legitimate, and it is not the same as caching an observation: one is an expectation you computed,
the other is an answer you were given.

🔑 **Write down only what you need in order to choose. Read everything else.**

- The role of a standing admin is written down — without it you cannot choose whom to log in as.
- A published-article count is read — it chooses nothing, and a stored copy is wrong the moment the
  next step publishes.
- The role of an account you just created is read — the system assigned it, so the system is where
  it is true.

### Two ways an expected-state model goes bad

⛔ **Advancing the model from the response instead of from the action.** Perform a step, re-read the
API, update the model from what came back — and the final assertion compares the system to itself.
It is green forever. This is exactly the defect class of D-12: a check that is not looking. **The
model moves only by the action you performed.**

⛔ **Whole-object equality against a live resource.** `lastLogin` moves on its own, a follower count
can move for reasons outside the test, and a shared deployment has other workers in it. Compare the
fields you touched, not objects.

➡️ **Absolute values for what only you can change** (role, subscription type). **Deltas for what
others can** (counters, follower lists).

📌 And in the common case there is no model at all — there is a `before`, which is read rather than
maintained and so cannot drift:

```ts
const before = await readUser(api);
await regular.ui.editorPage.publish(article);
const after = await readUser(api);

expect(after.publishedArticles, 'publishing through the UI must reach the API').toBe(
  before.publishedArticles + 1
);
```

A model earns its place above a threshold: many operations, where `before.x + 1` becomes a wall.

---

## 6. What the two systems actually differ on

From `spec/FINDINGS.md`, measured rather than assumed. These are the axes that must stay per-system.
Parameterising anything else is inventing variation that does not exist.

| Axis           | Conduit                                        | Salesforce                                          | Consequence                                                  |
| -------------- | ---------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| Authentication | credentials → token                            | OAuth client credentials, **no refresh token**       | recovery is a call, so an actor is a class                    |
| Teardown       | **impossible** — no delete endpoint            | delete works, verified gone                          | cleanup is a property of the system, not of the framework     |
| Addressing     | username, slug — readable, content-derived     | 18-character opaque `Id`                             | never assume an id is readable, or known before the create    |
| Errors         | everything collapses to `{"errors":{"body":[…]}}` | typed `errorCode` — `NOT_FOUND`, `REQUIRED_FIELD_MISSING` | ⛔ do not normalise a richer error into a poorer common shape |
| Timestamps     | `…Z`                                           | `…+0000`                                             | a shared datetime assertion would be wrong on one of them     |

⛔ **The teardown row is the one most likely to be got wrong.** `qa_` prefixes and "accounts stay
forever" are Conduit facts, recorded as limitations. Baking "we never clean up" into a fixture would
carry a defect of one target into a system that does not have it.

---

## 7. Now, and at the second system

⚠️ **Two items below were corrected the next day, by pricing them against the code.** `Actor` is
held until a test actually has two actors, and request schemas wait for a request shape that earns
one — Conduit's are four flat fields. Both corrections, with their reasoning, are in
[PLAN.md](PLAN.md) under Stage C. They are recorded there rather than edited away here, because a
rule that was too eager is worth seeing next to what disproved it.

🔴 **Designing three systems before the second one exists produces the wrong three.** An abstraction
drawn from one example describes that example. So the split is by cost, not by appetite.

**Now — the boundaries.** They are expensive to change later, because every import sits on them:

1. Split the Conduit types by wire position: `RegistrationRequest`, `Credentials` (`LoginRequest`),
   `User`.
2. Derive every wire type from its schema with `z.infer`, and delete hand-written twins.
3. The factory returns a request body and nothing else.
4. Introduce `Actor` for Conduit, with one system and one surface. Its value is already real: two
   actors are two clients.

**At the second system — the multiplication.** Additive, and cheap once the boundaries hold:

5. `System` as a parameter, with a per-system `Credentials` and client.
6. Teardown as a declared capability of a system rather than an assumption.
7. Error assertions per system by design rather than by omission.

🔑 The trigger for the second half is **the second system actually landing**, not the plan for it.
What the Salesforce reconnaissance is for right now is different, and already delivered: it told us
which axes vary, and that is what §6 is.
