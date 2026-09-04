import { test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { Navigation } from '@po/components/navigation';

/**
 * Matches a tab's whole label, allowing for the padding the markup puts around it.
 *
 * ⚠️ Not a plain string. `hasText` given a string matches a **case-insensitive substring**, and the
 * third tab is named after a tag — user content — so `'Blog'` would also select a tag called
 * `Blogging`. The label itself is rendered as ` Global Feed ` with surrounding whitespace, which is
 * why the anchors allow it rather than demanding an exact match.
 */
function tabLabel(name: string): RegExp {
  return new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\s*$`, 'u');
}

/**
 * `/` — the banner, the feed tabs and the article cards.
 *
 * ⚠️ **The feed tabs have no role at all, and the reason is specific.** They are `<a>` elements
 * **without `href`**, and an anchor with no `href` is not a link in the accessibility tree — it is
 * `generic`. That is why `getByRole('link')` and `getByRole('tab')` both find nothing, and it is
 * the one place in this layer where a role-first strategy has to fall back on a class.
 *
 * 📌 They are named `…Tab` regardless: the name states the kind a reader sees, and this comment
 * states that the markup does not back it. Observed 30 August 2026, and re-measured in the browser
 * on 4 September 2026 — the earlier version of this comment said "plain list items", which named
 * the wrong element and would have taught the next reader the wrong rule.
 *
 * 🔴 Two consequences a feed test will meet, both in spec/FINDINGS.md:
 * - **Not reachable from the keyboard.** No `href` and no `tabindex`, so they take no focus.
 * - **Selection lives only in a class.** There is no `aria-selected`; `.active` is the whole of
 *   what the page says about which feed is showing, which is why it is written once, here.
 */
export class HomePage {
  readonly nav: Navigation;

  constructor(private readonly page: Page) {
    this.nav = new Navigation(page);
  }

  /**
   * The strip holding the tabs. **Two or three of them**: a third appears when a tag is clicked,
   * so a test asserting a fixed count is asserting the state it happened to start in.
   */
  get feedTabs(): Locator {
    return this.page.locator('.feed-toggle');
  }

  /**
   * One tab, addressed by its label — `Your Feed`, `Global Feed`, or a tag's name.
   *
   * ⛔ `li:not([hidden])` is not decoration. The tag tab exists in the DOM before it is shown, and
   * it carries `active` the whole time it is hidden, so a locator that ignores `hidden` matches two
   * elements on a page that is showing one and fails Playwright's strict mode. Measured 4 September
   * 2026.
   */
  feedTab(name: string): Locator {
    return this.feedTabs.locator('li:not([hidden]) .nav-link').filter({ hasText: tabLabel(name) });
  }

  /**
   * The same tab, and only while it is the selected one.
   *
   * Defined **through** `feedTab` rather than re-derived from the markup, so what a feed tab is
   * stays written in exactly one place.
   *
   * 📌 `.active` on its own would match the pagination and anything else on the page carrying that
   * class, and it does not matter: `and()` intersects two locators rather than searching inside
   * one, and the left side has already narrowed to the tabs.
   */
  activeFeedTab(name: string): Locator {
    return this.feedTab(name).and(this.page.locator('.active'));
  }

  /**
   * Every article card currently rendered in whichever feed is selected.
   *
   * ⛔ Not `.article-preview` on its own, which is **also the class of the empty state**: an empty
   * feed renders `<div class="article-preview">No articles are here... yet.</div>`, so counting the
   * bare class reports one article where there are none. Measured 4 September 2026, after a test
   * asserting `toHaveCount(0)` on an empty personal feed failed — for two reasons at once, this
   * being the second. Requiring the link the card wraps is what makes this a count of articles.
   */
  get articleCards(): Locator {
    return this.page.locator('.article-preview:has(a[href^="/article/"])');
  }

  /** What the feed says instead of cards when it has nothing to show. */
  get emptyFeedNotice(): Locator {
    return this.page.locator('.article-preview').filter({ hasText: 'No articles are here' });
  }

  /**
   * The card for one article, addressed by the link the card wraps.
   *
   * By slug rather than by title: two articles may share a title — nothing in the specification
   * forbids it — and a locator that cannot tell them apart would pass on the wrong one. The slug
   * is the identity the server assigned.
   */
  articleCard(slug: string): Locator {
    return this.page.locator(`.article-preview:has(a[href="/article/${slug}"])`);
  }

  /**
   * The home page, by address, with its first feed already answered.
   *
   * ⛔ Waiting for the toggle is not enough, and the difference is not theoretical. The toggle
   * renders before the articles request comes back, so a test that clicked a tab straight after
   * `goto` switched feeds while the **initial** response was still in flight — and that response
   * then painted ten global articles over the personal feed it had just selected. The assertion
   * that caught it read as a defect of the application and was a defect of the oracle. Measured
   * 4 September 2026; the same shape as the `networkidle` mistake recorded in registerPage.
   */
  async goto(): Promise<void> {
    await Promise.all([
      this.page.waitForResponse(
        (candidate) =>
          new URL(candidate.url()).pathname.endsWith('/api/articles') &&
          candidate.request().method() === 'GET'
      ),
      this.page.goto('/'),
    ]);

    await this.feedTabs.waitFor();
  }

  /**
   * Selects a feed tab and returns once its request has been answered and the tab reads as active.
   *
   * ⛔ The class alone is the wrong oracle. It flips the moment the click lands, while the articles
   * are still on the wire — so a method that waited only for `active` would hand back a page in the
   * middle of changing, which is how the first version of this failed. Waiting on the response is
   * answerable: it happens once and it carries a status.
   *
   * ⚠️ Switching a tab changes **no URL** — the selection is not addressable, so clicking is the
   * only route to a tag's feed, and this method is the only setup a feed test can have. Measured
   * 4 September 2026; see spec/FINDINGS.md.
   */
  async openFeedTab(name: string): Promise<void> {
    return test.step(`open the ${name} tab`, async () => {
      await Promise.all([
        this.page.waitForResponse(
          (candidate) =>
            /\/api\/articles(\/feed)?$/u.test(new URL(candidate.url()).pathname) &&
            candidate.request().method() === 'GET'
        ),
        this.feedTab(name).click(),
      ]);

      await this.activeFeedTab(name).waitFor();
    });
  }
}
