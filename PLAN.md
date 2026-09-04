# Implementation plan — data model

Sequenced work following from [DATA-MODEL.md](DATA-MODEL.md) and the decisions recorded in
[CONVENTIONS.md](CONVENTIONS.md). `DATA-MODEL.md` says why; this says what, in what order, and what
is deliberately not being done yet.

Every item carries its **blast radius counted from the code**, not estimated. Nothing here is
started.

---

## Stage A — the boundaries. Cheap, no design risk

These fix confusion that exists today. None of them needs a new abstraction, and each is
independently revertible.

### ✅ A1 · Undo `tests/support/` — done 03.09.2026

`tests/` holds specifications only, and a directory is named for its subject, never for its role.

- `tests/support/send.ts` → **`api/send.ts`** (it takes a `ConduitClient`, returns an `ApiResponse`)
- `tests/support/thrown.ts` → **`assertions/thrown.ts`**, and `schemas/toMatchSchema.ts` moves there
  with it — `schemas/` currently holds both the shapes data must have and one way of claiming things
  about them
- drop the `@support/*` alias, add `@assertions/*`

**Radius:** 4 importers of `@support/*`, 2 of `@schemas/toMatchSchema`, `tsconfig.json`, one row in
the CONVENTIONS alias table.

⛔ Not a fifth method on `ConduitClient`: dispatching a verb read from a table is a test idiom, not
a capability of a client.

### ✅ A2 · Delete `UiAccount` — done 03.09.2026

It is `RegisteredAccount` under a second name — identical fields, assigned straight from
`registerUser()`. Its comment claims the account belongs to the UI project's backend, which the type
does not carry and structural typing will not enforce.

**Radius:** `po/poFixtures.ts` only. The claim about which backend stays in the fixture's doc block,
next to `UI_BACKEND`, where it actually holds.

### ✅ A3 · `RegisteredUser` becomes an intersection — done 03.09.2026

`type RegisteredUser = RegisteredAccount & { api: ConduitClient }`, instead of restating its
parent's fields by hand where a later addition would silently not arrive.

**Radius:** `api/apiFixtures.ts` only.

### ✅ A4 · Rename the request bodies by their place on the wire — done 03.09.2026

| Now          | Becomes                 | Is really                            |
| ------------ | ----------------------- | ------------------------------------ |
| `NewUser`    | `UserCreateInput`       | what `POST /users` carries under `user`  |
| —            | `Credentials`           | what `POST /users/login` carries under `user` — a `Pick` of the above |
| `NewArticle` | `ArticleCreateInput`    | what `POST /articles` carries under `article` |
| `NewComment` | `CommentCreateInput`    | what `POST /articles/:slug/comments` carries under `comment` |

⚠️ **Names revised 03.09 before applying.** The draft said `RegistrationRequest` and
`CreateArticleRequest`; neither is a request, and neither is even the body — the body is
`{ user: … }` and the wrapping is added at the call site. `…CreateInput` names what it is, and
`Create` is explicit because the specification also has `PUT /user` and `PUT /articles/:slug`,
whose inputs are different shapes.

**Radius:** `NewUser` 6 files, `NewArticle` 2, `NewComment` 1.

📌 `NewArticle` and `NewComment` are not in the recorded decision — that named only `NewUser`. They
are here because they are the same shape of mistake, and leaving two of three renamed is worse than
leaving all three alone. Cut them if the scope is unwelcome; the rule does not depend on them.

⛔ Not `User` for the resource type at this stage — see B1, it arrives from the schema.

---

## Stage B — the payoff, and the larger half

### ✅ B1 · Response types derived from the schemas — done 04.09.2026

`Profile`, `User`, `ArticlePreview`, `Article`, `Comment`, `Errors` and the six response wrappers,
all via `z.infer`, in `schemas/conduit.schema.ts`.

⚠️ **Not shipped alone, and that was the correction.** The plan said "radius: `schemas/` only,
until B2 uses them" — which is a description of dead code. Exported types with no consumer prove
nothing, the same objection this repository makes to everything else, so B1 landed together with
the first slice of B2 below and the types had a caller the moment they existed.

### 🟡 B2 · Retire the hand-narrowed casts — 14 of 46 done 04.09.2026

There are **46 `response.body as { … }` casts across 14 files**. They are the reason `body` is
`unknown` and the reason every test re-describes a shape the schema already knows.

⚠️ **A cast is not a check.** Replacing `as { user?: { token?: string } }` with `as User` swaps one
unverified assertion for another. The improvement is a helper that **validates and narrows in one
call**, so the shape a test relies on is the shape that was checked:

```ts
const { user } = parse(UserResponseSchema, response.body);
```

