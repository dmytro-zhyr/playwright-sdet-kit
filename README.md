# playwright-sdet-kit

![checks](https://github.com/dmytro-zhyr/playwright-sdet-kit/actions/workflows/checks.yml/badge.svg?branch=main&event=push)

A test automation framework built from scratch on **Playwright + TypeScript**: a typed API
client, fixtures composed through `mergeTests`, test data factories, strict `zod` response
schemas with a custom matcher, **type-aware ESLint** + Prettier, and CI on GitHub Actions.

Type-aware is the word that matters: the rule set is `recommendedTypeChecked`, so a missing
`await` on an assertion is a lint error rather than a test that passes without looking. That is
the same defect class this suite found by hand in D-12, and the linter catches it every run.

On top of it sits an **agent chain, BA → QA → TA**, that turns the
[RealWorld / Conduit](https://github.com/gothinkster/realworld) specification into contract API
tests. Every handoff between agents is a diffable artifact under git, and its shape is
**checked by code** rather than agreed by convention.

The agents commit nothing themselves. They produce **proposals** in `pipeline/`; a human decides.

## Running the tests

```bash
npm install
cp .env.example .env      # optional — only to point at a different target
npm run test:contract     # contract tests against the gate target
npm run test:unit         # tests for the chain artifact parser
npm run test:ui           # browser tests against the UI gate
npm run test:defects      # known defects, each naming its deployment — red on purpose
npm run lint
npm run typecheck
```

`contract`, `unit` and `defects` need no browser: they go through `APIRequestContext` only.
`test:ui` is the one project that starts one — `npx playwright install chromium` first.

## Reports

```bash
npm run allure:generate     # build the report, carrying the previous run's history forward
npm run allure:open         # serve it
npm run allure:clean        # start a fresh set of results, keep the trend
npm run allure:hard-clean   # forget everything, trend included
```

**Two intentions hide under the word "clean", and they are not the same.** The history lives inside
the generated report — `allure-report/history/` — so any command that removes the report removes
the trend with it. `allure:clean` moves the history to safety first and `allure:hard-clean` does
not, which is the whole difference between them.

📌 The three names match [`websocket-test`](https://github.com/dmytro-zhyr/websocket-test), which
does the same job under Jest. The same task should not be called two things across two repositories
that get opened in the same week.

Results accumulate in `allure-results/` across suites, so running `test:unit`, `test:contract`,
`test:ui` and `test:defects` and then building once gives **one** report covering all four.
Re-running a suite replaces its own results rather than adding to them — a test keeps its identity
between runs, which is also what makes the history meaningful.

🔑 **Allure is not a prettier version of Playwright's HTML report.** The built-in one answers *what
happened in this run*, and does it better — the trace viewer is not replaceable. Allure answers
*what keeps happening*, and one question the other cannot reach at all: **which of these failures
were ever about our code**.

That question is not rhetorical here. `tests/defects/` is red on purpose, so a bare "10 failed"
says nothing until the reader knows which ten. [`report/allure.ts`](report/allure.ts) declares three
categories that answer it:

| Category | What it collects |
|---|---|
| **Known defect of the target** | anything under `tests/defects/` — red is the expected state, green would be the news |
| **Target unavailable** | connection errors and timeouts; somebody else's uptime, not a defect anywhere |
| **Setup failed before the subject** | an account that could not be created, a session never seeded — the test never reached what it was about |

Allure's generator adds `Product defects` and `Test defects` behind these, and a result lands in the
**first** category that matches. So a failure with no explanation still surfaces — it just surfaces
as unexplained, which is the point.

⚠️ `allure:generate` is a script rather than a bare `allure generate` because `--clean` wipes the
output directory, and the trend data lives inside it. Generating without carrying history forward
leaves a report that looks complete and has forgotten every run before the last.

📌 **What `allure:clean` leaves behind is `allure-results/history/` and nothing else** — the report
directory goes entirely. Pruning it in place would leave a directory called `allure-report` that no
longer holds a report, and that is the kind of stale artifact that gets opened and believed. It is a
build output; `allure:generate` rebuilds it whole.

⛔ **`allure:hard-clean` is the one that drops the trend.** It is `websocket-test`'s `allure:clean`
under a name that says what it costs here — that repository carries no history forward, so its
version can lose nothing.

📌 An empty **Categories** tab means the run was green. Categories collect failures and nothing
else, so there is nothing to fix when it is blank — and nothing to tag either: a category is a rule
that matches a failure, not a label anyone puts on a test.

`.env` is optional — without it the defaults from the config apply, and the whole repository runs
without one.

## Named deployments

Three hosted Conduit deployments were live in August 2026 and they do not behave the same way. A
test does not spell a URL and does not inherit one by accident — it names the deployment it is
about:

```ts
const gate = await deployment('conduit-gate');
```

| Name | Default | Variable |
|---|---|---|
| `conduit-gate` | `https://realworld.habsida.net/api` — conforms broadly; the gate's target | `CONDUIT_API_URL` |
| `conduit-unsound` | `https://api.realworld.show/api` — uniqueness, identity and visibility all fail | `CONDUIT_DEFECTS_API_URL` |
| `conduit-overstrict` | `https://conduit-api.bondaracademy.com/api` — validates beyond the contract | `CONDUIT_OVERSTRICT_API_URL` |

[`deployments/registry.ts`](deployments/registry.ts) is the one place a name becomes a URL, for the fixture
and for `playwright.config.ts` alike. Every name has a working default, so the repository runs
with no `.env`; repointing one is one line. A name the registry does not know **throws and lists
the ones that would have worked** — it never falls back to a default, because a suite that ran
green against a deployment nobody chose is the failure this repository exists to refuse.

A deployment has an API and, separately, may or may not have a **browser UI**. `conduit-gate` has
none — `realworld.habsida.net/` answers 404 — so the deployment the contract suite is measured
against cannot host a single UI test, and the registry records that absence as a stated fact:

```ts
const ui = resolveUiDeployment('conduit-gate');
// throws: has no browser UI, so it cannot host a UI test.
// Deployments with a UI: conduit-unsound, conduit-overstrict
```

⛔ It does not fall back to the API URL. A browser opening JSON fails on every locator at once, and
the report would read as a hundred broken page objects rather than one wrong target.

The UI gate is therefore **`conduit-overstrict`**, reached by elimination: `conduit-unsound` has a
UI, and D-5 hides a write from everyone but its author, which would turn "publish an article, then
find it in the feed" red for a reason that has nothing to do with the page. Its own deviation — a
username over 20 characters is rejected — is what disqualified it as the *API* gate and is out of
reach of a browser test. **The same property decides the two gates in opposite directions**, which
is only sayable because deployments are named.

Defects are documented on **two** of the three, so `tests/defects/` is not one pinned target any
more: each test there names its own, and
[`tests/defects/authentication.spec.ts`](tests/defects/authentication.spec.ts) names two.

⛔ No defects target is interchangeable with the gate's. Those tests assert the **specification**
against the deployment whose defects they document, so a conforming target turns them green — and
green in that suite is supposed to mean the defect was fixed.

## Three suites, three different questions

| Project | The question it answers | When it runs |
|---|---|---|
| `unit` | does this repository's own code work | every push and PR — the gate |
| `contract` | is this code, and are these schemas, still in agreement with the target | same |
| `ui` | do sign-up, sign-in and publishing still work for a user in a real browser | same |
| `defects` | **is the deployment each test names still broken** | nightly, on a schedule |

The badge above is filtered to pushes on `main` — the gate. The nightly `defects` run stays
visible on the Actions tab, where a red run means the target is still broken, and does not stand
in for the state of this code.

⚠️ **`ui` used to be described here as "do the page objects still match the pages".** That was
written from the layer the tests are built on rather than from what they assert, and it undersold
them: `tests/ui/` holds eleven tests about what a user can do — register, sign in, be refused a
wrong password, publish an article, find it in the global feed, be turned away from the editor
while anonymous. Page objects are what those tests are *written with*. Corrected 31 August 2026,
along with the job names on CI, which repeated the same sentence.

⚠️ **`ui` is the arguable one.** Like `contract` it depends on somebody else's host being up, so a
third party can turn the gate red. That trade was already accepted for `contract` and for the same
reason: both ask whether *our* code is still right, and an answer that arrives a day later on a
schedule is not a gate. `defects` is the only suite whose redness says nothing about this
repository, and it is the only one kept out of the gate. Its other cost is worth naming: every
`ui` run registers a dozen `qa_` accounts on a third-party deployment that has no delete endpoint.

### Why the nightly run stays red, and why that is not a defect of the setup

`tests/defects/` names deployments this project does not own and cannot fix. On a working project
a defect test is **temporary by construction**: it gets a ticket, it is quarantined, the fix lands
and the test returns to the gate. Here the fix never lands, so the suite is permanent — and a
permanently red job is a real problem *on a team*, where it teaches people that red means nothing.

That concern does not transfer here, and the reason is worth being explicit about, because it is
the kind of rule that gets imported from the wrong context:

- **There is no team to desensitise.** The failure mode of a permanently red job is social, and
  this repository has no on-call, no alert fatigue and no shared build to unblock.
- **The badge already separates the two.** It is filtered to pushes on `main`, which is the gate
  and is green. The nightly run lives on the Actions tab and is read deliberately.
- **The report is the deliverable, and a report needs failures.** `report/allure.ts` exists to
  answer *which of these failures were ever about our code*, and it answers it with categories that
  are populated by failing tests. A suite with nothing red would empty the Categories tab and
  delete the demonstration along with the redness.

🔑 **So the red is load-bearing.** Reading a real failure — its message, its category, whether the
error says what actually broke — is the thing this repository has to show about reporting, and it
cannot be shown with everything green.

⛔ **`test.fail()` is the obvious mechanism and it is deliberately not used.** Measured on 31
August 2026 with three tests: one failing for its documented reason, one failing because the target
answered 429, one passing. Playwright counted **both** failures as expected and reported the pass
as the only failure. It checks *that* a test failed, never *why* — so a target outage would read as
"the defect is still there", which is precisely the confusion the Allure categories exist to
prevent. Recorded here because it is the first thing anyone will propose.

A fifth job builds **one Allure report** over whichever suites ran, and uploads it as a workflow
artifact. Download it, unzip it and serve it — `npx allure open allure-report`; opening
`index.html` from the filesystem shows an empty page.

⛔ **It is not published to GitHub Pages.** This repository is private, and Pages would either be
unavailable or would put the report — deployment URLs, test names, failure messages — on a public
address. An artifact is reachable by whoever can already read the repository, which is the same set
of people.

📌 The trend survives between runs through `actions/cache`, because a runner keeps nothing and the
history lives inside the generated report. Without it every CI report would show a trend of one
point and look complete. The report is built by the same `npm run allure:generate` used locally, so
the two cannot drift apart.

Reconnaissance found real defects — details in [`spec/FINDINGS.md`](spec/FINDINGS.md). They
belong to particular deployments, not to RealWorld backends in general, which is why the gate
moved away from the worst of them and why every defects test names the one it reproduces. The
tests covering them assert the **specification**, so they are red, and each one carries a link to
a filed issue. They live in their own suite because they answer a question about **somebody
else's API**, not about this code.

A gate that is permanently red stops being a gate. A defect that is quietly marked as expected
to fail stops being a defect.

## The chain

| Artifact | Produced by | Input |
|---|---|---|
| `pipeline/01-rules.md` | BA | `spec/conduit-api.md` |
| `pipeline/02-cases.md` | QA | `01-rules.md` |
| `pipeline/03-report.md` + tests | TA | `02-cases.md` + `CONVENTIONS.md` |

Design decisions and their reasoning live in the project spec.
