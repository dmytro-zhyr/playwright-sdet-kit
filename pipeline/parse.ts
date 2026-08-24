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
 * than skipped: an unknown `## ` section, a heading whose separator is not an em dash, an
 * identifier that breaks the sequence. A field value, by contrast, is allowed to wrap onto
 * further lines — `CONVENTIONS.md` asks for Markdown wrapped at roughly 100 columns, and a
 * parser that silently kept only the first line would turn that request into data loss.
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

const RULE_HEADING = /^### (R-\d{3}) — (.+)$/;
const CASE_HEADING = /^### (C-\d{3}) — (.+)$/;

/**
 * A `###` heading that names a rule or a case identifier, however badly punctuated. It exists so
 * that a heading the strict expressions above reject can still be recognised well enough to say
 * what is wrong with it, instead of vanishing and leaving "No rules found" behind.
 */
const LOOSE_HEADING = /^### ([RC])-(\d+)[ \t]*([^\w\s]*)[ \t]*(.*)$/u;

const EM_DASH = '—';

const FIELD = (name: string): RegExp => new RegExp(`^\\*\\*${name}:\\*\\*\\s*(.+)$`);
/** Any `**Name:**` field, used to decide where a wrapped value stops. */
const ANY_FIELD = /^\*\*[^*]+:\*\*/;
const ANY_HEADING = /^#{1,6} /;

const KNOWN_RULE_SECTIONS = ['## Rules', '## Assumed rules', '## Open questions'];
const KNOWN_CASE_SECTIONS = ['## Cases', '## Not covered', '## Open questions'];

const REQUIRED_RULE_SECTIONS = ['## Assumed rules', '## Open questions'];
const REQUIRED_CASE_SECTIONS = ['## Not covered'];

/**
 * The value of `**Name:**`, including any continuation lines.
 *
 * A value runs to the first line that starts a new field, starts a heading, or is blank. The
 * pieces are joined with a single space, which is what hand-wrapping a sentence means.
 */
function fieldValue(lines: string[], name: string): string {
  const pattern = FIELD(name);

  for (let index = 0; index < lines.length; index += 1) {
    const match = pattern.exec(lines[index].trim());
    if (!match) continue;

    const parts = [match[1].trim()];
    for (let next = index + 1; next < lines.length; next += 1) {
      const continuation = lines[next].trim();
      if (continuation === '') break;
      if (ANY_FIELD.test(continuation)) break;
      if (ANY_HEADING.test(continuation)) break;
      parts.push(continuation);
    }

    return parts.join(' ').trim();
  }

  return '';
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

function toRules(blocks: Block[]): Rule[] {
  return blocks.map((block) => ({
    id: block.id,
    title: block.title,
    source: fieldValue(block.lines, 'Source'),
    kind: fieldValue(block.lines, 'Kind'),
    statement: fieldValue(block.lines, 'Statement'),
  }));
}

function toCases(blocks: Block[]): Case[] {
  return blocks.map((block) => ({
    id: block.id,
    title: block.title,
    rules: fieldValue(block.lines, 'Covers')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => /^R-\d{3}$/.test(value)),
  }));
}

export function parseRules(markdown: string): Rule[] {
  return toRules(scan(markdown, RULE_HEADING, 'R', KNOWN_RULE_SECTIONS).blocks);
}

export function parseCases(markdown: string): Case[] {
  return toCases(scan(markdown, CASE_HEADING, 'C', KNOWN_CASE_SECTIONS).blocks);
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
  const scanned = scan(markdown, RULE_HEADING, 'R', KNOWN_RULE_SECTIONS);
  const rules = toRules(scanned.blocks);
  const problems: string[] = [...scanned.problems];

  if (rules.length === 0 && scanned.malformedHeadings === 0) problems.push('No rules found');

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
  const knownRules = new Set(parseRules(rulesMd).map((rule) => rule.id));
  const scanned = scan(casesMd, CASE_HEADING, 'C', KNOWN_CASE_SECTIONS);
  const cases = toCases(scanned.blocks);
  const problems: string[] = [...scanned.problems];

  if (cases.length === 0 && scanned.malformedHeadings === 0) problems.push('No cases found');

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

export function ruleCoverage(rulesMd: string, casesMd: string): { total: number; covered: number } {
  const rules = parseRules(rulesMd);
  const referenced = new Set(parseCases(casesMd).flatMap((testCase) => testCase.rules));

  return {
    total: rules.length,
    covered: rules.filter((rule) => referenced.has(rule.id)).length,
  };
}