⛔ **Not mechanical, and not all 46.** Several casts are deliberately partial —
`as { article?: { slug?: string } }` exists so the test can report *its own* message when the field
is missing, and a strict parse would throw before that message could be produced. Those stay.

➡️ So B2 is done per site, alongside whatever else touches the file, and the helper has to keep the
failure message quality `toMatchSchema` already has. It is not a task with an end date; it is a
direction with a first step.

---

#### ✅ The first step, 04.09.2026

`assertions/parseBody.ts`:

```ts
export function parseBody<T>(body: unknown, schema: ZodType<T>): T {
  expect(body).toMatchSchema(schema);
  return schema.parse(body);
}
```

🔑 **It delegates rather than catching a `ZodError` of its own.** `toMatchSchema` already produces
`user.bio: expected string, received null` and lands in the report as an assertion; a second way of
failing for the same class of problem is a second vocabulary for the reader. `schema.parse` is
reached only when it cannot fail. Four unit tests in `tests/unit/parseBody.spec.ts` pin the return
value, the failure, the message and that strictness survives the helper.

**14 sites converted**, chosen by a rule rather than by taste: every cast that already sat directly
under a `toMatchSchema` on the same body. Those add no check — they only remove a duplication, so
the first slice could not be a behaviour change.

| File | Sites |
|---|---|
| `tests/contract/registration.spec.ts` | 4 |
| `tests/contract/articles.spec.ts` | 3 |
| `tests/contract/authentication.spec.ts` | 2 |
| `tests/contract/login.spec.ts` | 2 |
| `tests/contract/current-user.spec.ts` | 1 |
| `tests/contract/tags.spec.ts` | 1 |

⚠️ One candidate was rejected on inspection: `tests/defects/schemas.spec.ts:115` looked paired to a
grep, but the `toMatchSchema` above it asserts a **different** response, and the cast under it is
the deliberate floor check that the file's own comment explains.

**32 casts remain.** They are not one job: some are partial on purpose, some sit in `tests/defects/`
where a strict parse would hide the defect being reproduced, and one is in `api/registerUser.ts`,
which throws its own error because it is setup rather than a test. Each is decided where it lives.

---

## Stage C — held on purpose

### C1 · `Actor` is not built yet

`DATA-MODEL.md` §7 lists it under "now". Grounding the plan in the code says otherwise, and the
document is wrong on this point rather than the plan:

**No test in this repository has two actors.** The argument for `Actor` is that two actors are two
clients, and today `withToken` handles the one-actor case correctly. Building it now would be
designing an abstraction from zero examples — the exact thing §7's own opening paragraph refuses.

➡️ **Trigger:** the first test that needs an admin and a regular user at the same time, or
Salesforce landing, whichever comes first. A1–A3 shape the pieces it will be built from either way,
so nothing is lost by waiting.

### C2 · Request schemas are not being added

`DATA-MODEL.md` §1 says request bodies get schemas too. For Conduit that buys nothing today: nothing
validates an outbound body, so the schema would exist only to derive a type that a plain type
already gives — and the API's own 422 already catches a factory that drifts.

➡️ **Where the rule does pay is a non-trivial request shape**, and Salesforce has one: `Account`,
70 fields, exactly one required on create. Which fields exist and which are required is real
information worth holding in a schema. So the rule is right and its trigger is the second system,
not this one.

📌 Both corrections are recorded here rather than quietly edited into `DATA-MODEL.md`, and both were
produced by pricing the document against the code within a day of writing it.

---

## Stage D — when Salesforce lands

Additive, and cheap only if Stage A holds. From `DATA-MODEL.md` §6, which is measured rather than
assumed:

1. **`System` as a parameter** — a per-system `Credentials` and client. Salesforce credentials are
   `{ clientId, clientSecret, loginUrl }` and are not a request body at all.
2. **Authentication as behaviour** — the client-credentials flow carries no refresh token, so
   recovery is `authorize()` again. This is what makes an actor a class.
3. **Teardown as a declared capability** — Salesforce deletes and it is verified gone; Conduit
   cannot. ⛔ Neither answer may be baked into a shared fixture.
4. **Errors stay per-system** — `errorCode` is richer than `{"errors":{"body":[…]}}`, and a common
   error type would flatten it to the poorer of the two.
5. **Request schemas** for the shapes that earn one (C2).

---

## Order and dependencies

```
A1 ──┐
A2 ──┼──→ (independent of each other, any order)
A3 ──┤
A4 ──┘
        B1 ──→ B2 (open-ended, per site)

C1, C2 wait for a trigger, not for a date
D follows A, and only when Salesforce actually lands
```

Stage A is the whole of what is worth doing before anything else changes. B1 is one commit. B2 is a
direction. C is a decision to wait, written down so that waiting is visible rather than forgotten.
