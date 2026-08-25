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
 * than skipped: an unknown `## ` section, a `### ` heading that names neither a rule nor a case,
 * a heading whose separator is not an em dash, a field name that is nearly right, a field written
 * twice, a line inside a block that no field and no bullet accounts for, a fenced code block, a
 * `Covers` entry that is not an identifier. A field value, by contrast, is allowed to wrap onto
 * further lines — `CONVENTIONS.md` asks for Markdown wrapped at roughly 100 columns, and a parser
 * that silently kept only the first line would turn that request into data loss.
 *
 * Three kinds of problem exist here and the difference decides which function reports them.
 *
 * - **The text was not read as written** — a heading that vanished, a second `**Kind:**` that was
 *   ignored, a `**Statment:**` nobody will ever read, an `R-1` dropped from a `Covers` list, a
 *   paragraph sitting in a block that no field carries. Whatever a caller does next, it is working
 *   from something other than the file on disk. These make `parseRules` and `parseCases` throw an
 *   {@link ArtifactError}: there is no correct value for them to return, and returning a plausible
 *   one is how a corrupt artifact travels down the chain unnoticed.
 * - **The text was read exactly as written, and what it says is wrong** — a missing `Statement`,
 *   a `Kind` that is neither explicit nor assumed, a gap in the numbering, a case pointing at a
 *   rule that does not exist. The parse is faithful, so parsing succeeds; `validateRules` and
 *   `validateCases` report these, together with all of the above.
 * - **Both artifacts are fine and they no longer describe the same work** — a rule the cases
 *   neither cover nor park, a rule they do both. Nothing is malformed; the two files were simply
 *   produced from different inputs. `validateCases` reports these, because the rules-to-cases link
 *   is the only place both files are in scope at once. See `ruleAccounting` below.
 */

/**
 * **Known limitations** — the artifacts this parser still misreads without saying so.
 *
 * Everything above describes what the parser now catches. This describes what it does not. Each
 * entry was reproduced against the code as it stands, not carried over from a report: the first
 * sentence is what the parser does, the second is what a reader is told instead of the truth.
 *
 * 1. **Accounting is by identifier, never by meaning.** `ruleAccounting` fails the moment a rule
 *    is neither covered nor parked, which is what a regeneration that changes the rule *count*
 *    produces. A regeneration that keeps 201 rules and moves what `R-001` says leaves every
 *    reference resolving and every rule accounted for. The reader gets a clean validation for
 *    cases written against a different reading of the specification. Closing this needs the cases
 *    to record something about the rules they were derived from — a digest — and that is a change
 *    to what the QA agent must write, not to the parser alone.
 *
 * 2. **A `## Not covered` entry is read only in the shape `- R-036 — reason`.** An entry written
 *    `- R-036: reason`, or as prose naming the rule mid-sentence, parks nothing. The failure is
 *    loud — the rule is then reported as accounted for by nobody — but the message names drift
 *    between the artifacts when the real fault is one character of punctuation.
 *
 * 3. **Prose outside a block is not read at all.** The preamble, `## Assumed rules`, and
 *    `## Open questions` are checked for existence and for stray headings and fences, and their
 *    sentences are never looked at. A rule stated in prose under `## Assumed rules` instead of as
 *    a `### R-2xx` block is invisible to every count in this file, and the reader is told nothing.
 *
 * 4. **The bulleted notes in a case are accepted and then dropped.** `**Grouping rationale:**` and
 *    `**Preconditions:**` are written as bullets precisely so the field reader walks past them,
 *    which means the justification the QA agent is told is the main output of its work reaches no
 *    caller of `parseCases`. Nothing reports that it was discarded.
 *
 * 5. **Contradictions in content are invisible.** `C-018` admitting `bio` as a string or `null`
 *    while `C-029` requires `null`, or `R-015` naming 200 where `R-155` says only "a success
 *    status", are agreements between sentences, and this file checks shapes and identifiers. The
 *    reader gets a clean validation for an artifact that argues with itself.
 *
 * 6. **`pipeline/03-report.md` has no parser.** The only thing holding it to the cases is a test
 *    in `tests/unit/artifacts.spec.ts` that counts identifier occurrences in four named sections.
 *    A report that renames a section, or explains a case in a sentence rather than a table row, is
 *    read by nothing here.
 *
 * These are tracked and are to be closed before this repository is presented as a reusable tool.
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
  steps: string;
  expected: string;
}

export interface Objection {
  id: string;
  title: string;
  /** One of `KNOWN_ARTIFACTS`: which artifact of the chain the objection is about. */
  artifact: string;
  /** The rule and case identifiers the objection concerns, in the order written. */
  concerns: string[];
  question: string;
  risk: string;
  /** Empty when the critic had no alternative to offer — which is allowed, and better than one
   * invented to fill the field. */
  alternative: string;
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
  /** How many `###` headings were rejected, whether or not they named an identifier. */
  malformedHeadings: number;
  /** The `## ` headings the file really carries — line-initial, and outside every code fence. */
  sections: string[];
  /** The lines of each `## ` section that belong to no block, keyed by the heading line. */
  sectionLines: Map<string, string[]>;
}

