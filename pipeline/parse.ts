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

const RULE_HEADING = /^### (R-\d{3}) — (.+)$/;
const CASE_HEADING = /^### (C-\d{3}) — (.+)$/;
const FIELD = (name: string): RegExp => new RegExp(`^\\*\\*${name}:\\*\\*\\s*(.+)$`);

const REQUIRED_RULE_SECTIONS = ['## Assumed rules', '## Open questions'];
const REQUIRED_CASE_SECTIONS = ['## Not covered'];

function fieldValue(lines: string[], name: string): string {
  for (const line of lines) {
    const match = FIELD(name).exec(line.trim());
    if (match) return match[1].trim();
  }
  return '';
}

function blocks(
  markdown: string,
  heading: RegExp
): { id: string; title: string; lines: string[] }[] {
  const result: { id: string; title: string; lines: string[] }[] = [];
  let current: { id: string; title: string; lines: string[] } | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const match = heading.exec(line.trim());
    if (match) {
      if (current) result.push(current);
      current = { id: match[1], title: match[2].trim(), lines: [] };
      continue;
    }
    if (line.startsWith('## ')) {
      if (current) result.push(current);
      current = null;
      continue;
    }
    current?.lines.push(line);
  }
  if (current) result.push(current);
  return result;
}

export function parseRules(markdown: string): Rule[] {
  return blocks(markdown, RULE_HEADING).map((block) => ({
    id: block.id,
    title: block.title,
    source: fieldValue(block.lines, 'Source'),
    kind: fieldValue(block.lines, 'Kind'),
    statement: fieldValue(block.lines, 'Statement'),
  }));
}

export function parseCases(markdown: string): Case[] {
  return blocks(markdown, CASE_HEADING).map((block) => ({
    id: block.id,
    title: block.title,
    rules: fieldValue(block.lines, 'Covers')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => /^R-\d{3}$/.test(value)),
  }));
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

export function validateRules(markdown: string): string[] {
  const problems: string[] = [];
  const rules = parseRules(markdown);

  if (rules.length === 0) problems.push('No rules found');

  for (const id of duplicates(rules.map((rule) => rule.id))) {
    problems.push(`Duplicate rule identifier: ${id}`);
  }

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
  const problems: string[] = [];
  const knownRules = new Set(parseRules(rulesMd).map((rule) => rule.id));
  const cases = parseCases(casesMd);

  if (cases.length === 0) problems.push('No cases found');

  for (const id of duplicates(cases.map((testCase) => testCase.id))) {
    problems.push(`Duplicate case identifier: ${id}`);
  }

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
