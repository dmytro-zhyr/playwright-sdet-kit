import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateRules, validateCases, ruleCoverage } from '@/pipeline/parse';
import { validateAgentDefinition } from '@/pipeline/agentDefinition';

// The repository root, reached from tests/unit/, so the paths below do not depend on the
// directory the runner happened to be started from.
const ROOT = join(__dirname, '..', '..');

function read(...segments: string[]): string {
  return readFileSync(join(ROOT, ...segments), 'utf-8');
}

// Turns red if the real artifact stops satisfying the format the parser enforces — a duplicate or
// skipped identifier, a rule with no Source or Statement, a Kind that is neither explicit nor
// assumed, or a missing mandatory section. The validator has its own unit tests; this one is the
// only place where the artifact the QA agent will actually read is checked.
test('pipeline/01-rules.md passes validation', () => {
  const markdown = read('pipeline', '01-rules.md');

  expect(validateRules(markdown), 'problems found in the rules file').toEqual([]);
});

// Turns red if the BA agent's own definition drifts out of shape — frontmatter that does not
// open or close, a missing name or description, a name that no longer matches the file, a lost
// `## Your task` or `## Forbidden` section, or a carriage return sneaking back in. Without this
// the agent would simply start behaving differently and the cause would be hunted for in its
// output rather than in its frontmatter.
test('.claude/agents/ba.md passes validation', () => {
  const markdown = read('.claude', 'agents', 'ba.md');

  expect(validateAgentDefinition(markdown, 'ba.md'), 'problems found in the BA agent').toEqual([]);
});

// Turns red if the cases the QA agent produced stop being readable as written or stop agreeing
// with the rules — a heading whose separator is not an em dash, a `**Grouping rationale:**`
// written as a field instead of a bullet, a Covers entry that is not an identifier, a case with
// no Steps or no Expected, a gap in the numbering, a reference to a rule R-138 does not reach,
// or a lost `## Not covered` section. This is the only place the artifact the TA agent will
// actually read is checked against the artifact it was derived from.
test('pipeline/02-cases.md passes validation against the rules', () => {
  const rules = read('pipeline', '01-rules.md');
  const cases = read('pipeline', '02-cases.md');

  expect(validateCases(rules, cases), 'problems found in the cases file').toEqual([]);
});

// Turns red if the QA agent's own definition drifts out of shape — the same failures ba.md is
// guarded against: frontmatter that does not open or close, a missing name or description, a
// name that no longer matches the file, a lost `## Your task` or `## Forbidden` section, or a
// carriage return sneaking back in on a Windows checkout.
test('.claude/agents/qa.md passes validation', () => {
  const markdown = read('.claude', 'agents', 'qa.md');

  expect(validateAgentDefinition(markdown, 'qa.md'), 'problems found in the QA agent').toEqual([]);
});

// Turns red if either artifact stops parsing at all — `ruleCoverage` calls `parseRules` and
// `parseCases`, which throw rather than return a plausible number — or if the rule set empties
// out, or if the cases stop referring to any rule the rules file defines. The logged line is the
// baseline the plan asks to be recorded: the share of rules at least one case refers to, counted
// over distinct identifiers, with the deliberate gaps living in `## Not covered`.
test('rule coverage is recorded', () => {
  const rules = read('pipeline', '01-rules.md');
  const cases = read('pipeline', '02-cases.md');
  const coverage = ruleCoverage(rules, cases);

  console.log(`Rule coverage: ${coverage.covered}/${coverage.total}`);
  expect(coverage.total).toBeGreaterThan(0);
  expect(coverage.covered).toBeGreaterThan(0);
});
