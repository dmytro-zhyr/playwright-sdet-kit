/**
 * The handoff format between the agents, expressed as code.
 *
 * Section 6 of the specification asks for a coverage metric — the share of rules that at least
 * one case refers to. That cannot be counted reliably by eye, so the artifacts have to be
 * machine-readable. Parsing them here has a second effect, and it is the more valuable one: the
 * format stops being a convention everybody remembers differently and becomes a contract that
 * fails out loud.
 *
 * Vocabulary: rules are `R-\d{3}`, cases are `C-\d{3}`, and a case declares what it covers.
 *
 * Failing out loud is the whole point, so every shape the parser cannot read is reported rather
 * than skipped: an unknown `## ` section, a heading whose separator is not an em dash, a field
 * name that is nearly right, a field written twice, a `Covers` entry that is not an identifier.
 * A field value, by contrast, is allowed to wrap onto further lines — `CONVENTIONS.md` asks for
 * Markdown wrapped at roughly 100 columns, and a parser that silently kept only the first line
 * would turn that request into data loss.
 *
 * Two kinds of problem exist here and the difference decides which function reports them.
 *
 * - **The text was not read as written** — a heading that vanished, a second `**Kind:**` that was
 *   ignored, a `**Statment:**` nobody will ever read, an `R-1` dropped from a `Covers` list.
 *   Whatever a caller does next, it is working from something other than the file on disk. These
 *   make `parseRules` and `parseCases` throw an {@link ArtifactError}: there is no correct value
 *   for them to return, and returning a plausible one is how a corrupt artifact travels down the
 *   chain unnoticed.
 * - **The text was read exactly as written, and what it says is wrong** — a missing `Statement`,
 *   a `Kind` that is neither explicit nor assumed, a gap in the numbering, a case pointing at a
 *   rule that does not exist. The parse is faithful, so parsing succeeds; `validateRules` and
 *   `validateCases` report these, together with all of the above.
 */

export interface Rule {
  id: string;
  title: string;
  source: string;
  /** 'explicit' when the rule is stated in the spec, 'assumed' when the agent inferred it. */
  kind: string;
  statement: string;
}

export interface Case {
  id: string;
  title: string;
  rules: string[];
}

/**
 * Thrown by `parseRules` and `parseCases` when the artifact cannot be read at face value.
 *
 * It carries the same strings `validateRules` and `validateCases` would return, so a caller that
 * wants the list rather than the throw can catch it — but it has to say so.
 */
export class ArtifactError extends Error {
  readonly problems: readonly string[];

  constructor(artifact: string, problems: readonly string[]) {
    super(`The ${artifact} artifact cannot be read as written:\n- ${problems.join('\n- ')}`);
    this.name = 'ArtifactError';
    this.problems = problems;
  }
}

interface Block {
  id: string;
  title: string;
  lines: string[];
}

interface Scan {
  blocks: Block[];
  problems: string[];
  /** How many `###` headings named an identifier but could not be read as one. */
  malformedHeadings: number;
}

/** Blocks turned into records, plus everything reading them showed was not read as written. */
interface Read<T> {
  items: T[];
  problems: string[];
  malformedHeadings: number;
}

const RULE_HEADING = /^### (R-\d{3}) — (.+)$/;
const CASE_HEADING = /^### (C-\d{3}) — (.+)$/;

/**
 * A `###` heading that names a rule or a case identifier, however badly punctuated. It exists so
 * that a heading the strict expressions above reject can still be recognised well enough to say
 * what is wrong with it, instead of vanishing and leaving "No rules found" behind.
 */
const LOOSE_HEADING = /^### ([RC])-(\d+)[ \t]*([^\w\s]*)[ \t]*(.*)$/u;

const EM_DASH = '—';

