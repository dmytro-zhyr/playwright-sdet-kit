import { test, expect } from '@playwright/test';
import {
  parseRules,
  parseCases,
  validateRules,
  validateCases,
  ruleCoverage,
} from '@/pipeline/parse';

const RULES = `# Rules

### R-001 — Registration with an unused email
**Source:** spec §Registration
**Kind:** explicit
**Statement:** POST /users with a new email returns 201 and user.token

### R-002 — Registration with a taken email
**Source:** spec §Registration
**Kind:** explicit
**Statement:** POST /users with an existing email returns 422 and errors.email

## Assumed rules

none

## Open questions

none
`;

const CASES = `# Cases

### C-001 — Register a new user
**Covers:** R-001
**Steps:** POST /users
**Expected:** 201, user.token

## Not covered

- R-002 — needs an existing user, kept separate
`;

// Turns red if the rule heading or the field syntax stops being recognised — the parser would
// then report an empty rule set and every downstream check would pass on nothing.
test('parseRules reads the identifier, the kind and the statement', () => {
  const rules = parseRules(RULES);

  expect(rules).toHaveLength(2);
  expect(rules[0].id).toBe('R-001');
  expect(rules[0].kind).toBe('explicit');
  expect(rules[0].statement).toContain('user.token');
});

// Turns red if the Covers field stops being split into rule identifiers — coverage would then be
// computed from an empty reference set and read as zero for a fully covered artifact.
test('parseCases reads the rule references', () => {
  const cases = parseCases(CASES);

  expect(cases).toHaveLength(1);
  expect(cases[0].id).toBe('C-001');
  expect(cases[0].rules).toEqual(['R-001']);
});

// Turns red if two rules can share an identifier — a case referencing R-001 would then be
// ambiguous about which rule it actually covers.
test('validateRules catches a duplicate identifier', () => {
  const problems = validateRules(RULES + RULES);

  expect(problems.join(' ')).toContain('R-001');
});

// Turns red if a rules artifact can drop "## Open questions" — the BA would silently lose the
// place where unresolved ambiguity is recorded.
test('validateRules requires both mandatory sections', () => {
  const withoutSections = RULES.replace('## Open questions', '## Something else');
  const problems = validateRules(withoutSections);

  expect(problems.join(' ')).toContain('Open questions');
});

// Turns red if a case can reference a rule that does not exist — a typo in Covers would look
// like coverage while covering nothing.
test('validateCases catches a reference to a rule that does not exist', () => {
  const broken = CASES.replace('R-001', 'R-999');
  const problems = validateCases(RULES, broken);

  expect(problems.join(' ')).toContain('R-999');
});

// Turns red if the coverage metric stops counting distinct referenced rules — the number the
// specification asks for would then be wrong in either direction.
test('ruleCoverage counts the covered rules', () => {
  expect(ruleCoverage(RULES, CASES)).toEqual({ total: 2, covered: 1 });
});
