/**
 * The link the chain had no check for: the report says which file automates a case, and nobody
 * confirmed the file agrees.
 *
 * `tests/unit/artifacts.spec.ts` already refuses a report that leaves a case unaccounted for, and
 * that check went red the moment the cases were regenerated. This one closes the neighbouring
 * link, where a `C-###` written into a test only had to *resolve* — so an identifier left over
 * from a previous run went on naming a case about something else entirely, in silence.
 *
 * Nothing here touches the disk. The caller reads the tree and passes what it read, so the rules
 * below can be tested without fixtures on disk and produce the same answer wherever they run.
 */

/** A test file, addressed the way the report addresses it: repository-relative, forward slashes. */
export interface TestFile {
  path: string;
  content: string;
}

export interface AutomatedEntry {
  id: string;
  file: string;
}

const AUTOMATED_SECTION = '## Automated';
const SECTION_HEADING = /^## /;
const TABLE_ROW = /^\|\s*(C-\d{3})\s*\|([^|]*)\|/;
const CASE_REFERENCE = /(?<![A-Za-z0-9_-])C-\d{3}(?!\d)/g;

/**
 * The rows of the report's `## Automated` table, and of no other section, exactly as written —
 * including a row whose file cell is empty. This function's job is to read the table honestly,
 * not to judge it; turning an empty cell into a problem is `traceabilityProblems`'s job below.
 */
export function parseAutomatedTable(reportMd: string): AutomatedEntry[] {
  const entries: AutomatedEntry[] = [];
  let inside = false;

  for (const raw of reportMd.split(/\r?\n/)) {
    const line = raw.trim();

    if (SECTION_HEADING.test(line)) {
      inside = line === AUTOMATED_SECTION;
      continue;
    }
    if (!inside) continue;

    const match = TABLE_ROW.exec(line);
    if (match) entries.push({ id: match[1], file: match[2].trim() });
  }

  return entries;
}

/**
 * Everything on which the report and the tree disagree, in both directions.
 *
 * Only `tests/contract/` and `tests/defects/` are meant to be passed in. `tests/unit/` is
 * deliberately not scanned by the caller: `tests/unit/parse.spec.ts` is full of strings like
 * `### C-001 — Register a new user`, which are fixtures for the validator itself. A check that
 * counted those would be red always and about nothing — the mirror image of a check that can
 * never go red, and just as quickly ignored.
 */
export function traceabilityProblems(reportMd: string, files: TestFile[]): string[] {
  const problems: string[] = [];
  const reported = new Map<string, string>();

  for (const entry of parseAutomatedTable(reportMd)) {
    if (reported.has(entry.id)) {
      problems.push(`${entry.id} appears twice in ${AUTOMATED_SECTION}`);
      continue;
    }
    if (entry.file === '') {
      problems.push(`${entry.id} is reported in ${AUTOMATED_SECTION} with no file`);
      continue;
    }
    reported.set(entry.id, entry.file);
  }

  const scanned = new Map(files.map((file) => [file.path, file.content]));

  for (const [id, file] of reported) {
    const content = scanned.get(file);
    if (content === undefined) {
      problems.push(
        `${id} is reported as automated in ${file}, which is not one of the files scanned`
      );
    } else if (!content.includes(id)) {
      problems.push(`${id} is reported as automated in ${file}, but that file never names it`);
    }
  }

  for (const file of files) {
    for (const id of new Set(file.content.match(CASE_REFERENCE) ?? [])) {
      const where = reported.get(id);
      if (where === undefined) {
        problems.push(
          `${file.path} names ${id}, which ${AUTOMATED_SECTION} does not report as automated`
        );
      } else if (where !== file.path) {
        problems.push(`${file.path} names ${id}, which ${AUTOMATED_SECTION} reports in ${where}`);
      }
    }
  }

  return problems;
}