/** Any `**Name:**` line, whether or not the name is one this artifact knows. */
const FIELD_LINE = /^\*\*([^*]+):\*\*[ \t]*(.*)$/;
/** The same shape, used to decide where a wrapped value stops. */
const ANY_FIELD = /^\*\*[^*]+:\*\*/;
const ANY_HEADING = /^#{1,6} /;

/** What a `**Covers:**` entry has to look like. */
const RULE_REFERENCE = /^R-\d{3}$/;

const RULE_FIELDS = ['Source', 'Kind', 'Statement'];
const CASE_FIELDS = ['Covers', 'Steps', 'Expected'];

const KNOWN_RULE_SECTIONS = ['## Rules', '## Assumed rules', '## Open questions'];
const KNOWN_CASE_SECTIONS = ['## Cases', '## Not covered', '## Open questions'];

const REQUIRED_RULE_SECTIONS = ['## Assumed rules', '## Open questions'];
const REQUIRED_CASE_SECTIONS = ['## Not covered'];

/**
 * The value of a field line, including any continuation lines.
 *
 * A value runs to the first line that starts a new field, starts a heading, or is blank. The
 * pieces are joined with a single space, which is what hand-wrapping a sentence means.
 */
function continuedValue(lines: string[], index: number, first: string): string {
  const parts = [first.trim()];

  for (let next = index + 1; next < lines.length; next += 1) {
    const continuation = lines[next].trim();
    if (continuation === '') break;
    if (ANY_FIELD.test(continuation)) break;
    if (ANY_HEADING.test(continuation)) break;
    parts.push(continuation);
  }

  return parts
    .filter((part) => part !== '')
    .join(' ')
    .trim();
}

interface Fields {
  values: Map<string, string>;
  problems: string[];
}

/**
 * Every `**Name:**` line in a block, read once and checked on the way.
 *
 * Two shapes used to disappear here. A name that is not one of `known` — `**Statment:**` — used
 * to produce nothing but `missing Statement field`, which sends the reader hunting for a line
 * that is sitting right there, one letter wrong. And a field written twice used to keep the first
 * value and drop the second without a word, so a rule could carry two contradictory `Kind` lines
 * and validate.
 */
function readFields(block: Block, known: string[]): Fields {
  const values = new Map<string, string>();
  const problems: string[] = [];

  for (let index = 0; index < block.lines.length; index += 1) {
    const match = FIELD_LINE.exec(block.lines[index].trim());
    if (!match) continue;

    const name = match[1].trim();

    if (!known.includes(name)) {
      problems.push(
        `${block.id}: unrecognised field "**${name}:**" — the fields here are ${known.join(', ')}`
      );
      continue;
    }

    if (values.has(name)) {
      problems.push(
        `${block.id}: the ${name} field appears twice; a field is written once, and a long value wraps onto further lines`
      );
      continue;
    }

    values.set(name, continuedValue(block.lines, index, match[2]));
  }

  return { values, problems };
}

/**
 * What is wrong with a `###` heading that names an identifier but was not accepted, or `null`
 * when the heading is not about a rule or a case at all.
 */
function headingProblem(line: string, prefix: string): string | null {
  const match = LOOSE_HEADING.exec(line);
  if (!match) return null;

  const [, letter, digits, separator, title] = match;
  if (letter !== prefix) return null;
  const id = `${letter}-${digits}`;

  if (digits.length !== 3) {
    return `${id}: the identifier must be exactly three digits, as in ${letter}-001`;
  }
  if (separator === '') {
    return `${id}: the identifier must be followed by an em dash (${EM_DASH}) and then the title`;
  }
  if (separator !== EM_DASH) {
    return `${id}: the separator between the identifier and the title must be an em dash (${EM_DASH}), not "${separator}"`;
  }
  if (title.trim() === '') {
    return `${id}: the heading carries no title after the em dash (${EM_DASH})`;
  }

  return `${id}: the em dash (${EM_DASH}) between the identifier and the title needs a space on each side`;
}