/** Blocks turned into records, plus everything reading them showed was not read as written. */
interface Read<T> {
  items: T[];
  problems: string[];
  malformedHeadings: number;
  sections: string[];
  sectionLines: Map<string, string[]>;
  /**
   * `${id}:${field}` for every field written with nothing after the colon and its apparent value
   * below a blank line. `readFields` has already said so in a sentence that names the real fault,
   * so `validateRules` and `validateCases` skip their own `missing X field` for these.
   */
  valueBelowBlankLine: Set<string>;
}

const RULE_HEADING = /^### (R-\d{3}) — (.+)$/;
const CASE_HEADING = /^### (C-\d{3}) — (.+)$/;
const OBJECTION_HEADING = /^### (O-\d{3}) — (.+)$/;

/**
 * A `###` heading that names a rule, a case or an objection identifier, however badly punctuated.
 * It exists so that a heading the strict expressions above reject can still be recognised well
 * enough to say what is wrong with it, instead of vanishing and leaving "No rules found" behind.
 */
const LOOSE_HEADING = /^### ([RCO])-(\d+)[ \t]*([^\w\s]*)[ \t]*(.*)$/u;

const EM_DASH = '—';

/** Any `**Name:**` line, whether or not the name is one this artifact knows. */
const FIELD_LINE = /^\*\*([^*]+):\*\*[ \t]*(.*)$/;
/** The same shape, used to decide where a wrapped value stops. */
const ANY_FIELD = /^\*\*[^*]+:\*\*/;
const ANY_HEADING = /^#{1,6} /;
/** Any heading, and its level, whether or not the space the format asks for is there. */
const HASH_HEADING = /^(#{1,6})(?:[^#]|$)/;
/** The opening or closing line of a fenced code block. */
const FENCE = /^(?:```|~~~)/;
/** A list item. The rationale and the preconditions of a case are written as these. */
const BULLET = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+\S/;
/** A line that is indented, and so continues the bullet above it rather than starting anything. */
const INDENTED = /^[ \t]+\S/;

/** What a `**Covers:**` entry has to look like. */
const RULE_REFERENCE = /^R-\d{3}$/;

/** What an entry under `## Not covered` has to look like for the rule to count as parked. */
const PARKED_ENTRY = /^- (R-\d{3})(?=[ \t]|$)/;

const RULE_FIELDS = ['Source', 'Kind', 'Statement'];
const CASE_FIELDS = ['Covers', 'Steps', 'Expected'];
const OBJECTION_FIELDS = [
  'Artifact',
  'Concerns',
  'Question',
  'Risk if ignored',
  'Possible alternative',
];

const KNOWN_RULE_SECTIONS = ['## Rules', '## Assumed rules', '## Open questions'];
const KNOWN_CASE_SECTIONS = ['## Cases', '## Not covered', '## Open questions'];
const KNOWN_OBJECTION_SECTIONS = ['## Objections', '## Verdict'];

const REQUIRED_RULE_SECTIONS = ['## Assumed rules', '## Open questions'];
const REQUIRED_CASE_SECTIONS = ['## Not covered'];
const REQUIRED_OBJECTION_SECTIONS = ['## Verdict'];

const NOT_COVERED = '## Not covered';

/**
 * The artifacts a critic of this chain may object about, as a closed set.
 *
 * Deliberately not a check that the path exists on disk: the acceptance run works on copies in a
 * temporary directory, so an existence check would pass or fail depending on where the validator
 * was started from. A closed set answers the same question and answers it the same way everywhere.
 */
const KNOWN_ARTIFACTS = [
  'spec/conduit-api.md',
  'pipeline/01-rules.md',
  'pipeline/02-cases.md',
  'pipeline/03-report.md',
  'tests/',
];

const CONCERN_REFERENCE = /^[RC]-\d{3}$/;

/**
 * What each identifier prefix is called, so a message names the artifact the reader is holding.
 * `article` exists because `singular`/`plural` are not all consonant-initial: "a rule" and
 * "a case" read fine with a literal "a", but "a objection" and "a objections file" do not.
 */
const NOUNS: Record<string, { singular: string; plural: string; article: string }> = {
  R: { singular: 'rule', plural: 'rules', article: 'a' },
  C: { singular: 'case', plural: 'cases', article: 'a' },
  O: { singular: 'objection', plural: 'objections', article: 'an' },
};

/** How many identifiers a problem naming a list of them prints before it starts counting. */
const NAMED_IN_A_LIST = 8;

/** A line as it appears in a message: trimmed, and short enough not to bury the sentence. */
function quoted(line: string): string {
  const trimmed = line.trim();
  return trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 57)}...`;
}

/** A field line's value together with the index of the last line that value consumed. */
interface FieldValue {
  value: string;
  end: number;
}

/**
 * The value of a field line, including any continuation lines.
 *
 * A value runs to the first line that starts a new field, starts a heading, or is blank. The
 * pieces are joined with a single space, which is what hand-wrapping a sentence means. `end` is
 * the index of the last line taken, so the caller knows which lines are already accounted for and
 * does not go on to report them as content nothing reads.
 */
function continuedValue(lines: string[], index: number, first: string): FieldValue {
  const parts = [first.trim()];
  let end = index;

  for (let next = index + 1; next < lines.length; next += 1) {
    const continuation = lines[next].trim();
    if (continuation === '') break;
    if (ANY_FIELD.test(continuation)) break;
    if (ANY_HEADING.test(continuation)) break;
    parts.push(continuation);
    end = next;
  }

  return {
    value: parts
      .filter((part) => part !== '')
      .join(' ')
      .trim(),
    end,
  };
}

/**
 * Whether a field that took no value on its own line has one sitting below a blank line.
 *
 * This is the difference between `**Steps:**` at the end of a block, which is simply empty, and
 * `**Steps:**` followed by a blank line and the steps, which is a value the parser will not read.
 * Only the second is worth a sentence of its own.
 */
function contentBelowBlankLine(lines: string[], index: number): boolean {
  let sawBlank = false;

  for (let next = index + 1; next < lines.length; next += 1) {
    const line = lines[next].trim();
    if (line === '') {
      sawBlank = true;
      continue;
    }
    if (!sawBlank) return false;
    return !ANY_FIELD.test(line) && !ANY_HEADING.test(line);
  }

  return false;
}

interface Fields {
  values: Map<string, string>;
  problems: string[];
  /** The names of the fields whose value was left below a blank line. */
  valueBelowBlankLine: Set<string>;
}

/**
 * Every line of a block, read once and accounted for.
 *
 * Four shapes used to disappear here. A name that is not one of `known` — `**Statment:**` — used
 * to produce nothing but `missing Statement field`, which sends the reader hunting for a line
 * that is sitting right there, one letter wrong. A field written twice used to keep the first
 * value and drop the second without a word, so a rule could carry two contradictory `Kind` lines
 * and validate. A field whose value began below a blank line was reported as missing while its
 * content sat two lines under the complaint. And any other line — a paragraph, a `####` heading,
 * a table — was walked past, so a block could hold a page of prose and parse as three fields.
 *
 * Bullets are the one exception, and a deliberate one: `**Grouping rationale:**` and
 * `**Preconditions:**` are written as bulleted notes precisely because a case may carry only
 * three field names. They are accepted and not parsed, which is limitation 4.
 */
function readFields(block: Block, known: string[]): Fields {
  const values = new Map<string, string>();
  const problems: string[] = [];
  const valueBelowBlankLine = new Set<string>();
  const consumed = new Set<number>();
  let insideBullet = false;

  for (let index = 0; index < block.lines.length; index += 1) {
    if (consumed.has(index)) continue;

    const raw = block.lines[index];
    const line = raw.trim();
    if (line === '') continue;

    const match = FIELD_LINE.exec(line);
    if (match) {
      insideBullet = false;
      const name = match[1].trim();
      const read = continuedValue(block.lines, index, match[2]);
      for (let taken = index + 1; taken <= read.end; taken += 1) consumed.add(taken);

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

      if (read.value === '' && contentBelowBlankLine(block.lines, index)) {
        problems.push(
          `${block.id}: the ${name} field takes no value on its own line, and what looks like its value stands below a blank line; a value starts beside the field name and wraps onto the lines directly under it`
        );
        valueBelowBlankLine.add(name);
      }

      values.set(name, read.value);
      continue;
    }

    if (BULLET.test(raw)) {
      insideBullet = true;
      continue;
    }

    if (insideBullet && INDENTED.test(raw)) continue;

    insideBullet = false;
    problems.push(
      `${block.id}: "${quoted(raw)}" is neither a field, a bullet nor the continuation of either, and nothing reads it — the fields here are ${known.join(', ')}`
    );
  }

  return { values, problems, valueBelowBlankLine };
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
 * rules`. Which headings may do that is a closed set: anything else is reported, so an unexpected
 * subheading can no longer cut a block short without a word.
 *
 * Every other heading is now a closed set too. A `### C-009` in a rules file, a `### Notes`, a
 * `###R-003` written without its space, and a `#### ` of any depth used to be swallowed into the
 * block above them together with their contents; each is now named and closes the block, so the
 * lines under it are attributed to nothing rather than to the wrong rule.
 *
 * Fenced code blocks are recognised for the same reason and refused: an example rule inside a
 * fence used to be read as a rule of the contract.
 */
function scan(markdown: string, heading: RegExp, prefix: string, knownSections: string[]): Scan {
  const nouns = NOUNS[prefix];
  if (!nouns) {
    throw new Error(
      `scan: unknown identifier prefix "${prefix}". Known prefixes: ${Object.keys(NOUNS).join(', ')}`
    );
  }
  const noun = nouns.plural;
  const singular = nouns.singular;
  const article = nouns.article;

  const blocks: Block[] = [];
  const problems: string[] = [];
  const sections: string[] = [];
  const sectionLines = new Map<string, string[]>();
  let malformedHeadings = 0;
  let current: Block | null = null;
  let section: string | null = null;
  let fenceOpenedAt: number | null = null;
  let lineNumber = 0;

  const close = (): void => {
    if (current) blocks.push(current);
    current = null;
  };

  const where = (): string => (current ? current.id : `Line ${lineNumber}`);

  for (const raw of markdown.split(/\r?\n/)) {
    lineNumber += 1;
    const line = raw.trim();

    if (FENCE.test(line)) {
      if (fenceOpenedAt === null) {
        fenceOpenedAt = lineNumber;
        problems.push(
          `${where()}: a fenced code block — this format has none, and nothing inside one is read as ${article} ${singular}`
        );
      } else {
        fenceOpenedAt = null;
      }
      continue;
    }

    // Deliberately before every other test: a heading, a field and a section inside a fence are
    // an illustration of the format, not the format.
    if (fenceOpenedAt !== null) continue;

    const match = heading.exec(line);
    if (match) {
      close();
      current = { id: match[1], title: match[2].trim(), lines: [] };
      continue;
    }

    if (line.startsWith('### ')) {
      const problem = headingProblem(line, prefix);
      if (problem) {
        close();
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
      close();
      section = line;
      sections.push(line);
      if (!sectionLines.has(line)) sectionLines.set(line, []);
      continue;
    }

    // Every remaining heading: a `### ` the loose expression could make nothing of, a `###` with
    // no space after it, a `####` or deeper, and a `# ` that turns up inside a block. A `# `
    // outside one is the document title and is left alone.
    const hashes = HASH_HEADING.exec(line);
    if (hashes && !(hashes[1].length === 1 && current === null)) {
      // A heading at the block's own level or above it ends the block; the lines under it belong
      // to no rule. One nested deeper does not: it is written inside the block, so the fields
      // below it stay attached to the block they were written in, and only the heading is refused.
      if (hashes[1].length <= 3) close();
      problems.push(
        `Unexpected heading "${quoted(line)}" — ${article} ${noun} file carries ${knownSections.join(', ')} sections and "### ${prefix}-001 ${EM_DASH} Title" blocks, and no other heading`
      );
      malformedHeadings += 1;
      continue;
    }

    if (current) {
      current.lines.push(raw);
    } else if (section !== null) {
      sectionLines.get(section)?.push(raw);
    }
  }

  if (fenceOpenedAt !== null) {
    problems.push(
      `The fenced code block opened at line ${fenceOpenedAt} is never closed, so everything under it was read as code`
    );
  }

  close();
  return { blocks, problems, malformedHeadings, sections, sectionLines };
}

/** Read a rules artifact without deciding what to do about what was noticed. */
function readRules(markdown: string): Read<Rule> {
  const scanned = scan(markdown, RULE_HEADING, 'R', KNOWN_RULE_SECTIONS);
  const items: Rule[] = [];
  const problems = [...scanned.problems];
  const valueBelowBlankLine = new Set<string>();

  for (const block of scanned.blocks) {
    const fields = readFields(block, RULE_FIELDS);
    problems.push(...fields.problems);
    for (const name of fields.valueBelowBlankLine) valueBelowBlankLine.add(`${block.id}:${name}`);
    items.push({
      id: block.id,
      title: block.title,
      source: fields.values.get('Source') ?? '',
      kind: fields.values.get('Kind') ?? '',
      statement: fields.values.get('Statement') ?? '',
    });
  }

  return {
    items,
    problems,
    malformedHeadings: scanned.malformedHeadings,
    sections: scanned.sections,
    sectionLines: scanned.sectionLines,
    valueBelowBlankLine,
  };
}

/** Read a cases artifact without deciding what to do about what was noticed. */
function readCases(markdown: string): Read<Case> {
  const scanned = scan(markdown, CASE_HEADING, 'C', KNOWN_CASE_SECTIONS);
  const items: Case[] = [];
  const problems = [...scanned.problems];
  const valueBelowBlankLine = new Set<string>();

  for (const block of scanned.blocks) {
    const fields = readFields(block, CASE_FIELDS);
    problems.push(...fields.problems);
    for (const name of fields.valueBelowBlankLine) valueBelowBlankLine.add(`${block.id}:${name}`);

    const covers = fields.values.get('Covers') ?? '';
    const rules: string[] = [];

    // An absent Covers field is not a malformed one: `validateCases` reports it as "references no
    // rule at all", and splitting an empty string here would add a second complaint about the
    // same missing line.
    if (covers !== '') {
      for (const entry of covers.split(',')) {
        const token = entry.trim();
        if (RULE_REFERENCE.test(token)) {
          if (rules.includes(token)) {
            // Not a duplicate rule and not a duplicate case: one list naming one rule twice. It
            // used to be counted as two references and reported as nothing, so a case could claim
            // more coverage than the file states while `ruleCoverage` — which counts a Set — went
            // on printing the same number.
            problems.push(
              `${block.id}: Covers names ${token} twice; each rule is referenced once in a list`
            );
          } else {
            rules.push(token);
          }
        } else if (token === '') {
          problems.push(`${block.id}: Covers has an empty entry — a stray or trailing comma`);
        } else {
          problems.push(
            `${block.id}: "${token}" in Covers is not a rule identifier — the form is R-001`
          );
        }
      }
    }

    items.push({
      id: block.id,
      title: block.title,
      rules,
      steps: fields.values.get('Steps') ?? '',
      expected: fields.values.get('Expected') ?? '',
    });
  }

  return {
    items,
    problems,
    malformedHeadings: scanned.malformedHeadings,
    sections: scanned.sections,
    sectionLines: scanned.sectionLines,
    valueBelowBlankLine,
  };
}

/** Read an objections artifact without deciding what to do about what was noticed. */
function readObjections(markdown: string): Read<Objection> {
  const scanned = scan(markdown, OBJECTION_HEADING, 'O', KNOWN_OBJECTION_SECTIONS);
  const items: Objection[] = [];
  const problems = [...scanned.problems];
  const valueBelowBlankLine = new Set<string>();

  for (const block of scanned.blocks) {
    const fields = readFields(block, OBJECTION_FIELDS);
    problems.push(...fields.problems);
    for (const name of fields.valueBelowBlankLine) valueBelowBlankLine.add(`${block.id}:${name}`);

    const written = fields.values.get('Concerns') ?? '';
    const concerns: string[] = [];

    // An absent Concerns field is not a malformed one: `validateObjections` reports it as missing,
    // and splitting an empty string here would add a second complaint about the same line.
    if (written !== '') {
      for (const entry of written.split(',')) {
        const token = entry.trim();
        if (CONCERN_REFERENCE.test(token)) {
          if (concerns.includes(token)) {
            problems.push(
              `${block.id}: Concerns names ${token} twice; each identifier is referenced once`
            );
          } else {
            concerns.push(token);
          }
        } else if (token === '') {
          problems.push(`${block.id}: Concerns has an empty entry — a stray or trailing comma`);
        } else {
          problems.push(
            `${block.id}: "${token}" in Concerns is not a rule or case identifier — the forms are R-001 and C-001`
          );
        }
      }
    }

    items.push({
      id: block.id,
      title: block.title,
      artifact: fields.values.get('Artifact') ?? '',
      concerns,
      question: fields.values.get('Question') ?? '',
      risk: fields.values.get('Risk if ignored') ?? '',
      alternative: fields.values.get('Possible alternative') ?? '',
    });
  }

  return {
    items,
    problems,
    malformedHeadings: scanned.malformedHeadings,
    sections: scanned.sections,
    sectionLines: scanned.sectionLines,
    valueBelowBlankLine,
  };
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

/** The objections, on the same terms as {@link parseRules}. */
export function parseObjections(markdown: string): Objection[] {
  const read = readObjections(markdown);
  if (read.problems.length > 0) throw new ArtifactError('objections', read.problems);
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

/** A list of identifiers in a message, cut off before it becomes a wall. */
function named(ids: string[]): string {
  const shown = ids.slice(0, NAMED_IN_A_LIST).join(', ');
  const rest = ids.length - NAMED_IN_A_LIST;
  return rest > 0 ? `${shown}, and ${rest} more` : shown;
}

/** The identifiers a `## Not covered` section parks, in the one shape that section is read in. */
function parkedRules(lines: string[]): string[] {
  const parked: string[] = [];
  for (const line of lines) {
    const match = PARKED_ENTRY.exec(line.trimEnd());
    if (match) parked.push(match[1]);
  }
  return parked;
}

/**
 * Every rule is decided about exactly once: covered by at least one case, or parked under
 * `## Not covered`, and never both.
 *
 * This is the rules-to-cases half of the guarantee `tests/unit/artifacts.spec.ts` already holds
 * the report to, and it exists because references only had to *resolve*. On 25 August the rules
 * were regenerated from 138 to 201 and every identifier a case named still existed, so the cases
 * validated clean and `ruleCoverage` printed 135/201 — an arithmetically valid number about two
 * documents that were no longer describing the same work. Sixty-six rules had appeared that no
 * case had ever seen, and nothing said so.
 *
 * A rule may be covered by several cases; that is grouping, not drift. What may not happen is a
 * rule nobody decided anything about, and a rule two sections decide opposite things about.
 */
function ruleAccounting(ruleIds: string[], cases: Case[], parked: string[]): string[] {
  const problems: string[] = [];
  const known = new Set(ruleIds);
  const covered = new Set(cases.flatMap((testCase) => testCase.rules));
  const parkedOnce = new Set(parked);

  for (const id of duplicates(parked)) {
    problems.push(`${id} is listed twice under "${NOT_COVERED}"`);
  }

  const strangers = [...parkedOnce].filter((id) => !known.has(id));
  if (strangers.length > 0) {
    problems.push(
      `"${NOT_COVERED}" parks ${named(strangers)}, which the rules file does not define`
    );
  }

  const both = ruleIds.filter((id) => covered.has(id) && parkedOnce.has(id));
  if (both.length > 0) {
    problems.push(
      `${named(both)} is both covered by a case and parked under "${NOT_COVERED}" — a rule is one or the other`
    );
  }

  const unaccounted = ruleIds.filter((id) => !covered.has(id) && !parkedOnce.has(id));
  if (unaccounted.length > 0) {
    const subject =
      unaccounted.length === 1
        ? `${unaccounted[0]} is covered by no case and not parked under "${NOT_COVERED}"`
        : `${unaccounted.length} of the ${ruleIds.length} rules are covered by no case and not parked under "${NOT_COVERED}": ${named(unaccounted)}`;
    problems.push(
      `${subject}. The cases do not account for the rules they were derived from and have to be regenerated against them.`
    );
  }

  return problems;
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
    // A field whose value was left below a blank line has already been reported by name, with the
    // sentence that says what to do about it. Saying `missing Source field` on top of that is the
    // second complaint about one line the reader has to reconcile.
    const stated = (field: string): boolean => !read.valueBelowBlankLine.has(`${rule.id}:${field}`);

    if (!rule.source && stated('Source')) problems.push(`${rule.id}: missing Source field`);
    if (!rule.statement && stated('Statement'))
      problems.push(`${rule.id}: missing Statement field`);
    if (rule.kind !== 'explicit' && rule.kind !== 'assumed' && stated('Kind')) {
      problems.push(`${rule.id}: Kind must be "explicit" or "assumed", not "${rule.kind}"`);
    }
  }

  // Deliberately the headings the scan really found, not `markdown.includes(section)`: the literal
  // text also occurs inside a code fence and mid-sentence, and a check satisfied by a sentence
  // about a section is a check that passes on the file it exists to catch.
  for (const section of REQUIRED_RULE_SECTIONS) {
    if (!read.sections.includes(section)) problems.push(`Missing mandatory section: ${section}`);
  }

  return problems;
}

export function validateCases(rulesMd: string, casesMd: string): string[] {
  // Deliberately not `parseRules`: a broken rules file is `validateRules`'s news to break, and
  // throwing here would replace a list of problems in the cases file with an exception about a
  // different file.
  const rules = readRules(rulesMd);
  const ruleIds = [...new Set(rules.items.map((rule) => rule.id))];
  const knownRules = new Set(ruleIds);
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
    // A missing Covers field is deliberately not a problem of its own. `references no rule at all`
    // already covers it, and it covers more: a Covers line that is present but empty, and one
    // whose every entry was malformed, are both cases that name no rule while the field is there.
    // Adding `missing Covers field` alongside it would print two complaints about one absent line
    // and still leave those other two shapes to the message that already says the useful thing.
    if (testCase.rules.length === 0) {
      problems.push(`${testCase.id}: references no rule at all`);
    }
    const stated = (field: string): boolean =>
      !read.valueBelowBlankLine.has(`${testCase.id}:${field}`);

    if (!testCase.steps && stated('Steps')) problems.push(`${testCase.id}: missing Steps field`);
    if (!testCase.expected && stated('Expected')) {
      problems.push(`${testCase.id}: missing Expected field`);
    }
    for (const ruleId of testCase.rules) {
      if (!knownRules.has(ruleId)) {
        problems.push(`${testCase.id}: references rule ${ruleId}, which does not exist`);
      }
    }
  }

  // Only once both files were read as written. Accounting computed over a misread artifact would
  // report drift between the documents when the fault is a heading one character wrong, and the
  // reader would go looking for the wrong thing. Fix the reading first; this runs on the next pass.
  if (rules.problems.length === 0 && read.problems.length === 0) {
    problems.push(
      ...ruleAccounting(ruleIds, cases, parkedRules(read.sectionLines.get(NOT_COVERED) ?? []))
    );
  }

  for (const section of REQUIRED_CASE_SECTIONS) {
    if (!read.sections.includes(section)) problems.push(`Missing mandatory section: ${section}`);
  }

  return problems;
}

/**
 * The objections file, checked against the rules and cases it claims to be about.
 *
 * Deliberately not `parseRules` / `parseCases`: a broken upstream artifact is those validators'
 * news to break, and throwing here would replace a list of problems in the objections file with
 * an exception about a different one.
 */
export function validateObjections(
  rulesMd: string,
  casesMd: string,
  objectionsMd: string
): string[] {
  const known = new Set([
    ...readRules(rulesMd).items.map((rule) => rule.id),
    ...readCases(casesMd).items.map((testCase) => testCase.id),
  ]);

  const read = readObjections(objectionsMd);
  const objections = read.items;
  const problems: string[] = [...read.problems];

  for (const id of duplicates(objections.map((objection) => objection.id))) {
    problems.push(`Duplicate objection identifier: ${id}`);
  }

  problems.push(
    ...sequence(
      objections.map((objection) => objection.id),
      'Objection',
      'O'
    )
  );

  for (const objection of objections) {
    const stated = (field: string): boolean =>
      !read.valueBelowBlankLine.has(`${objection.id}:${field}`);

    if (!objection.artifact && stated('Artifact')) {
      problems.push(`${objection.id}: missing Artifact field`);
    }
    if (objection.concerns.length === 0 && stated('Concerns')) {
      problems.push(
        `${objection.id}: missing Concerns field — an objection names what it is about`
      );
    }
    if (!objection.question && stated('Question')) {
      problems.push(`${objection.id}: missing Question field`);
    }
    if (!objection.risk && stated('Risk if ignored')) {
      problems.push(`${objection.id}: missing Risk if ignored field`);
    }

    if (objection.artifact && !KNOWN_ARTIFACTS.includes(objection.artifact)) {
      problems.push(
        `${objection.id}: Artifact is "${objection.artifact}", which is not an artifact of this chain. Known artifacts: ${KNOWN_ARTIFACTS.join(', ')}`
      );
    }

    for (const reference of objection.concerns) {
      if (!known.has(reference)) {
        problems.push(
          `${objection.id}: Concerns names ${reference}, which no rule or case in the chain holds`
        );
      }
    }
  }

  // Deliberately the headings the scan really found, for the same reason `validateRules` does it:
  // the literal text also occurs inside a fence and mid-sentence.
  for (const section of REQUIRED_OBJECTION_SECTIONS) {
    if (!read.sections.includes(section)) problems.push(`Missing mandatory section: ${section}`);
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
