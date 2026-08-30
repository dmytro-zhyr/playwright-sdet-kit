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
import { AGENT_ORIGINS, agentDirectoryProblems, type AgentFile } from '@/pipeline/agentDefinition';
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

const LF = String.fromCharCode(10);

/** The smallest thing that is recognisably a definition — enough to be found undeclared. */
const NEWCOMER = ['---', 'name: newcomer', '---', ''].join(LF);

/** Every agent definition in the repository, addressed by base name. */
function agentFiles(): AgentFile[] {
  const directory = join(ROOT, '.claude', 'agents');

  return readdirSync(directory)
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ name, markdown: read('.claude', 'agents', name) }));
}

// Turns red if any agent definition drifts out of shape — frontmatter that does not open or
// close, a missing name or description, a name that no longer matches its file, a lost
// `## Your task` or `## Forbidden` section in one this project wrote, or a carriage return
// sneaking back in. Without it an agent simply starts behaving differently and the cause is
// hunted for in its output rather than in its frontmatter.
//
// 🔑 It reads the **directory**, and that is the fix. Until 30 August 2026 this was four tests
// naming four files, so the three definitions `npx playwright init-agents` installed that day
// were never checked, and neither would a fifth written here tomorrow. A check anchored to a
// list of answers cannot notice an answer nobody added to the list — the same failure this
// project has now found in a README rule and in its own reminders file.
test('.claude/agents holds nothing undeclared and nothing out of shape', () => {
  const files = agentFiles();

  expect(files.length, 'the agents directory must not be empty').toBeGreaterThan(0);
  expect(agentDirectoryProblems(files), 'problems found in the agent definitions').toEqual([]);
});

// Turns red if a definition is added and left undeclared — the case the directory check exists
// for, exercised here rather than waited for. The message must name the file and offer both
// standards, because an error that only says "undeclared" leaves the reader to guess which of
// the two a new agent is.
test('an undeclared definition fails rather than being skipped', () => {
  const undeclared = [{ name: 'newcomer.md', markdown: NEWCOMER }];

  const problems = agentDirectoryProblems(undeclared).join(LF);

  expect(problems).toContain('newcomer.md');
  expect(problems).toContain('not declared in AGENT_ORIGINS');
});

// Turns red if a declared definition goes missing without its declaration going with it. An
// agent deleted while something still expects it is the mirror of the case above, and the one
// the directory listing alone cannot see.
test('a declared definition that is gone is reported', () => {
  const problems = agentDirectoryProblems([]).join(LF);

  expect(problems).toContain('declared in AGENT_ORIGINS but not present');
  expect(
    Object.keys(AGENT_ORIGINS).filter((name) => !problems.includes(name)),
    'every declared name must be reported as missing when the directory is empty'
  ).toEqual([]);
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
// names a file that does not carry the case it claims — and red, too, if both directories exist
// and hold no spec file at all. Without that floor an empty tree produces an empty problem list
// and the whole check passes about nothing, which is the one shape of "cannot go red" the
// module's own doc comment warns against. The accounting test above already refuses a report that
// stays silent about a case; this one refuses a report that agrees with itself and disagrees with
// the tree — which is how a `C-###` left over from a previous run went on resolving quietly while
// naming a case about something else.
test('every case identifier in the suite agrees with the report', () => {
  const files = specFiles('tests/contract', 'tests/defects');

  expect(
    files.length,
    'tests/contract and tests/defects must hold spec files for this check to be about anything'
  ).toBeGreaterThan(0);

  const problems = traceabilityProblems(read('pipeline', '03-report.md'), files);

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
