# playwright-sdet-kit

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
npm run test:defects      # known defects of one deployment — red on purpose, see below
npm run lint
npm run typecheck
```

No browser is needed: the tests go through `APIRequestContext` only.

`.env` is optional — without it the defaults from the config apply, and the whole repository runs
without one.

## Two targets, on purpose

| Project | Target | Variable |
|---|---|---|
| `contract`, `unit` | `https://realworld.habsida.net/api` — conforms | `CONDUIT_API_URL` |
| `defects` | `https://api.realworld.show/api` — pinned | `CONDUIT_DEFECTS_API_URL` |

Three hosted Conduit deployments were live in August 2026 and they do not behave the same way.
The gate runs against one that conforms; switching it to another is one uncommented line in
`.env`, and that is how their behaviour gets compared. All three are listed in
[`.env.example`](.env.example) with what is wrong with each.

⛔ The defects target is not interchangeable with the gate's. Those tests assert the
**specification** against the deployment whose defects they document, so a conforming target
turns them green — and green in that suite is supposed to mean the defect was fixed.

## Three suites, three different questions

| Project | The question it answers | When it runs |
|---|---|---|
| `contract` | is this code, and are these schemas, still in agreement with the target | every push and PR — this is the gate |
| `unit` | does the chain artifact parser work | same |
| `defects` | **is that one deployment still broken** | nightly, on a schedule |

Reconnaissance found real defects — details in [`spec/FINDINGS.md`](spec/FINDINGS.md). They
belong to one deployment, not to RealWorld backends in general, which is why the gate moved away
from it and the defects suite stayed. The tests covering them assert the **specification**, so
they are red, and each one carries a link to a filed issue. They live in their own suite because
they answer a question about **somebody else's API**, not about this code.

A gate that is permanently red stops being a gate. A defect that is quietly marked as expected
to fail stops being a defect.

## The chain

| Artifact | Produced by | Input |
|---|---|---|
| `pipeline/01-rules.md` | BA | `spec/conduit-api.md` |
| `pipeline/02-cases.md` | QA | `01-rules.md` |
| `pipeline/03-report.md` + tests | TA | `02-cases.md` + `CONVENTIONS.md` |

Design decisions and their reasoning live in the project spec.
