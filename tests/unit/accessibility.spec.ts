import { test, expect } from '@playwright/test';
import { describeViolations, WCAG_A_AA } from '@assertions/accessibility';

// Turns red if the list stops meaning "WCAG and only WCAG". `best-practice` slipping in would make
// every accessibility failure in this repository overstate itself — 30 of axe's 105 rules carry no
// WCAG tag, and reporting those as a standard violation is a claim that does not survive review.
test('the tag list is WCAG A and AA, with nothing else in it', () => {
  expect([...WCAG_A_AA]).toEqual(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
});

// Turns red if WCAG 2.2 falls out again. It was missing from the first measurement on 7 September
// 2026 and nothing failed — the reported figure was simply smaller than the standard it named.
test('WCAG 2.2 is in the list', () => {
  expect([...WCAG_A_AA]).toContain('wcag22aa');
});

// Turns red if a clean scan starts rendering as an empty string, which reads in a failure message
// as though the assertion had no evidence behind it rather than as a pass.
test('no violations reads as a word, not as an empty line', () => {
  expect(describeViolations([])).toBe('none');
});

// Turns red if the message stops naming the three things a reader needs before opening a trace:
// which rule, how bad, and how many places.
test('a violation names the rule, the impact, the count and where to look', () => {
  const rendered = describeViolations([
    { id: 'color-contrast', impact: 'serious', nodes: [{ target: ['.a'] }, { target: ['.b'] }] },
  ]);

  expect(rendered).toContain('color-contrast');
  expect(rendered).toContain('serious');
  expect(rendered).toContain('2 node(s)');
  expect(rendered).toContain('.a');
});

// Turns red if a violation axe could not rate crashes the renderer. `impact` is optional in axe's
// own output, and a message that throws while explaining a failure hides the failure.
test('a violation with no impact still renders', () => {
  const rendered = describeViolations([{ id: 'html-has-lang', nodes: [{ target: ['html'] }] }]);

  expect(rendered).toContain('unknown · html-has-lang');
});
