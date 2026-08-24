import { test, expect } from '@playwright/test';
import {
  ArtifactError,
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

// ---------------------------------------------------------------------------------------------
// The artifact shapes the validator used to accept in silence.
// ---------------------------------------------------------------------------------------------

// The same artifact as RULES, with the `## Rules` heading the real pipeline/01-rules.md carries.
const SECTIONED = `# Rules

## Rules

### R-001 — Registration with an unused email
**Source:** spec §Registration
**Kind:** explicit
**Statement:** POST /users with a new email returns 201 and user.token

## Assumed rules

none

## Open questions

none
`;

// One rule whose Source and Statement are hand-wrapped, which is what CONVENTIONS.md asks of
// every Markdown line in this repository.
const WRAPPED = `# Rules

### R-001 — Registration with an unused email
**Source:** spec §Registration — the paragraph beginning "Registration takes an email, a
username and a password"
**Kind:** explicit
**Statement:** POST /users with a new email returns 201, a user envelope, and a user.token that
the API afterwards accepts as a credential

## Assumed rules

none

## Open questions

none
`;

// Turns red if a section heading the format actually uses starts being reported as unknown — the
// real artifact carries `## Rules`, and a validator that rejected it would fail the whole chain.
test('validateRules accepts the known section headings', () => {
  expect(validateRules(SECTIONED)).toEqual([]);
});

// Turns red if an unexpected `## ` heading between two rules goes back to closing the rule list
// without a word — the artifact would lose everything the heading swallowed and still pass.
test('validateRules reports an unexpected section heading', () => {
  const withSubheading = RULES.replace('### R-002', '## Notes\n\n### R-002');
  const problems = validateRules(withSubheading);

  expect(problems.join(' ')).toContain('Unexpected section heading "## Notes"');
});

// Turns red if a wrapped field value is truncated at its first line again — a rule would keep its
// identifier and lose the half of its statement that says what the API must actually do.
test('parseRules keeps a field value that wraps onto a second line', () => {
  const rules = parseRules(WRAPPED);

  expect(rules).toHaveLength(1);
  expect(rules[0].statement).toBe(
    'POST /users with a new email returns 201, a user envelope, and a user.token that the API ' +
      'afterwards accepts as a credential'
  );
  expect(rules[0].source).toContain('username and a password');
  expect(validateRules(WRAPPED)).toEqual([]);
});

// Turns red if a continuation line starts running past the end of its own field — a Statement
// would absorb the blank line and the next heading and no missing field would ever be reported.
test('a wrapped field value stops at the next field, heading or blank line', () => {
  const withoutStatement = WRAPPED.replace(
    /\*\*Statement:\*\*[\s\S]*?accepts as a credential\n/,
    ''
  );
  const rules = parseRules(withoutStatement);

  expect(rules[0].kind).toBe('explicit');
  expect(validateRules(withoutStatement).join(' ')).toContain('R-001: missing Statement field');
});

// Turns red if identifiers stop being checked for order — a rule numbered R-004 after R-002 would
// leave R-003 undefined, and every case that referenced it would read as covering nothing.
test('validateRules accepts identifiers that run 001, 002 with no gap', () => {
  expect(validateRules(RULES)).toEqual([]);
});

// Turns red if a gap in the rule numbering passes — the QA agent would silently work from a set
// that is smaller than the one the BA agent believes it wrote.
test('validateRules reports the first gap in the identifier sequence', () => {
  const withGap = validateRules(RULES.replace('### R-002', '### R-003'));

  expect(withGap.join(' ')).toContain(
    'Rule identifiers must be sequential with no gaps: expected R-002, found R-003'
  );
});

// Turns red if the case identifiers stop being checked for order — the same gap, one artifact
// further down the chain, where it decides which tests get written.
test('validateCases reports a gap in the case identifier sequence', () => {
  expect(validateCases(RULES, CASES)).toEqual([]);
  expect(validateCases(RULES, CASES.replace('### C-001', '### C-002')).join(' ')).toContain(
    'Case identifiers must be sequential with no gaps: expected C-001, found C-002'
  );
});

// Turns red if the em dash stops being the accepted separator — every existing artifact uses it,
// so the parser rejecting it would report an empty rule set for a file that is entirely correct.
test('a heading separated by an em dash is accepted', () => {
  expect(parseRules(RULES).map((rule) => rule.id)).toEqual(['R-001', 'R-002']);
});

// Turns red if a hyphen in place of the em dash goes back to producing "No rules found" — that
// message sends the reader to look for missing rules instead of at one character of punctuation.
test('a heading separated by a hyphen is reported as a punctuation problem', () => {
  const hyphenated = RULES.replace('### R-001 —', '### R-001 -').replace(
    '### R-002 —',
    '### R-002 -'
  );
  const problems = validateRules(hyphenated);

  expect(problems.join(' ')).toContain(
    'R-001: the separator between the identifier and the title must be an em dash (—), not "-"'
  );
  expect(problems.join(' ')).not.toContain('No rules found');

  const hyphenatedCase = CASES.replace('### C-001 —', '### C-001 -');
  expect(validateCases(RULES, hyphenatedCase).join(' ')).toContain(
    'C-001: the separator between the identifier and the title must be an em dash (—), not "-"'
  );
});

// ---------------------------------------------------------------------------------------------
// The remaining silent failures: the file says one thing, the parser read another, nobody heard.
// ---------------------------------------------------------------------------------------------

// Turns red if a Covers entry that is not a rule identifier goes back to being filtered out
// before anyone sees it — `R-1` would vanish, the case would cover one rule fewer than it says,
// and the artifact would validate clean.
test('validateCases reports every malformed entry in Covers', () => {
  const broken = CASES.replace('**Covers:** R-001', '**Covers:** R-001, R-1, R -002, RR-002');
  const problems = validateCases(RULES, broken).join(' ');

  expect(problems).toContain('C-001: "R-1" in Covers is not a rule identifier — the form is R-001');
  expect(problems).toContain('C-001: "R -002" in Covers is not a rule identifier');
  expect(problems).toContain('C-001: "RR-002" in Covers is not a rule identifier');

  const trailingComma = CASES.replace('**Covers:** R-001', '**Covers:** R-001,');
  expect(validateCases(RULES, trailingComma).join(' ')).toContain(
    'C-001: Covers has an empty entry — a stray or trailing comma'
  );
});

// Turns red if a well-formed Covers list starts being reported as malformed — the validator would
// complain about every honest artifact in the chain and stop being read at all.
test('a Covers list of well-formed identifiers is read and not complained about', () => {
  const two = CASES.replace('**Covers:** R-001', '**Covers:** R-001, R-002');

  expect(validateCases(RULES, two)).toEqual([]);
  expect(parseCases(two)[0].rules).toEqual(['R-001', 'R-002']);
});

// Turns red if a field written twice goes back to being read once and never mentioned — a rule
// could carry **Kind:** explicit and **Kind:** assumed at the same time and validate clean.
test('validateRules reports a field that appears twice in one rule', () => {
  const twice = RULES.replace(
    '**Kind:** explicit\n**Statement:** POST /users with a new email',
    '**Kind:** explicit\n**Kind:** assumed\n**Statement:** POST /users with a new email'
  );

  expect(validateRules(twice).join(' ')).toContain('R-001: the Kind field appears twice');
});

// Turns red if the duplication check stops being per-rule — every artifact after the first rule
// would be reported as repeating Source, Kind and Statement, which every artifact does.
test('the same field in two different rules is not a duplication', () => {
  const mixed = RULES.replace(
    '**Kind:** explicit\n**Statement:** POST /users with an existing email',
    '**Kind:** assumed\n**Statement:** POST /users with an existing email'
  );

  expect(validateRules(mixed)).toEqual([]);
  expect(parseRules(mixed).map((rule) => rule.kind)).toEqual(['explicit', 'assumed']);
});

// Turns red if a near-miss field name goes back to producing nothing but "missing Statement
// field" — the reader is sent looking for a line that is sitting there, one letter wrong.
test('validateRules names an unrecognised field instead of only reporting the missing one', () => {
  const typo = RULES.replace(
    '**Statement:** POST /users with a new email',
    '**Statment:** POST /users with a new email'
  );
  const problems = validateRules(typo).join(' ');

  expect(problems).toContain(
    'R-001: unrecognised field "**Statment:**" — the fields here are Source, Kind, Statement'
  );
  expect(problems).toContain('R-001: missing Statement field');
});

// Turns red if the same near-miss stops being caught one artifact further down the chain, where
// a mistyped **Steps:** would leave a case with no steps and no complaint.
test('validateCases names an unrecognised field in a case', () => {
  const typo = CASES.replace('**Steps:**', '**Step:**');

  expect(validateCases(RULES, typo).join(' ')).toContain(
    'C-001: unrecognised field "**Step:**" — the fields here are Covers, Steps, Expected'
  );
});

// Turns red if a field name the format actually uses starts being reported as unrecognised — the
// real artifact carries all three, and the whole chain would fail on a correct file.
test('the recognised field names are accepted on both sides of the chain', () => {
  expect(validateRules(RULES)).toEqual([]);
  expect(validateCases(RULES, CASES)).toEqual([]);
});

// Turns red if coverage goes back to counting repetitions — a rules file that states R-001 twice
// would report three rules where there are two, and the metric section 6 asks for would be wrong.
test('ruleCoverage counts distinct identifiers, not repetitions', () => {
  const repeatedRule = RULES.replace(
    '## Assumed rules',
    '### R-001 — Registration with an unused email\n' +
      '**Source:** spec §Registration\n' +
      '**Kind:** explicit\n' +
      '**Statement:** POST /users with a new email returns 201 and user.token\n\n' +
      '## Assumed rules'
  );
  const repeatedReference = CASES.replace('**Covers:** R-001', '**Covers:** R-001, R-001');

  expect(ruleCoverage(repeatedRule, CASES)).toEqual({ total: 2, covered: 1 });
  expect(ruleCoverage(RULES, repeatedReference)).toEqual({ total: 2, covered: 1 });
});

// Turns red if an artifact the parser could not read at face value can still be parsed into a
// value — a caller that never calls validate* would consume the corruption and never learn.
test('parseRules refuses to return a reading it knows is not what the file says', () => {
  const hyphenated = RULES.replace('### R-001 —', '### R-001 -');
  let caught: unknown;

  try {
    parseRules(hyphenated);
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(ArtifactError);
  expect((caught as ArtifactError).problems.join(' ')).toContain('must be an em dash');
  expect(() => parseCases(CASES.replace('**Covers:** R-001', '**Covers:** R-1'))).toThrow(
    ArtifactError
  );
});

// Turns red if the refusal above widens from "I could not read this" to "this is invalid" —
// validateRules would then be the only way to learn that a Statement is missing, and asking for
// it would throw instead of answering.
test('parseRules still returns for an artifact it read exactly as written', () => {
  const withoutStatement = RULES.replace(
    '**Statement:** POST /users with a new email returns 201 and user.token\n',
    ''
  );

  expect(parseRules(withoutStatement)[0].statement).toBe('');
  expect(validateRules(withoutStatement).join(' ')).toContain('R-001: missing Statement field');
});
