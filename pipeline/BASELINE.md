# Baseline — a run without a critic

**Date:** 25 August 2026
**Chain:** BA → QA → TA, no critic
**Model:** `opus` for all three agents, pinned in their definitions so the figure below is
reproducible against a fixed variable rather than against whatever a session defaulted to.

Each link was run by a fresh agent that read only the previous link's output. No link was allowed
to read the specification if it was not its input, to read `spec/FINDINGS.md`, or to read the
artifact it was about to overwrite.

## The numbers

| Measure | Value |
|---|---|
| Rules in total | **201** |
| Of those, `assumed` | **76** (37%) |
| Open questions raised by BA | **16** |
| Cases in total | **85** |
| Rule coverage | **199 / 201** |
| Rules per case | **2.36** |
| Cases implemented as tests | **18** |
| Cases refused | **3** |
| Cases marked uncertain | **1** |
| Cases not attempted | **63** |
| ESLint problems in the TA output, first run | **0** |
| Validator rejections, all three links | **0** |
| Artifact edits made by hand | **0** |

Contract suite after the run: **28 passed, 2 failed**, both failures triaged as defects of the
target and left red.

## 🔴 The finding that matters more than any figure above

This was the **second** clean run. The first, on 24 August, used the same specification, the same
agent definitions and the same model.

| | First run | Second run |
|---|---|---|
| Rules | 138 | **201** |
| Cases | 45 | **85** |
| Rules per case | 3.07 | **2.36** |
| Rule coverage | 135 / 138 | 199 / 201 |

**The rule count moved 46%.** Nothing in the input changed. The BA agent said so itself, without
being asked:

> 201 is a defensible reading of this specification, and so would be 120 or 300. The headline
> number is a choice, not a derivation from the instructions.

And the ratio moved too, from 3.07 to 2.36 — so the second link did not merely scale with the
first. **Instability is added at every link, not inherited from one.**

### What this does to the experiment

The plan intended to compare a critic-assisted run against this baseline using these counts. That
cannot work: a 46% swing on identical input is noise that would swallow any effect a critic has.

➡️ **Two of the figures above were stable across both runs, and they are the only ones worth
comparing on:**

| Stable | Why it is stable |
|---|---|
| **ESLint problems on first output** | a property of the code produced, not of how the work was carved up |
| **Validator rejections** | a property of obeying a machine-checked contract |

Everything else describes **how the work was divided**, and that is exactly what varies.

⚠️ **So the stage 2 comparison has to change shape.** Not "more or fewer rules", but questions a
count cannot answer:

- Does the critic **reduce the share of `assumed` rules that are actually unstated inventions**?
- Does it catch a **problem the chain already contained and could not see** — see the two below?
- Does the share of runs where human review changes nothing **approach zero**?
- Do TA's **refusals** fall, and do the remaining ones become sharper?

## Two problems the chain produced and could not see

Both are content, not form, which is why the validator is silent on them.

**Inside one artifact.** `C-018` says `bio` and `image` are "each either a string or `null`";
`C-029` says both are `null` at the moment of creation, and its own rationale says the split is
deliberate and names `R-065` for it. The two are satisfiable at once — a registration answering
`null` passes both — so they do not contradict each other. What is true is weaker, and still worth
saying: **`C-018` is too weak.** A registration answering `bio: ""` passes `C-018` and fails
`C-029`, and a suite is a conjunction, not a disjunction, so the suite as a whole is right to go
red. The target answering `""` at creation is a defect of the target, not a disagreement inside the
cases file.

> **Superseded on 25 August 2026.** This paragraph read: "`C-018` admits `bio` as a string *or*
> `null`; `C-029` requires `null` at creation, and its own rationale says the split is deliberate.
> The same document both allows and forbids the same value, and the target lands in the gap."
>
> That reading is wrong, and **the critic is what found it wrong** — `O-019`, call 3, objecting to
> the same claim in `pipeline/03-report.md`, which is where this file took it from. The correction
> is a result of the acceptance run, not a tidy-up after it, and the superseded sentence stays
> visible because deleting it would hide the one thing this document exists to record: what was
> believed before the run, and what the run changed.

**Between artifacts.** `R-015` states that every carried-out request answers 200, while `R-155` and
`R-174` say only "a success status", and BA's own open questions concede 201 is conventional for
creation. A case built on `R-015` therefore fails against a conforming deployment on a point the
rules never settled.

🔑 **This is the strongest argument for the critic that exists so far**, and it is not that the
critic finds new things. It is that **the chain already knew**: BA recorded the status ambiguity as
its first open question, QA repeated it, TA had to resolve it by probing an implementation — the
one place a contract test must never take its expectation from.

> A section called `Open questions` with no mechanism to stop is a list everyone reads and nobody
> closes.

## What review still has to do, and cannot be delegated

