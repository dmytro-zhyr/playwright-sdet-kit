# Implementation plan — the page objects

Two items, both raised on 4 September 2026 by reading this layer against the examples in
Playwright's own documentation (`docs/pom`, `docs/test-fixtures`). Neither is a bug: every test
passes and every locator resolves. Both are about what a name tells the person at the call site.

⛔ **Nothing here is started.** This file is the record so that the work can be done in one pass
rather than rediscovered.

---

## P1 · A locator's name must say what it is

### The rule, and where it comes from

Playwright's own examples name the element kind in the identifier: `getStartedLink`,
`gettingStartedHeader`, `inputBox`, `todoItems`. The point is not decoration. A name that carries
its kind also carries its **affordance** — `getStartedLink` can be clicked, `gettingStartedHeader`
can only be read, `inputBox` can be filled — so the call site knows what is permitted without
opening the page object.

This layer names locators as bare nouns: `home`, `email`, `title`, `body`, `edit`, `delete`. The
kind is knowable only by reading the getter.

### 🔴 The evidence that this is not a preference

**The same name means opposite things in two files.**

| Name | `editorPage` | `articlePage` |
|---|---|---|
| `title` | an input you `fill` | an `<h1>` you read |
| `body` | a textarea you `fill` | `.article-content` you read |
| `tags` | an input you `fill` | the rendered chips you count |

A test holding one of these has no way to tell from the name which it has. The same collision runs
across species: `Navigation.signIn` is a link, `LoginPage.signIn()` is a method returning an HTTP
status.

**And a pair that hides a real difference.** `articlePage.edit` is a `<a>` and `articlePage.delete`
is a `<button>` — two different elements, sitting on adjacent lines, named identically in form.

### The vocabulary

| Suffix | For | Affordance |
|---|---|---|
| `…Link` | `getByRole('link')` | click, navigates |
| `…Button` | `getByRole('button')` | click, acts in place |
| `…Field` | any text input or textarea | `fill`, `clear` |
| `…Heading` | `getByRole('heading')` | read only |
| `…Text` | a rendered block | read only |
| `…List`, `…Cards`, `…Messages` | a collection | count, index, filter |

📌 **`heading` and `errors` are not exceptions to be fixed by adding a suffix** — `heading` already
*is* the kind, and `errors` becomes `errorMessages` because the plural noun alone does not say
whether it holds strings or elements.

### The renames

**`po/components/navigation.ts`** — every member is a link, and none of them says so.

| Now | Becomes |
|---|---|
| `home` | `homeLink` |
| `signIn` | `signInLink` |
| `signUp` | `signUpLink` |
| `newArticle` | `newArticleLink` |
| `settings` | `settingsLink` |
| `profile(username)` | `profileLink(username)` |
| `goHome()` | unchanged — a verb already |

**`po/pages/homePage.ts`**

| Now | Becomes |
|---|---|
| `feedToggle` | `feedTabs` |
| `globalFeed` | `globalFeedTab` 🟡 |
| `yourFeed` | `yourFeedTab` 🟡 |
| `cards` | `articleCards` |
| `card(slug)` | `articleCard(slug)` |
| `open()` | unchanged |

🟡 **Open question, to settle before doing this one.** The file's own doc comment records that
these two carry **no interactive role at all** — they are plain list items, which is why
`getByRole('tab')` and `getByRole('link')` both find nothing. Naming them `…Tab` then describes the
affordance a human sees rather than the role the markup declares, and every other suffix in the
table above is the opposite: it declares the role. Either accept the one intent-named pair and say
so in the comment, or name them `globalFeedItem` / `yourFeedItem` and let the name stay literally
true. ⚠️ The second is uglier and more honest, which is usually how this repository decides.

**`po/pages/loginPage.ts`**

| Now | Becomes |
|---|---|
| `heading` | unchanged |
| `email` | `emailField` |
| `password` | `passwordField` |
| `submit` | `signInButton` |
| `errors` | `errorMessages` |
| `fill(email, password)` | `fillCredentials(email, password)` |
| `open()`, `signIn()` | unchanged |

**`po/pages/registerPage.ts`**

