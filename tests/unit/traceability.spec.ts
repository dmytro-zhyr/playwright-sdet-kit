import { test, expect } from '@playwright/test';
import { parseAutomatedTable, traceabilityProblems } from '@/pipeline/traceability';

const REPORT = `# Report

## Automated

| Case | File | What would make the test red |
|---|---|---|
| C-001 | tests/contract/authentication.spec.ts | the token stops resolving |
| C-014 | tests/contract/not-found.spec.ts | a username lookup invents an account |

## Refused

| C-003 | unautomatable without a second account |
`;

const AUTHENTICATION = {
  path: 'tests/contract/authentication.spec.ts',
  content: "test('C-001 — a token authenticates', () => {});",
};
const NOT_FOUND = {
  path: 'tests/contract/not-found.spec.ts',
  content: "test('C-014 — a missing account is 404', () => {});",
};

// Turns red if the Automated table stops being read — every check below would then run against an
// empty map and report nothing, which is the failure mode this whole module exists to prevent.
test('parseAutomatedTable reads only the rows of the Automated section', () => {
  const entries = parseAutomatedTable(REPORT);

  expect(entries).toEqual([
    { id: 'C-001', file: 'tests/contract/authentication.spec.ts' },
    { id: 'C-014', file: 'tests/contract/not-found.spec.ts' },
  ]);
});

// Turns red if the two directions stop agreeing on a tree that is correct. A check that cannot be
// green on correct input is as useless as one that cannot go red.
test('a report that matches the tree raises nothing', () => {
  expect(traceabilityProblems(REPORT, [AUTHENTICATION, NOT_FOUND])).toEqual([]);
});

// Turns red if a test can carry an identifier the report never claims. This is the defect that
// survived the regeneration of 25 August: the identifier resolved, so nothing went red, while it
// named a case about something else entirely.
test('a test naming a case the report does not report is a problem', () => {
  const stale = {
    path: 'tests/defects/not-found.spec.ts',
    content: "test('C-006 — delete answers 404', () => {});",
  };

  expect(traceabilityProblems(REPORT, [AUTHENTICATION, NOT_FOUND, stale])).toEqual([
    'tests/defects/not-found.spec.ts names C-006, which ## Automated does not report as automated',
  ]);
});

// Turns red if a case may be reported in one file and implemented in another — the report would
// then send a reader to a file that never mentions it, and the reader would conclude the test was
// deleted rather than that the report drifted.
test('a case reported in the wrong file is a problem in both directions', () => {
  const moved = {
    path: 'tests/contract/not-found.spec.ts',
    content: "test('C-001 — moved here', () => {});",
  };

  expect(traceabilityProblems(REPORT, [moved])).toEqual([
    'C-001 is reported as automated in tests/contract/authentication.spec.ts, which is not one of the files scanned',
    'C-014 is reported as automated in tests/contract/not-found.spec.ts, but that file never names it',
    'tests/contract/not-found.spec.ts names C-001, which ## Automated reports in tests/contract/authentication.spec.ts',
  ]);
});