/**
 * Split an artifact into blocks, collecting everything that makes it unreadable on the way.
 *
 * A `## ` heading ends the block above it — that is how the rule list stops at `## Assumed
 * rules`. Which headings may do that is now a closed set: anything else is reported, so an
 * unexpected subheading can no longer cut a block short without a word.
 */
function scan(markdown: string, heading: RegExp, prefix: string, knownSections: string[]): Scan {
  const blocks: Block[] = [];
  const problems: string[] = [];
  let malformedHeadings = 0;
  let current: Block | null = null;

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();

    const match = heading.exec(line);
    if (match) {
      if (current) blocks.push(current);
      current = { id: match[1], title: match[2].trim(), lines: [] };
      continue;
    }

    if (line.startsWith('### ')) {
      const problem = headingProblem(line, prefix);
      if (problem) {
        if (current) blocks.push(current);
        current = null;
        problems.push(problem);
        malformedHeadings += 1;
        continue;
      }
    }

    if (line.startsWith('## ')) {
      if (!knownSections.includes(line)) {
        problems.push(
          `Unexpected section heading "${line}" — the known sections are ${knownSections.join(', ')}`
        );
      }
      if (current) blocks.push(current);
      current = null;
      continue;
    }

    current?.lines.push(raw);
  }

  if (current) blocks.push(current);
  return { blocks, problems, malformedHeadings };
}

/** Read a rules artifact without deciding what to do about what was noticed. */
function readRules(markdown: string): Read<Rule> {
  const scanned = scan(markdown, RULE_HEADING, 'R', KNOWN_RULE_SECTIONS);
  const items: Rule[] = [];
  const problems = [...scanned.problems];

  for (const block of scanned.blocks) {
    const fields = readFields(block, RULE_FIELDS);
    problems.push(...fields.problems);
    items.push({
      id: block.id,
      title: block.title,
      source: fields.values.get('Source') ?? '',
      kind: fields.values.get('Kind') ?? '',
      statement: fields.values.get('Statement') ?? '',
    });
  }

  return { items, problems, malformedHeadings: scanned.malformedHeadings };
}

/** Read a cases artifact without deciding what to do about what was noticed. */
function readCases(markdown: string): Read<Case> {
  const scanned = scan(markdown, CASE_HEADING, 'C', KNOWN_CASE_SECTIONS);
  const items: Case[] = [];
  const problems = [...scanned.problems];

  for (const block of scanned.blocks) {
    const fields = readFields(block, CASE_FIELDS);
    problems.push(...fields.problems);

    const covers = fields.values.get('Covers') ?? '';
    const rules: string[] = [];

    // An absent Covers field is not a malformed one: `validateCases` reports it as "references no
    // rule at all", and splitting an empty string here would add a second complaint about the
    // same missing line.
    if (covers !== '') {
      for (const entry of covers.split(',')) {
        const token = entry.trim();
        if (RULE_REFERENCE.test(token)) {
          rules.push(token);
        } else if (token === '') {
          problems.push(`${block.id}: Covers has an empty entry — a stray or trailing comma`);
        } else {
          problems.push(
            `${block.id}: "${token}" in Covers is not a rule identifier — the form is R-001`
          );
        }
      }
    }

    items.push({ id: block.id, title: block.title, rules });
  }

  return { items, problems, malformedHeadings: scanned.malformedHeadings };
}

/**
 * The rules, or an {@link ArtifactError} naming everything the file does not say the way it
 * looks like it says it. There is deliberately no way to get the first without the second.
 */
export function parseRules(markdown: string): Rule[] {
  const read = readRules(markdown);
  if (read.problems.length > 0) throw new ArtifactError('rules', read.problems);
  return read.items;
}

/** The cases, on the same terms as {@link parseRules}. */
export function parseCases(markdown: string): Case[] {
  const read = readCases(markdown);
  if (read.problems.length > 0) throw new ArtifactError('cases', read.problems);
  return read.items;
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) repeated.add(id);
    seen.add(id);
  }
  return [...repeated];
}