| Now | Becomes |
|---|---|
| `username`, `email`, `password` | `usernameField`, `emailField`, `passwordField` |
| `submit` | `signUpButton` |
| `errors` | `errorMessages` |
| `fill(user)` | `fillRegistration(user)` |
| `open()`, `signUp()` | unchanged |

**`po/pages/editorPage.ts`**

| Now | Becomes |
|---|---|
| `title`, `description`, `body`, `tags` | `titleField`, `descriptionField`, `bodyField`, `tagsField` |
| `publish` | `publishButton` |
| `fill(article)` | `fillArticle(article)` |
| `publishArticle(article)` | `publish(article)` |
| `open()` | unchanged |

🔑 **This file is where the rule pays.** `publish` and `publishArticle` differ today by a noun that
says nothing — the actual difference is that one is a thing and the other is an act. After the
rename the pair reads as `publishButton` and `publish(article)`, and the distinction is in the
grammar instead of in a suffix nobody can interpret. Note also that the object is dropped: the page
is already the editor, so `publishArticle` said "article" twice.

**`po/pages/articlePage.ts`**

| Now | Becomes |
|---|---|
| `title` | `titleHeading` |
| `body` | `bodyText` |
| `tags` | `tagList` |
| `edit` | `editLink` |
| `delete` | `deleteButton` |
| `commentBody` | `commentField` |
| `postComment` | `postCommentButton` |
| `author(username)` | `authorLink(username)` |
| `open(slug)` | unchanged |

### The methods

Methods stay verbs, and the rule is only that the verb not repeat what the receiver already says.
`editorPage.publishArticle(…)` names the article twice; `homePage.open()` names nothing twice and
is right as it is.

⚠️ **`fill` is the one verb worth splitting.** `login.fill(email, password)` and
`login.emailField.fill(email)` are the same word at two levels — one drives a form, the other
drives one input — and three page objects each define a different `fill` signature. `fillCredentials`,
`fillRegistration`, `fillArticle` keep the verb and say which form.

### ⛔ How not to do it

**Not `sed`.** These identifiers are also field names in the API payloads: across `tests/`, `body`
occurs 87 times, `username` 47, `email` 40 — almost all of them on request and response objects in
the contract suite, which must not be touched. The rename is per-symbol, driven by the compiler or
the IDE's rename refactoring, and `npx tsc --noEmit` is what proves it landed.

📌 **Blast radius is small and entirely inside `tests/ui/`** — three spec files. Nothing else
imports `@po/*` except `fixtures.ts` and the page objects themselves, because the tests receive
page objects through fixtures rather than constructing them.

---

## P2 · `Navigation.root` is the last locator held in a field

`private readonly root: Locator` is declared at the top of `Navigation` and assigned in the
constructor. It is the **only** locator field across all six files; everywhere else a locator is a
getter, or a method when it takes an argument.

There is no reason for the exception. `private get root(): Locator { … }` behaves identically —
`Locator` is a lazy handle, so rebuilding the `getByRole('navigation').filter(…)` chain on each
access costs nothing and touches the browser not at all. The field is a leftover of the style in
`docs/pom`, which assigns locators in the constructor, and it survived the refactoring that made
everything else a getter.

📌 **Why the getter is the house style at all**, so the choice is recorded once rather than argued
again: the constructor style writes each name twice — once in the field declaration, once in the
assignment — and separates a locator from the comment explaining it, which matters here because
almost every locator in this layer carries an observation about the running application. And two of
them could not be fields under any style: `HomePage.globalFeed` is derived from `feedToggle`, which
in field form is a dependency on the order of assignments in the constructor.

⚠️ **This is a maintenance argument, not a correctness one.** A `Locator` re-resolves on every use,
so the documented style is equally correct. The exception is worth removing because one rule with
no exceptions is readable, not because the field is wrong.

---

## Order

```
P2 ──→ one edit, no call sites change
P1 ──→ six files renamed, three spec files follow, tsc proves it
```

P2 first because it is independent and finishes in a minute. P1 needs the 🟡 above answered before
`homePage` can be touched; the other five files do not depend on that answer.
