# Implementation plan — the page objects

Raised on 4 September 2026 by reading this layer against the examples in Playwright's own
documentation (`docs/pom`, `docs/test-fixtures`), and finished the same day. Nothing here was a bug:
every test passed and every locator resolved. It was about what a name tells the person at the call
site — and, once the browser was opened to settle one naming question, about five things the feed
toggle does that no test had asked it.

✅ **All of it is applied.** The rules now live in CONVENTIONS.md, "A locator's name says what it
is"; the measurements live in spec/FINDINGS.md. This file records why, and what was decided against.

---

## ✅ P1 · A locator's name says what it is — done 04.09.2026

### The rule, and where it comes from

Playwright's own examples name the element kind in the identifier: `getStartedLink`,
`gettingStartedHeader`, `inputBox`, `todoItems`. The point is not decoration. A name that carries
its kind also carries its **affordance** — `getStartedLink` can be clicked, `gettingStartedHeader`
can only be read, `inputBox` can be filled — so the call site knows what is permitted without
opening the page object.

This layer named locators as bare nouns: `home`, `email`, `title`, `body`, `edit`, `delete`.

### 🔴 The evidence that this was not a preference

**The same name meant opposite things in two files.**

| Name | `editorPage` | `articlePage` |
|---|---|---|
| `title` | an input you `fill` | an `<h1>` you read |
| `body` | a textarea you `fill` | `.article-content` you read |
| `tags` | an input you `fill` | the rendered chips you count |

The same collision ran across species: `Navigation.signIn` was a link, `LoginPage.signIn()` a method
returning an HTTP status. And a pair that hid a real difference — `articlePage.edit` is an `<a>`,
`articlePage.delete` a `<button>`, adjacent lines, identical in form.

### What was renamed

| File | Before → after |
|---|---|
| `navigation.ts` | `home`, `signIn`, `signUp`, `newArticle`, `settings`, `profile()` → `homeLink`, `signInLink`, `signUpLink`, `newArticleLink`, `settingsLink`, `profileLink()` |
| `homePage.ts` | `feedToggle` → `feedTabs`; `globalFeed`/`yourFeed` → `feedTab(name)`; `cards`/`card()` → `articleCards`/`articleCard()` |
| `loginPage.ts` | `email`, `password`, `submit`, `errors`, `fill()` → `emailField`, `passwordField`, `signInButton`, `errorMessages`, `fillCredentials()` |
| `registerPage.ts` | `username`, `email`, `password`, `submit`, `errors`, `fill()` → `usernameField`, `emailField`, `passwordField`, `signUpButton`, `errorMessages`, `fillRegistration()` |
| `editorPage.ts` | `title`, `description`, `body`, `tags`, `publish`, `fill()`, `publishArticle()` → `titleField`, `descriptionField`, `bodyField`, `tagsField`, `publishButton`, `fillArticle()`, `publish()` |
| `articlePage.ts` | `title`, `body`, `tags`, `edit`, `delete`, `commentBody`, `postComment`, `author()` → `titleHeading`, `bodyText`, `tagChips`, `editLink`, `deleteButton`, `commentField`, `postCommentButton`, `authorLink()` |

🔑 **Where the rule paid best.** `publish` and `publishArticle` differed by a noun that said
nothing; the actual difference was a thing against an act. They are now `publishButton` and
`publish(article)` — the distinction is in the grammar. The object was dropped because the page is
already the editor, so `publishArticle` said "article" twice.

📌 **One rename departed from the plan.** `articlePage.tags` was to become `tagList`, matching the
`.tag-list` container. It became `tagChips`: `tagList` is the field name **on the wire**, and one
name for the request body and for the rendered result would hide exactly the difference between
what was typed and what the application stores — which is what the test on that line records.

### ⛔ How it was not done

Not `sed`. These identifiers are also field names in the API payloads: across `tests/`, `body`
occurs 87 times, `username` 47, `email` 40, almost all on request and response objects in the
contract suite. Every rename was per-symbol, and `tsc --noEmit` is what proved it landed.

---

## ✅ P2 · `Navigation.root` is a getter — done 04.09.2026

It was the only locator held in a field across all six files; everywhere else a locator is a getter,
or a method when it takes an argument. `private get root()` behaves identically — a `Locator` is a
lazy handle, so rebuilding the `getByRole('navigation').filter(…)` chain costs nothing and touches
the browser not at all. The field was a leftover of the style in `docs/pom`.

