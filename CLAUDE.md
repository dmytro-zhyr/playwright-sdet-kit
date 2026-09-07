# Working rules for this repository

Everything about *how a test is written* lives in [CONVENTIONS.md](CONVENTIONS.md), and this file
does not repeat it. What is here is the one rule that governs every change rather than the code
inside one: **how a commit is written.**

---

## Commits follow Conventional Commits 1.0.0

The source is [the specification](https://www.conventionalcommits.org/en/v1.0.0/), and it is
enforced by `commitlint.config.mjs`, run from `.githooks/commit-msg` at the moment a message is
written. `npm run lint:commit` checks the tip by hand.

```
<type>(<scope>): <description>

<body>

<footer>
```

⛔ **Never bypass the hook.** Nothing downstream checks this, so `--no-verify` is not a delay —
it is the whole check, skipped. Fixing a message before the commit exists costs one keystroke;
after a push it costs rewritten history, which is forbidden below.

### The subject line

| Rule | Why |
|---|---|
| a type from the table below, then `: ` | rule 1 of the specification |
| lower case, no full stop | the description is a clause, not a sentence |
| imperative — "move", not "moved" or "moves" | it completes *"this commit will …"* |
| at most 72 characters including the type | `git log --oneline` and GitHub both truncate there |
| it names **the change**, not the discovery | the discovery goes in the body — see below |

### 🔑 The subject names the change, the body keeps the finding

This is the one place the convention costs something, and the resolution matters more than the rule.

The history here reads as findings in prose — `The lockfile froze undici, and upgrading jsforce
could not thaw it`. That is worth keeping: it is what makes the log readable to somebody who was
not there. But a subject line is also an index entry, and an index entry that is an epigram is a
bad index.

So the two jobs split across two places:

```
fix(deps): move undici to 8.10.2, the version jsforce always allowed

The lockfile froze it at 8.10.0, so upgrading jsforce changed nothing — jsforce
declares ^8.5.0 and 8.10.2 always satisfied it. `npm update undici` was the whole
fix, past two CRITICAL and six HIGH advisories.
```

⛔ **A body that restates the subject is not a body.** If the diff is self-evident, leave it out.
The body exists to say what the diff cannot: why this, why now, what was measured, what was
rejected.

### Types

The Angular set, which is what `@commitlint/config-conventional` implements. Nothing outside it is
accepted.

| Type | Use it for | In this repository |
|---|---|---|
| `feat` | new capability | a new page object, matcher, fixture, suite |
| `fix` | a defect in something already committed | a wrong locator, a false oracle, a vulnerable dependency |
| `test` | tests added or corrected, nothing else changed | a spec written against code that already existed |
| `refactor` | behaviour unchanged | the page-object renames |
| `perf` | a refactor whose point is speed | — |
| `docs` | documentation only | CONVENTIONS.md, spec/FINDINGS.md, PLAN.md, this file |
| `build` | dependencies, tooling, tsconfig | adding commitlint |
| `ci` | `.github/workflows/`, reporting pipeline | adding the prettier gate |
| `style` | formatting with no behaviour change | the output of `npm run format` |
| `revert` | undoing a commit | — |
| `chore` | none of the above, and touching nothing that ships | `.gitignore` |

⚠️ **`ops` is not a type here**, despite appearing in the widely-copied qoomon gist. The
specification defines only `feat` and `fix` and leaves the rest to convention; the convention this
repository runs is Angular's, and `ci` covers what `ops` was reaching for. Where a summary and the
runnable config disagree, the config wins — it is the one that says no.

📌 **`fix` means a defect in committed code, not a correction to unpushed work.** Amend or rebase
that instead; a `fix` commit for a typo introduced ten minutes earlier adds a log entry that
describes nothing that ever ran.

### Scopes

Optional, and it is a noun for a part of the codebase — never a ticket number. The vocabulary
follows the module aliases in `tsconfig.json` plus the things that are not modules:

`po` · `api` · `assertions` · `schemas` · `fixtures` · `deployments` · `data` · `pipeline` ·
`report` · `contract` · `ui` · `unit` · `defects` · `deps` · `ci` · `docs`

⬜ It is deliberately **not** enforced as a `scope-enum`. The list has existed for one day, and an
enum rejects a scope that is legitimate and merely new. Same reasoning as the absent `.snyk` policy
file: policy written before there is a problem is policy for a problem that does not exist. When
the list stops changing, enforcing it is a one-line change to `commitlint.config.mjs`.

### Breaking changes and footers

`!` before the colon — `refactor(po)!: ` — and an explanation in a `BREAKING CHANGE:` footer.
⚠️ `BREAKING CHANGE` is the one token the specification requires in upper case.

Footers are `Token: value` with hyphens instead of spaces. `Refs: #12`, `Closes: #12`.

⛔ **No `Co-Authored-By` trailer naming an AI assistant**, on any commit in this repository.

---

### ⛔ Why CI does not check this

Every other rule in this repository is gated on CI — formatting, lint, types, coverage,
vulnerabilities — so the absence here is a decision and not an oversight.

🔑 **A gate is worth having where its failure can be acted on.** `prettier --check` goes red and the
answer is: edit the file, commit, push. A commit message that reaches `main` has no such answer.
Fixing it means rewriting pushed history, which the section below forbids, so the gate would report
a problem nobody intends to solve — the exact failure the `defects` job carries a warning about.

⚠️ The premise *"nobody commits on CI, so do not check commits on CI"* is not the reason, and it
proves too much: nobody formats on CI either. The reason is that the work pushed here goes straight
to `main`, where the report arrives after the only moment it could have helped.

➡️ **What would bring it back:** a pull-request flow. On a branch that is not yet `main` the message
is still fixable — rebase, force-push — and a `pull_request`-only step becomes worth its lines. Until
then it would be a step no event triggers, and a CI step with no trigger is the same dead weight as a
page-object method with no caller.

⚠️ **The residual risk, named rather than engineered around.** The hook is installed by the `prepare`
script pointing `core.hooksPath` at `.githooks/`, so a clone where only `npm ci --ignore-scripts` ever
ran has no hook and reports nothing — a check that is not looking. `npm install` sets it; `git config
core.hooksPath` says whether it is set.

---

## What is not rewritten

Everything before **7 September 2026** predates this rule and stays as it is. Rewriting pushed
history to satisfy a convention adopted afterwards costs every existing hash and buys a tidier log
nobody reads twice. The gate only ever looks at commits in the push that brought it.
