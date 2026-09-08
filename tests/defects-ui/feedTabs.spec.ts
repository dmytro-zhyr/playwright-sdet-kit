import { test, expect } from '@fixtures';
import type { Page } from '@playwright/test';

/**
 * Walks the keyboard focus forward from the top of the document and reports where it stopped.
 *
 * ⛔ Not a `.focus()` call. `focus()` asks the element whether it will take focus; a keyboard user
 * asks the *page* whether it will ever offer it. Those are different questions, and only the second
 * one is what a person pressing Tab experiences — so the assertion below is written against the
 * second and uses the first only to explain the failure.
 *
 * Bounded rather than "until it wraps": a page whose focus order contains a trap would otherwise
 * hang the test rather than fail it, and 40 stops is far past this page's eight.
 */
async function keyboardWalk(page: Page, selector: string): Promise<string[]> {
  const stops: string[] = [];

  await page.locator('body').press('Tab');
  for (let step = 0; step < 40; step++) {
    stops.push(
      await page.evaluate((inside) => {
        const focused = document.activeElement as HTMLElement | null;
        const label = (focused?.textContent ?? '').trim().slice(0, 20);
        return `${focused?.closest(inside) ? '>>> ' : ''}${focused?.tagName ?? 'none'} "${label}"`;
      }, selector)
    );
    await page.keyboard.press('Tab');
  }

  return stops;
}

/**
 * Turns green the day the feed tabs become operable from the keyboard.
 *
 * 🔑 **This is the finding an automated accessibility scan would not have made**, which is why it
 * is written by hand. `axe` matches the DOM against rules, and an `<a>` with no `href` carrying a
 * click handler is, structurally, an ordinary generic element with text in it. Nothing in the
 * markup declares an intention to be a control, so there is no rule for it to break. Knowing that
 * this element *is* a control is the part a scanner cannot supply.
 *
 * ⚠️ **Deployment-specific, and that was measured rather than assumed.** On 7 September 2026 the
 * same toggle was probed on `conduit-unsound` — there the tab is `<a href="/">` and takes focus
 * normally. So this is not the RealWorld reference frontend behaving this way; it belongs to
 * `conduit-overstrict`, which is the UI gate. See spec/FINDINGS.md, D-13.
 *
 * ⛔ Whether Enter activates a focused tab is deliberately not asserted here. It cannot be reached
 * while this fails, and a second assertion that fails for the first one's reason reports the same
 * defect twice.
 */
test(
  'D-13 — a feed tab can be reached from the keyboard',
  {
    annotation: {
      type: 'issue',
      description:
        'D-13 · spec/FINDINGS.md · https://github.com/dmytro-zhyr/playwright-sdet-kit/issues/11',
    },
  },
  async ({ page, homePage }) => {
    await homePage.goto();

    const tab = homePage.feedTab('Global Feed');
    await expect(
      tab,
      'the tab under test must be on the page before it can be reached'
    ).toBeVisible();

    // Gathered before asserting, so the failure names the markup that causes it rather than
    // leaving the reader to open devtools.
    const markup = await tab.evaluate((element) => {
      const control = element as HTMLElement;
      control.focus();
      return {
        tag: control.tagName,
        href: control.getAttribute('href'),
        tabindex: control.getAttribute('tabindex'),
        role: control.getAttribute('role'),
        takesFocus: document.activeElement === control,
      };
    });

    const stops = await keyboardWalk(page, '.feed-toggle');
    const reached = stops.filter((stop) => stop.startsWith('>>> '));

    expect(
      reached,
      'a feed tab is a control and must be operable from the keyboard, and Tab never stops on one: ' +
        `${JSON.stringify(markup)}. An anchor with no href takes no focus, so the page offers it ` +
        `to a pointer only. Focus went to: ${[...new Set(stops)].join(' | ')}`
    ).not.toHaveLength(0);
  }
);