/**
 * The identifiers must start at 001 and increase by one, which is what `.claude/agents/ba.md`
 * asks for. Only the first break is reported: after a gap every later identifier is off by the
 * same amount, and a hundred and thirty-seven complaints would bury the one that matters.
 */
function sequence(ids: string[], noun: string, prefix: string): string[] {
  for (let index = 0; index < ids.length; index += 1) {
    const expected = `${prefix}-${String(index + 1).padStart(3, '0')}`;
    if (ids[index] !== expected) {
      return [
        `${noun} identifiers must be sequential with no gaps: expected ${expected}, found ${ids[index]}`,
      ];
    }
  }
  return [];
}

export function validateRules(markdown: string): string[] {
  const read = readRules(markdown);
  const rules = read.items;
  const problems: string[] = [...read.problems];

  if (rules.length === 0 && read.malformedHeadings === 0) problems.push('No rules found');

  for (const id of duplicates(rules.map((rule) => rule.id))) {
    problems.push(`Duplicate rule identifier: ${id}`);
  }

  problems.push(
    ...sequence(
      rules.map((rule) => rule.id),
      'Rule',
      'R'
    )
  );

  for (const rule of rules) {
    if (!rule.source) problems.push(`${rule.id}: missing Source field`);
    if (!rule.statement) problems.push(`${rule.id}: missing Statement field`);
    if (rule.kind !== 'explicit' && rule.kind !== 'assumed') {
      problems.push(`${rule.id}: Kind must be "explicit" or "assumed", not "${rule.kind}"`);
    }
  }

  for (const section of REQUIRED_RULE_SECTIONS) {
    if (!markdown.includes(section)) problems.push(`Missing mandatory section: ${section}`);
  }

  return problems;
}

export function validateCases(rulesMd: string, casesMd: string): string[] {
  // Deliberately not `parseRules`: a broken rules file is `validateRules`'s news to break, and
  // throwing here would replace a list of problems in the cases file with an exception about a
  // different file.
  const knownRules = new Set(readRules(rulesMd).items.map((rule) => rule.id));
  const read = readCases(casesMd);
  const cases = read.items;
  const problems: string[] = [...read.problems];

  if (cases.length === 0 && read.malformedHeadings === 0) problems.push('No cases found');

  for (const id of duplicates(cases.map((testCase) => testCase.id))) {
    problems.push(`Duplicate case identifier: ${id}`);
  }

  problems.push(
    ...sequence(
      cases.map((testCase) => testCase.id),
      'Case',
      'C'
    )
  );

  for (const testCase of cases) {
    if (testCase.rules.length === 0) {
      problems.push(`${testCase.id}: references no rule at all`);
    }
    for (const ruleId of testCase.rules) {
      if (!knownRules.has(ruleId)) {
        problems.push(`${testCase.id}: references rule ${ruleId}, which does not exist`);
      }
    }
  }

  for (const section of REQUIRED_CASE_SECTIONS) {
    if (!casesMd.includes(section)) problems.push(`Missing mandatory section: ${section}`);
  }

  return problems;
}

/**
 * The share of rules at least one case refers to.
 *
 * Both numbers count **distinct** identifiers. A rules file that repeats `R-001` describes one
 * rule twice, not two rules, and counting the repetition would quietly move the metric — down
 * through `total` when nothing covers it, and up through `covered` when something does.
 */
export function ruleCoverage(rulesMd: string, casesMd: string): { total: number; covered: number } {
  const ruleIds = new Set(parseRules(rulesMd).map((rule) => rule.id));
  const referenced = new Set(parseCases(casesMd).flatMap((testCase) => testCase.rules));

  return {
    total: ruleIds.size,
    covered: [...ruleIds].filter((id) => referenced.has(id)).length,
  };
}
