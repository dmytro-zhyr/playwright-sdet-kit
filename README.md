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