Three defects of this run were found by a human reading the output, not by any check:

1. A stale identifier in `tests/defects/not-found.spec.ts`, still naming `C-006` from the previous
   run. Identifiers resolve, so nothing is red.
2. `C-018` being too weak to catch `bio: ""` at creation, where `C-029` catches it — see the
   correction above. Recorded here on 25 August as a contradiction between the two, which it is
   not; the finding is real, and smaller than the entry it replaces.
3. A conflict in the instructions themselves: `ta.md` forbids committing, while the task that
   dispatched the agent required it. The agent obeyed the task **and reported the conflict** —
   which is the behaviour the prompt asks for, and the reason the conflict is known at all.

📌 The chain has exactly one automated staleness check — the report must account for every case
identifier exactly once — and it worked: it went red the moment the cases were regenerated. The
rules-to-cases link has no equivalent, because a reference there only has to *resolve*. Extending
the existing technique to that link is the cheapest real improvement available.

## Observations

**What the agents did well.** All three read `pipeline/parse.ts` before writing anything, including
its `Known limitations` block, and wrote to the traps it names. That is why the validator rejected
nothing — not luck, and not something to read as the artifacts being flawless.

**Where a human had to step in.** Nowhere in the artifacts. Every intervention this run was to the
*instructions* — a contradictory dispatch, and prompts that had to forbid reading files an agent
would otherwise have read.

**Which prompt wordings proved insufficient.** `qa.md` states the bullet-versus-field requirement
three times and never shows it; both QA runs settled it by reading the parser instead. `ta.md`
forbids committing while every dispatch requires it. `ba.md` never mentions that `## ` headings are
a closed set of three, so an agent adding a reasonable `## Scope` would be rejected.

## The acceptance run

Section numbers below name **the design spec** —
`docs/superpowers/specs/2026-08-25-critic-acceptance-design.md`, which lives in the author's
`resume` repository and not in the `spec/` directory of this one.

**Date:** 25 August 2026. **Verdict against the design spec's section 8 criterion: criterion A
void, criterion B passed.** Criterion A was built on the `C-018`/`C-029` contradiction, and there
is no such contradiction — see the correction above. A criterion that cannot be failed honestly is
not failed; it is void. Reporting the run as "partial" on the strength of one would be the same
mistake this repository exists to refuse.

> **Superseded on 25 August 2026.** This verdict read: "**Verdict against the spec 8 criterion:
> partial.** One of the two suppressed contradictions was raised as designed; the other was not."
> It was computed against a premise `O-019` disproved.

The criterion was split into two falsifiable halves before the run. The ruling that split it is
quoted here rather than pointed at, because the file it was written in is untracked and does not
exist for anyone who clones this repository:

> The acceptance criterion was half invalid, and it was amended **before** the run, not after.
> Preparing the copies showed that both answers are already written in the artifacts themselves:
> `01-rules.md`'s own `## Open questions` states the success-status uncertainty verbatim and names
> `R-015`, `R-155` and `R-174`; `03-report.md` spells out the `C-018`/`C-029` conflict in a full
> paragraph. A critic there has nothing to find, only something to read. `BASELINE.md` said the
> chain already knew, and a "will it find it" test was built on that material anyway. So the
> criterion becomes two separate falsifiable questions — **A, FIND:** does call 2 raise
> `C-018`/`C-029` where nothing declares it? **B, CLOSE:** do calls 1 and 3 turn an
> already-recorded open question into a blocking objection? Failing B would mean the critic behaves
> exactly like the chain without it.

**A — FIND, call 2 (`01-rules.md` → `02-cases.md`) raises `C-018`/`C-029`: void.** Call 2 returned
six objections (O-007 through O-012 in `pipeline/04-objections.md`). None names both `C-018` and
`C-029`; `C-018` appears once, alone, in an objection about an unstated closure requirement
(O-008), and `C-029` does not appear in call 2 at all. Read literally that is a "no" — but the
question the criterion asked was whether the critic would raise a contradiction that does not
exist. **There was nothing to find.** What criterion A measured, once its premise fell, is whether
the critic would reproduce a human's misreading, and it did not.

Call 3 settled the premise. `O-019` read the *report's* Triage of the same claim and objected that
the framing is wrong: `C-018` accepts a string or `null`, `C-029` requires `null` specifically at
creation, and a `null` response satisfies both at once, so nothing about the two cases forces a
choice between them.

**That counter-reading is correct, and this document now says so** rather than leaving it open —
leaving it open is what let the wrong half stand as fact sixty lines above. Read the two `Expected`
clauses against each other: `C-018` admits `null`, `C-029` requires it, and a suite is a
conjunction, so a registration answering `bio: null` satisfies both at once. A contradiction would
need a response one case demands and the other refuses, and no such response exists. What exists is
a **strictness gap**: on `bio: ""` at creation `C-018` is green and `C-029` is red, and because
both must hold, the suite is red. `C-018` is weaker than its neighbour — a real observation about
the cases file, and a much smaller one than a contradiction.

