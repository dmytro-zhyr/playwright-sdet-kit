# playwright-sdet-kit

![checks](https://github.com/dmytro-zhyr/playwright-sdet-kit/actions/workflows/checks.yml/badge.svg?branch=main&event=push)

A test automation framework built from scratch on **Playwright + TypeScript**: a typed API
client, fixtures composed through `mergeTests`, test data factories, strict `zod` response
schemas with a custom matcher, ESLint + Prettier, and CI on GitHub Actions.

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
npm run allure:generate   # build the report, carrying the previous run's history forward
npm run allure:open       # serve it
npm run allure:clean      # throw away both directories and start over
```

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

That question is not rhetorical here. `tests/defects/` is red on purpose, so a bare "9 failed" says
nothing until the reader knows which nine. [`report/allure.ts`](report/allure.ts) declares three
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

⛔ **`allure:clean` deletes the history along with everything else** — `allure-report/history/` is
where it lives. That is what the command is for, and it is the one difference from the same script
in `websocket-test`, where nothing is carried forward and so nothing can be lost. Run it to start a
trend over, not to tidy up.

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

[`api/deployments.ts`](api/deployments.ts) is the one place a name becomes a URL, for the fixture
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
| `contract` | is this code, and are these schemas, still in agreement with the target | every push and PR — this is the gate |
| `unit` | does the chain artifact parser work | same |
| `defects` | **is the deployment each test names still broken** | nightly, on a schedule |

The badge above is filtered to pushes on `main` — the gate. The nightly `defects` run stays
visible on the Actions tab, where a red run means the target is still broken, and does not stand
in for the state of this code.

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
