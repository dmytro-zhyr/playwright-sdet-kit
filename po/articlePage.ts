import type { Locator, Page } from '@playwright/test';
import { Nav } from '@/po/nav';

/** `/article/:slug` — one published article, its author, its tags and its comments. */
export class ArticlePage {
  readonly nav: Nav;

  constructor(private readonly page: Page) {
    this.nav = new Nav(page);
  }

  get title(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  get body(): Locator {
    return this.page.locator('.article-content');
  }

  /** The tag chips as rendered. Observed upper-cased by the app — see `tagList` in the tests. */
  get tags(): Locator {
    return this.page.locator('.tag-list li');
  }

  /**
   * Shown to the author only, which is what makes it useful beyond clicking: its presence is the
   * page's own answer to "does this session own this article".
   *
   * ⚠️ The accessible name carries a leading space, from an icon inside the control, so these are
   * substring matches on purpose and `exact: true` would match neither.
   */
  get edit(): Locator {
    return this.page.getByRole('link', { name: 'Edit Article' }).first();
  }

  get delete(): Locator {
    return this.page.getByRole('button', { name: 'Delete Article' }).first();
  }

  get commentBody(): Locator {
    return this.page.getByPlaceholder('Write a comment...');
  }

  get postComment(): Locator {
    return this.page.getByRole('button', { name: 'Post Comment' });
  }

  author(username: string): Locator {
    return this.page.getByRole('link', { name: username, exact: true }).first();
  }

  async open(slug: string): Promise<void> {
    await this.page.goto(`/article/${slug}`);
    await this.title.waitFor();
  }
}
