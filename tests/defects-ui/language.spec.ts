import { test, expect } from '@fixtures';
import AxeBuilder from '@axe-core/playwright';
import { describeViolations } from '@assertions/accessibility';

/**
 * Turns green the day the document declares its language.
 *
 * **WCAG 3.1.1 Language of Page, level A** — the most basic level of the standard. Without `lang`
 * on `<html>`, a screen reader reads the page in whatever language it was last set to, so English
 * content arrives pronounced by a Ukrainian or German voice. It is one attribute.
 *
 * 🔑 **Chosen over the other four findings because it is the only one that cannot drift.** Measured
 * on 7 September 2026 across seven routes of `conduit-overstrict`: exactly **one node, on every
 * page**. The others — `color-contrast` at 98 nodes, `image-alt` at 10, `link-name` at 10 — live
 * mostly inside `.article-preview`, which is other people's articles: their counts move when
 * somebody publishes, and a test whose number depends on that is a scheduler for false alarms.
 * Those are recorded in spec/FINDINGS.md as a measurement rather than pinned as a test.
 *
 * 📌 Asserted through axe rather than by reading the attribute, so this test and the gate in
 * `tests/ui/accessibility.spec.ts` speak one vocabulary. `html-has-lang` also knows things a
 * `getAttribute` does not — an empty `lang=""` is a failure too.
 *
 * ⚠️ One page is enough. `<html>` belongs to the application shell, not to a route, and asserting
 * the same shell seven times would report one defect seven times.
 */
test(
  'D-14 — the page declares the language it is written in',
  {
    annotation: {
      type: 'issue',
      description:
        'spec/FINDINGS.md — D-14; GitHub issue to be filed when the repository is published',
    },
  },
  async ({ page, homePage }) => {
    await homePage.goto();

    const { violations } = await new AxeBuilder({ page }).withRules(['html-has-lang']).analyze();

    expect(
      describeViolations(violations),
      'a screen reader picks its pronunciation from the lang attribute, and with none it keeps whatever language it was last set to — WCAG 3.1.1, level A, one attribute on <html>'
    ).toBe('none');
  }
);
