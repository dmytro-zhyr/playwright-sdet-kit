import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  validateRules,
  validateCases,
  validateObjections,
  ruleCoverage,
  parseCases,
} from '@/pipeline/parse';
import { validateAgentDefinition } from '@/pipeline/agentDefinition';
import { traceabilityProblems, type TestFile } from '@/pipeline/traceability';

// The repository root, reached from tests/unit/, so the paths below do not depend on the
// directory the runner happened to be started from.
const ROOT = join(__dirname, '..', '..');

function read(...segments: string[]): string {
  return readFileSync(join(ROOT, ...segments), 'utf-8');
}

/**
 * Every spec file of the named directories, addressed the way the report addresses them.
 *
 * `tests/unit/` is deliberately absent: its files carry `C-001` strings as fixtures for the
 * validator, not as references to cases.
 */
function specFiles(...directories: string[]): TestFile[] {
  return directories.flatMap((directory) =>
    readdirSync(join(ROOT, directory))
      .filter((name) => name.endsWith('.spec.ts'))
      .map((name) => ({
        path: `${directory}/${name}`,
        content: read(directory, name),
      }))
  );
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

/** The four sections `.claude/agents/ta.md` requires the report to account for every case in. */
const ACCOUNTING_SECTIONS = ['## Automated', '## Refused', '## Uncertain', '## Not attempted'];

/**
 * The text of those four sections and of nothing else.
 *
 * Deliberately not the whole file: the report's `## Triage` and `## Feedback` sections discuss
 * individual cases by name, and counting those occurrences would turn "accounted for exactly
 * once" into "never explained twice", which is a different and much less useful statement.
 */
function accountingSections(report: string): string {
  const collected: string[] = [];
  let inside = false;

  for (const line of report.split('\n')) {
    if (line.startsWith('## ')) {
      inside = ACCOUNTING_SECTIONS.includes(line.trim());
    } else if (inside) {
      collected.push(line);
    }
  }

  return collected.join('\n');
}

// Turns red if the TA agent's own definition drifts out of shape — the same failures ba.md and
// qa.md are guarded against: frontmatter that does not open or close, a missing name or
// description, a name that no longer matches the file, a lost `## Your task` or `## Forbidden`
// section, or a carriage return sneaking back in on a Windows checkout.
test('.claude/agents/ta.md passes validation', () => {
  const markdown = read('.claude', 'agents', 'ta.md');

  expect(validateAgentDefinition(markdown, 'ta.md'), 'problems found in the TA agent').toEqual([]);
});

// Turns red if the critic's own definition drifts out of shape — and one drift matters more than
// the rest: `tools` is what makes the critic read-only. Restore Write or Edit to that line and
// the one agent whose value is its independence from what it judges can edit what it judges.
test('.claude/agents/critic.md passes validation', () => {
  const markdown = read('.claude', 'agents', 'critic.md');

  expect(validateAgentDefinition(markdown, 'critic.md'), 'problems found in the critic').toEqual(
    []
  );
});

// Turns red if the critic is granted a tool that writes. The definition above only has to carry a
// `tools` line; this one says what may be on it. A prohibition in prose is an agreement, and an
// agent can decide an agreement does not apply this once.
test('the critic holds no tool that can write', () => {
  const markdown = read('.claude', 'agents', 'critic.md');
  const tools = /^tools:\s*(.+)$/m.exec(markdown)?.[1] ?? '';

  expect(tools.split(',').map((tool) => tool.trim())).toEqual(['Read', 'Grep', 'Glob']);
});

// Turns red if the report stops accounting for every case exactly once — a case implemented and
// then also parked under `## Not attempted`, a case quietly dropped when a batch grew, a renamed
// section heading that takes its whole table out of the count, or a new case added upstream that
// nobody has decided anything about yet. Silence about a case is the one outcome the report may
// not have, and by eye across forty-five identifiers it is invisible.
test('pipeline/03-report.md accounts for every case exactly once', () => {
  expect(
    existsSync(join(ROOT, 'pipeline', '03-report.md')),
    'the TA agent must leave a report behind'
  ).toBe(true);

  const cases = parseCases(read('pipeline', '02-cases.md'));
  const accounted = accountingSections(read('pipeline', '03-report.md'));

  expect(
    cases.length,
    'the cases file must hold cases for the report to account for'
  ).toBeGreaterThan(0);

  const miscounted = cases
    .map((testCase) => ({
      id: testCase.id,
      times: accounted.split(testCase.id).length - 1,
    }))
    .filter(({ times }) => times !== 1)
    .map(({ id, times }) => `${id} appears ${times} times, not once`);

  expect(
    miscounted,
    `every case must appear in exactly one of ${ACCOUNTING_SECTIONS.join(', ')}`
  ).toEqual([]);
});

// Turns red if a test names a case the report does not automate in that file, or if the report
// names a file that does not carry the case it claims. The accounting test above already refuses
// a report that stays silent about a case; this one refuses a report that agrees with itself and
// disagrees with the tree — which is how a `C-###` left over from a previous run went on
// resolving quietly while naming a case about something else.
test('every case identifier in the suite agrees with the report', () => {
  const problems = traceabilityProblems(
    read('pipeline', '03-report.md'),
    specFiles('tests/contract', 'tests/defects')
  );

  expect(
    problems,
    'the report and the suite disagree about which file automates which case'
  ).toEqual([]);
});

// Turns red if the objections file stops being readable as written — a gap in the numbering, an
// objection with no Concerns, a reference to a rule or case the chain does not hold, or a lost
// Verdict. The verdict matters most: without it the run ends when the reader tires, and an
// impression is not a measurement.
test('pipeline/04-objections.md passes validation', () => {
  const problems = validateObjections(
    read('pipeline', '01-rules.md'),
    read('pipeline', '02-cases.md'),
    read('pipeline', '04-objections.md')
  );

  expect(problems, 'problems found in the objections file').toEqual([]);
});
