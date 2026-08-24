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
- Does it catch a **contradiction the chain already contained** — see the two below?
- Does the share of runs where human review changes nothing **approach zero**?
- Do TA's **refusals** fall, and do the remaining ones become sharper?

## Two contradictions the chain produced and could not see

Both are content, not form, which is why the validator is silent on them.

**Inside one artifact.** `C-018` admits `bio` as a string *or* `null`; `C-029` requires `null` at
creation, and its own rationale says the split is deliberate. The same document both allows and
forbids the same value, and the target lands in the gap.

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
2. The `C-018` / `C-029` contradiction above.
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
