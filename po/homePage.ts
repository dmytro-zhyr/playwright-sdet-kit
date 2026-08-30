import type { Locator, Page } from '@playwright/test';
import { Nav } from '@po/nav';

/**
 * `/` — the banner, the feed tabs and the article cards.
 *
 * ⚠️ **The feed tabs carry no interactive role.** `Your Feed` and `Global Feed` are plain list
 * items, so `getByRole('tab')` and `getByRole('link')` both find nothing and this is the one place
 * in the UI layer where a role-first locator strategy has to make an exception. Observed 30 August
 * 2026; recorded rather than worked around silently, because the next person to write a feed test
 * will otherwise conclude the locator is wrong rather than the markup.
 */
export class HomePage {
  readonly nav: Nav;

  constructor(private readonly page: Page) {
    this.nav = new Nav(page);
  }

  get feedToggle(): Locator {
    return this.page.locator('.feed-toggle');
  }

  get globalFeed(): Locator {
    return this.feedToggle.getByText('Global Feed', { exact: true });
  }

  get yourFeed(): Locator {
    return this.feedToggle.getByText('Your Feed', { exact: true });
  }

  /** Every article card currently rendered in whichever feed is selected. */
  get cards(): Locator {
    return this.page.locator('.article-preview');
  }

  /**
   * The card for one article, addressed by the link the card wraps.
   *
   * By slug rather than by title: two articles may share a title — nothing in the specification
   * forbids it — and a locator that cannot tell them apart would pass on the wrong one. The slug
   * is the identity the server assigned.
   */
  card(slug: string): Locator {
    return this.page.locator(`.article-preview:has(a[href="/article/${slug}"])`);
  }

  async open(): Promise<void> {
    await this.page.goto('/');
    await this.feedToggle.waitFor();
  }
}
