import type { Locator, Page } from '@playwright/test';
import { Navigation } from '@po/components/navigation';

/** `/article/:slug` — one published article, its author, its tags and its comments. */
export class ArticlePage {
  readonly nav: Navigation;

  constructor(private readonly page: Page) {
    this.nav = new Navigation(page);
  }

  get titleHeading(): Locator {
    return this.page.getByRole('heading', { level: 1 }).describe('Article title');
  }

  get bodyText(): Locator {
    return this.page.locator('.article-content').describe('Article body');
  }

  /**
   * The tag chips as rendered, which is not what was typed: the app upper-cases them.
   *
   * `tagChips` and not `tagList`, though the markup calls the container `.tag-list`: `tagList` is
   * the field name on the wire, and one name for the request body and the rendered result would
   * hide exactly the difference this page object exists to show.
   */
  get tagChips(): Locator {
    return this.page.locator('.tag-list li').describe('Tag chips');
  }

  /**
   * Shown to the author only, which is what makes it useful beyond clicking: its presence is the
   * page's own answer to "does this session own this article".
   *
   * ⚠️ The accessible name carries a leading space, from an icon inside the control, so these are
   * substring matches on purpose and `exact: true` would match neither.
   */
  get editLink(): Locator {
    return this.page.getByRole('link', { name: 'Edit Article' }).first().describe('<Edit Article>');
  }

  get deleteButton(): Locator {
    return this.page
      .getByRole('button', { name: 'Delete Article' })
      .first()
      .describe('[Delete Article]');
  }

  authorLink(username: string): Locator {
    return this.page
      .getByRole('link', { name: username, exact: true })
      .first()
      .describe(`<${username}>`);
  }

  async goto(slug: string): Promise<void> {
    await this.page.goto(`/article/${slug}`);
    await this.titleHeading.waitFor();
  }
}
