import { test, expect } from '@playwright/test';
import {
  ArtifactError,
  parseRules,
  parseCases,
  parseObjections,
  validateRules,
  validateCases,
  validateObjections,
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
  // The park goes with it. Covering R-002 while `## Not covered` still parks it is now a problem
  // of its own — see "a rule cannot be both covered and parked" below — and this test is about
  // the shape of the Covers list, not about that.
  const two = CASES.replace('**Covers:** R-001', '**Covers:** R-001, R-002').replace(
    '- R-002 — needs an existing user, kept separate',
    'none'
  );

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
  // The reference half used to be `**Covers:** R-001, R-001` in one list. That shape is now
  // refused outright when the file is read — see "validateCases reports a rule named twice in one
  // Covers list" — so the repetition the metric can still meet is two cases covering one rule,
  // which is grouping and must not move the number either.
  const twoCases = CASES.replace(
    '## Not covered',
    `### C-002 — Register another user
**Covers:** R-001
**Steps:** POST /users with another new email
**Expected:** 201, user.token

## Not covered`
  );

  expect(ruleCoverage(repeatedRule, CASES)).toEqual({ total: 2, covered: 1 });
  expect(ruleCoverage(RULES, twoCases)).toEqual({ total: 2, covered: 1 });
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

// Turns red if a case can lose its Steps or its Expected without a word — the TA agent would be
// handed a case that names a rule and says nothing about what to do or what should come back.
test('validateCases reports a missing Steps and a missing Expected by name', () => {
  const bare = CASES.replace('**Steps:** POST /users\n**Expected:** 201, user.token\n', '');

  expect(validateCases(RULES, bare)).toEqual([
    'C-001: missing Steps field',
    'C-001: missing Expected field',
  ]);
  expect(validateCases(RULES, CASES.replace('**Steps:** POST /users\n', '')).join(' ')).toContain(
    'C-001: missing Steps field'
  );
  expect(
    validateCases(RULES, CASES.replace('**Expected:** 201, user.token\n', '')).join(' ')
  ).toContain('C-001: missing Expected field');
});

// Turns red if a case that carries both fields starts being reported as missing them — every
// honest cases artifact in the chain would fail, and the validator would stop being read.
test('a case that states its steps and its expectation is not complained about', () => {
  expect(validateCases(RULES, CASES)).toEqual([]);
  expect(parseCases(CASES)[0].steps).toBe('POST /users');
  expect(parseCases(CASES)[0].expected).toBe('201, user.token');
});

// Turns red if an absent Covers line starts being reported twice — one missing line would produce
// both "missing Covers field" and "references no rule at all", and the reader would hunt for two
// mistakes where there is one. The second message is kept because it says more: it also covers a
// Covers line that is present and empty, and one whose every entry was malformed.
test('an absent Covers field is reported once, by the message that says the most', () => {
  const noCovers = CASES.replace('**Covers:** R-001\n', '');

  // Filtered to what is said about C-001. A case that covers nothing also leaves R-001 accounted
  // for by no case and by no park, and that second message is about the rule, not about this line.
  const aboutTheCase = (problems: string[]): string[] =>
    problems.filter((problem) => problem.startsWith('C-001'));

  expect(aboutTheCase(validateCases(RULES, noCovers))).toEqual([
    'C-001: references no rule at all',
  ]);
  expect(
    aboutTheCase(validateCases(RULES, CASES.replace('**Covers:** R-001', '**Covers:**')))
  ).toEqual(['C-001: references no rule at all']);
});

// ---------------------------------------------------------------------------------------------
// The rules-to-cases link. A reference that resolves is not the same as a case that is current.
// ---------------------------------------------------------------------------------------------

/** The same rules with one more rule in them, which is what a regeneration looks like from here. */
const THREE_RULES = RULES.replace(
  '## Assumed rules',
  `### R-003 — Registration with a taken username
**Source:** spec §Registration
**Kind:** explicit
**Statement:** POST /users with an existing username returns 422 and errors.username

## Assumed rules`
);

// Turns red if the rules can be regenerated without the cases and nothing says so. Every
// reference the old cases carry still resolves, which is the shape the 25 August drift had: a
// clean validation and a coverage figure computed over two documents describing different work.
test('validateCases reports a rule no case covers and no park accounts for', () => {
  expect(validateCases(RULES, CASES)).toEqual([]);

  const problems = validateCases(THREE_RULES, CASES).join(' ');

  expect(problems).toContain('R-003 is covered by no case and not parked under "## Not covered"');
  expect(problems).toContain('regenerated');
});

// Turns red if the accounting hardens into "exactly one case per rule" — seven rules in the real
// 02-cases.md are exercised by two cases each from different directions, and deciding that is
// what the QA agent is for.
test('a rule two cases cover is not drift', () => {
  const twoCases = CASES.replace(
    '## Not covered',
    `### C-002 — Register a second user
**Covers:** R-001
**Steps:** POST /users with another new email
**Expected:** 201, user.token

## Not covered`
  );

  expect(validateCases(RULES, twoCases)).toEqual([]);
});

// Turns red if a rule can be covered and parked at once — the file would say both that R-001 is
// tested and that it deliberately is not, and both statements would go down the chain.
test('a rule cannot be both covered and parked', () => {
  const both = CASES.replace(
    '- R-002 — needs an existing user',
    '- R-001 — needs an existing user'
  );

  expect(validateCases(RULES, both).join(' ')).toContain(
    'R-001 is both covered by a case and parked under "## Not covered"'
  );
});

// Turns red if `## Not covered` goes back to being checked for existence and never for contents —
// a park left behind by a regeneration accounts for a rule that no longer exists, while the rule
// that took its number is covered by nobody.
test('a park naming a rule the rules file does not define is reported', () => {
  expect(validateCases(RULES, CASES.replace('- R-002 —', '- R-999 —')).join(' ')).toContain(
    '"## Not covered" parks R-999, which the rules file does not define'
  );
});

// ---------------------------------------------------------------------------------------------
// Headings, fences and prose: the content that used to disappear into the block above it.
// ---------------------------------------------------------------------------------------------

// Turns red if a heading carrying the other artifact's letter is swallowed again — the heading and
// everything under it used to be appended to the block above, and the reader was told either
// nothing at all or that a rule containing one **Source:** line carries two.
test('a ### heading with the other letter is reported, in both artifacts', () => {
  const caseInTheRules = RULES.replace(
    '### R-002 — Registration with a taken email',
    '### C-009 — Register a new user'
  );
  const problems = validateRules(caseInTheRules).join(' ');

  expect(problems).toContain('Unexpected heading "### C-009 — Register a new user"');
  expect(problems).not.toContain('appears twice');

  expect(validateCases(RULES, CASES.replace('### C-001 —', '### R-009 —')).join(' ')).toContain(
    'Unexpected heading "### R-009'
  );
});

// Turns red if any other ### heading goes back to being absorbed together with its prose — a file
// that visibly carries a heading the format has no place for used to validate clean.
test('a ### heading that names no identifier is reported', () => {
  const withNotes = RULES.replace(
    '### R-002',
    `### Notes on the above

Some prose.

### R-002`
  );

  expect(validateRules(withNotes).join(' ')).toContain(
    'Unexpected heading "### Notes on the above"'
  );
});

// Turns red if a heading written without the space after its hashes is absorbed again — `###R-002`
// used to leave the reader with three complaints about a rule repeating fields it states once.
test('a ### heading written without its space is reported', () => {
  expect(validateRules(RULES.replace('### R-002', '###R-002')).join(' ')).toContain(
    'Unexpected heading "###R-002'
  );
});

// Turns red if a heading nested inside a block goes back to being invisible — and equally if it
// starts taking the fields under it out of the block it was written in, which would report a rule
// as missing the Statement sitting right there.
test('a #### heading inside a block is reported and leaves the block intact', () => {
  const deeper = RULES.replace(
    '**Kind:** explicit',
    `#### Worth noting

**Kind:** explicit`
  );
  const problems = validateRules(deeper).join(' ');

  expect(problems).toContain('Unexpected heading "#### Worth noting"');
  expect(problems).not.toContain('missing Statement');
});

// Turns red if free prose inside a block goes back to being walked past — that paragraph is the
// real content of the rule, and no caller of parseRules ever receives it.
test('a line inside a block that no field and no bullet accounts for is reported', () => {
  const withProse = RULES.replace(
    '**Statement:** POST /users with a new email',
    `
The real content of this rule is this paragraph.

**Statement:** POST /users with a new email`
  );

  expect(validateRules(withProse).join(' ')).toContain(
    'is neither a field, a bullet nor the continuation of either'
  );
});

// Turns red if the bulleted notes a case is required to carry start being reported as content
// nothing reads. `**Grouping rationale:**` and `**Preconditions:**` are bullets precisely because
// a case may carry only three field names, and every case in 02-cases.md has both, wrapped onto
// indented lines.
test('bulleted notes and their wrapped lines are accepted inside a case', () => {
  const withNotes = CASES.replace(
    '**Steps:** POST /users',
    `
- **Grouping rationale:** one path, and this sentence is long enough that it wraps onto
  an indented line below it.
- **Preconditions:** none.

**Steps:** POST /users`
  );

  expect(validateCases(RULES, withNotes)).toEqual([]);
});

// Turns red if a fenced example goes back to being read as part of the contract — the fence used
// to produce a third rule that the author wrote down as an illustration for the reader.
test('a fenced code block is reported and its contents are not read as rules', () => {
  const fenced = RULES.replace(
    '## Assumed rules',
    `\`\`\`markdown
### R-003 — An example for the reader
**Source:** none
**Kind:** explicit
**Statement:** an illustration
\`\`\`

## Assumed rules`
  );
  const problems = validateRules(fenced).join(' ');

  expect(problems).toContain('a fenced code block');
  expect(problems).not.toContain('R-003');
  expect(() => parseRules(fenced)).toThrow(ArtifactError);
  expect(validateRules(RULES)).toEqual([]);
});

// Turns red if the mandatory-section check goes back to `markdown.includes` — a sentence about the
// section satisfied it, and so did the heading inside a code fence, which is exactly the file the
// check exists to catch.
test('a section named in prose does not satisfy the mandatory-section check', () => {
  const mentioned = RULES.replace(
    `## Open questions

none`,
    'The template also asks for a ## Open questions section, and this file does not carry one.'
  );

  expect(validateRules(mentioned).join(' ')).toContain(
    'Missing mandatory section: ## Open questions'
  );
  expect(validateRules(RULES)).toEqual([]);
});

// Turns red if one Covers list can name a rule twice — the case claims two references where the
// file names one rule, and `ruleCoverage` hides it by counting a Set, so the metric never moves.
// The green direction is the well-formed list two tests above.
test('validateCases reports a rule named twice in one Covers list', () => {
  expect(
    validateCases(RULES, CASES.replace('**Covers:** R-001', '**Covers:** R-001, R-001')).join(' ')
  ).toContain('C-001: Covers names R-001 twice');
});

// Turns red if a value written below a blank line goes back to being reported as a missing field —
// the reader was sent looking for steps that were sitting two lines under the complaint.
test('a field whose value starts after a blank line is named for what it is', () => {
  const below = CASES.replace(
    '**Steps:** POST /users',
    `**Steps:**

- POST /users with a new email
- read the token from the response`
  );
  const problems = validateCases(RULES, below).join(' ');

  expect(problems).toContain('C-001: the Steps field takes no value on its own line');
  expect(problems).not.toContain('missing Steps field');
});

// Turns red if that sharper message starts firing on the shape every real case uses — a value
// beside the field name, and bulleted notes further down the same block.
test('a field with its value beside the name is not reported', () => {
  expect(validateCases(RULES, CASES)).toEqual([]);
  expect(parseCases(CASES)[0].steps).toBe('POST /users');
});

// ---------------------------------------------------------------------------------------------
// Objections: the third artifact, written by a reviewing agent rather than the BA or the QA.
// ---------------------------------------------------------------------------------------------

const OBJECTIONS = `# Objections

## Objections

### O-001 — The chain never settles a success status
**Artifact:** pipeline/01-rules.md
**Concerns:** R-001, R-002
**Question:** R-001 fixes 201 for a registration; does every other rule agree?
**Risk if ignored:** a contract test takes its expectation from an implementation
**Possible alternative:** state the status per endpoint

## Verdict

Objections remain.
`;

// Turns red if the objection heading or the field syntax stops being recognised — the file would
// then read as empty and every count taken from it would be zero for a file full of objections.
test('parseObjections reads the artifact, the references and the question', () => {
  const objections = parseObjections(OBJECTIONS);

  expect(objections).toHaveLength(1);
  expect(objections[0].id).toBe('O-001');
  expect(objections[0].artifact).toBe('pipeline/01-rules.md');
  expect(objections[0].concerns).toEqual(['R-001', 'R-002']);
  expect(objections[0].risk).toContain('implementation');
});

// Turns red if a malformed objection heading starts being reported in the vocabulary of another
// artifact. `scan` used to derive its noun from a two-way ternary, so an objections file was
// told what a cases file carries — a message that sends the reader to the wrong document.
test('a malformed objection heading is reported as an objection, not as a case', () => {
  const problems = validateObjections(RULES, CASES, OBJECTIONS.replace('### O-001 —', '### O-1 —'));

  expect(problems).toContain('O-1: the identifier must be exactly three digits, as in O-001');
});

// Turns red if an objection stops having to name an artifact this chain actually produces. A free
// path would let a critic object about a file nobody in the chain writes, and the objection would
// be unactionable while looking well formed.
test('validateObjections refuses an artifact outside the closed set', () => {
  const problems = validateObjections(
    RULES,
    CASES,
    OBJECTIONS.replace('**Artifact:** pipeline/01-rules.md', '**Artifact:** pipeline/99-notes.md')
  );

  expect(problems.join(' ')).toContain('is not an artifact of this chain');
});

// Turns red if a reference in Concerns stops being resolved against the real rules and cases.
// A reference that only has to look like an identifier is the exact weak link BASELINE.md named:
// it resolves, so nothing goes red, and it points at whatever now holds that number.
test('validateObjections refuses a reference no rule or case holds', () => {
  const problems = validateObjections(RULES, CASES, OBJECTIONS.replace('R-002', 'R-777'));

  expect(problems).toContain(
    'O-001: Concerns names R-777, which no rule or case in the chain holds'
  );
});

// Turns red if the file stops having to carry a verdict. The critic's stopping condition is the
// difference between a measurement and an impression: without a place to write "no further
// objections", the run ends when whoever is reading gets tired.
test('validateObjections requires the Verdict section', () => {
  const problems = validateObjections(RULES, CASES, OBJECTIONS.replace('## Verdict', '## Summary'));

  expect(problems).toContain('Missing mandatory section: ## Verdict');
});