The other half of the counter-reading, that `C-029` invents a requirement of its own, does not
survive either. `R-065` exists, `Kind: assumed`, and states that `bio` and `image` are `null` for
an account that has just been registered because registration takes no value for either. `C-029`
covers it, and its grouping rationale cites the split openly. An assumed rule is a declared
assumption; it is not an invention, and the honest complaint against it is that it is assumed, not
that it is absent.

**B — CLOSE, calls 1 and 3 turn the `R-015`/`R-155`/`R-174` open question into a blocking
objection: yes, both.** Call 1's O-002 names all five identifiers the rules file's own open
question ties together (`R-015`, `R-129`, `R-155`, `R-161`, `R-174`) and asks which reading a
downstream case should take. Call 3 never saw `01-rules.md` and could not have cited those
identifiers — it received only `02-cases.md` and `tests/` + `03-report.md` — yet its O-014
independently re-opened the same substance from the other end of the chain: it shows the report's
Feedback section claiming "no artifact in the chain fixes a success status" for endpoints,
including `POST /articles`, that `C-009` (which exists specifically to cover `R-015`/`R-016`)
already asserts 200 for. Two calls, given disjoint artifact pairs, converged on the same
unresolved question from opposite ends of the chain. Both verdicts read `Objections remain.`

**Objection counts.** Call 1: 6 (O-001–O-006). Call 2: 6 (O-007–O-012). Call 3: 7 (O-013–O-019).
Nineteen total.

**Noise: one of nineteen, and it is the run's own doing, not the critic's.** O-015 (call 3) objects
that the report cites `tests/unit/artifacts.spec.ts` as the file that enforces exhaustive case
accounting, when no such file exists in the `tests/` the critic was given. The file is real — it is
this repository's own validation harness — but Step 1 of the acceptance run's own procedure
deliberately excludes `tests/unit/` from the frozen copy (the brief's copy script names only
`tests/contract` and `tests/defects`), because that directory is this SDD project's tooling, not
part of the API test batch the `ta` agent produces. Call 3 was correct about the artifact it was
handed and wrong about the repository, through no fault of its own: the run's scoping choice
manufactured a false positive. The other eighteen objections were checked by hand against the real
files — quoted lines, Covers-list counts, precondition text, test-file contents — and every one of
them holds. Two are worth naming for what they caught beyond the acceptance criterion itself: O-013
shows the report's provenance claim ("neither `spec/conduit-api.md` … was opened") contradicted by
spec-derived wording inside the very tests that batch produced, and O-017 shows a Feedback item
describing `tests/defects/not-found.spec.ts` as still carrying a stale `C-006` name, when Task 3 of
this branch had already renamed it to `D-6` before this report was read — the report is stale on a
point Task 3 fixed, not on a point nobody had touched.

**Did each critic say it was done.** Yes, all three. Each of the three replies ends on exactly one
of the two sentences its definition allows, and all three chose the same one: `Objections remain.`
None trailed off, none invented a third state.

**What follows for three runs per branch.** Nothing — this run cannot speak to it, and saying
otherwise would repeat the exact mistake the amendment above was written to avoid. "Three runs per
branch" is a question about *agreement between independent runs of the same link*: given the same
two artifacts twice, does the critic converge or scatter? This acceptance run dispatched each of
the three links exactly once. A low noise rate on a single pass (here, one in nineteen, and that
one caused by the harness rather than the model) says the critic reads carefully; it says nothing
about whether a second, independent call on the same `01-rules.md` → `02-cases.md` pair would
return the same six objections, a different six, or six plus one more that this run's single call
happened not to raise. Measuring that requires running the same link more than once and comparing
the outputs, which is exactly the retry/escalation machinery the design spec's section 9 defers —
this run is evidence for building it, not a substitute for it.

⚠️ **The honesty boundary — the design spec's section 10, translated in full.** The spec is
written in Ukrainian and lives in another repository. Everything here is written in English, so the
one sentence this project must not overstate is given in the language of the people who read it:

> The acceptance test measures the critic on **two defects a human had already found**. It does not
> follow that the critic finds defects in general — only that it finds **this class**: a
> contradiction between two places in one artifact, and one between two artifacts of the chain.
>
> ⚠️ **That is how it has to be stated, in the README and in conversation.** Claiming "the critic
> works" on the strength of one run against known answers is precisely the mistake the whole
> project is built against.

📌 **After the correction above, the boundary is narrower still.** One of the two defects the
acceptance test was built on turned out not to be a defect. What this run measured is the critic
against **one** already-known defect, plus one place where the critic read the artifacts correctly
and the human who wrote this file did not.