📌 **Why the getter is the house style**, recorded once rather than argued again: the constructor
style writes each name twice and separates a locator from the comment explaining it, which matters
because almost every locator here carries an observation about the running application. And
`activeFeedTab` could not be a field under any style — it is derived from `feedTab`, which in field
form is a dependency on the order of assignments.

⚠️ It is a maintenance argument, not a correctness one: a `Locator` re-resolves on every use, so the
documented style is equally correct. The exception was worth removing because one rule with no
exceptions is readable.

---

## ✅ P3 · The feed toggle — done 04.09.2026

### The naming question that was opened, and how it was settled

The plan asked whether tabs with no `tab` role may be called `…Tab`. The page was opened in a
browser to decide, and the browser answered a larger question: they are not "plain list items" as
the code comment had claimed for five days, but `<a>` elements **with no `href`** — which is why
they have no role, no focus, and no `aria-selected`.

➡️ `…Tab` stands. Every honest alternative is equally role-free and says less; the name states the
kind a reader sees and the comment states that the markup does not back it. The exception is written
where the locator is, and there is one of it.

### What was added

| Member | Why it exists |
|---|---|
| `feedTab(name)` | addresses a tab by its label, `li:not([hidden])` because the hidden tag tab is `active` while hidden and breaks strict mode |
| `activeFeedTab(name)` | `feedTab(name).and(page.locator('.active'))` — defined *through* `feedTab`, so what a tab is stays written once |
| `openFeedTab(name)` | clicks, waits for the tab's own `/api/articles` response, then for the class |
| `emptyFeedNotice` | what the feed says instead of cards |

📌 **`activeFeedTab` takes the name rather than returning "whichever is active".** A no-argument
version would only be useful for reading the selection back, and reading it back means comparing a
string that cannot be retried — the failure mode this repository already has a finding about.
`.and()` is an intersection, not a search inside, so the breadth of `.active` on the right does not
matter.

📌 **`tests/ui/feed.spec.ts` was written in the same pass, and that was not optional.** A method
with no caller is dead code in a repository whose argument is that unexercised code proves nothing —
the same reason the four missing click-navigation methods were **not** added.

### 🔴 What the test found on its first run

It failed, and the failure was worth more than the test. Two independent faults, neither in the
application:

1. **`.article-preview` is also the empty state.** `<div class="article-preview">No articles are
   here... yet.</div>`, so the bare class counts one article where there are none.
2. **`goto()` returned too early.** It waited for the toggle, which renders before the articles
   request comes back — so the click switched feeds while the initial response was in flight, and
   that response then painted ten global articles over the personal feed just selected.

The API was asked directly and answered `articlesCount = 0` for the same account, which is what
separated "the application shows the wrong feed" from "the test looked while the page was changing".
Both are in spec/FINDINGS.md.

---

## ✅ P4 · `open()` is `goto()` — done 04.09.2026

There are two ways to reach a page, and the layer only modelled one of them by name.

🔑 **`goto` is by address; a `go…` method is by clicking, and it belongs to the page you are
leaving.** `page.goto` is universal knowledge, so `goto` is unmistakable. `nav.goHome()` already did
the other half — it clicks the header link and waits for the URL — and it is now the worked example
of the rule rather than an oddity.

⛔ **The other four click routes were not written.** No test drives them, and a navigation method
with no caller is dead code. A chain-of-clicks test is worth having, and it is worth writing
together with the methods it needs.

📌 **`goto` waits for the page's own first answer, not for its skeleton** — see P3, fault 2.

---

## What this cost, and what it caught

| | |
|---|---|
| Files changed | 6 page objects, 4 specs, `CONVENTIONS.md`, `spec/FINDINGS.md` |
| Tests | 13 UI (2 new), 135 unit — green, three consecutive full runs |
| Application defects found | 1 — the feed tabs are unreachable from the keyboard |
| Oracle defects found | 2 — a count that included the empty state, a navigation that returned early |
| Suppressions added | 0 |

⬜ **Left open on purpose:** accessibility has no coverage in this repository, and the keyboard
finding is the first evidence that it should. That is a stage of its own, not a footnote to a
rename.
