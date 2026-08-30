import { test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { Nav } from '@/po/nav';
import type { NewArticle } from '@/data/articleFactory';

/**
 * `/editor` — where an article is written and published.
 *
 * ⚠️ Behind an auth guard: an anonymous visit redirects to `/`, so a test that forgets to sign in
 * fails on a missing field rather than on the redirect it could have named. Sign in through
 * `signedIn` before opening this page.
 */
export class EditorPage {
  readonly nav: Nav;

  constructor(private readonly page: Page) {
    this.nav = new Nav(page);
  }

  get title(): Locator {
    return this.page.getByPlaceholder('Article Title');
  }

  get description(): Locator {
    return this.page.getByPlaceholder("What's this article about?");
  }

  get body(): Locator {
    return this.page.getByPlaceholder('Write your article (in markdown)');
  }

  get tags(): Locator {
    return this.page.getByPlaceholder('Enter tags');
  }

  get publish(): Locator {
    return this.page.getByRole('button', { name: 'Publish Article' });
  }

  /**
   * Opens the editor, and refuses to wait thirty seconds for a form the guard already turned away.
   *
   * ⚠️ Written after making the mistake it catches. Three tests here asked for `editorPage` and
   * forgot to ask for `signedIn`, so the guard redirected to `/` and each failed with
   * `waiting for getByPlaceholder('Article Title')` — thirty seconds spent, and a message naming a
   * field rather than the missing session. The check below turns the same mistake into an
   * immediate error that says what actually happened.
   *
   * 🔑 The general form: **when a page can redirect, waiting for its content is the wrong oracle.**
   * The absence of a field is a consequence, and a report built out of consequences is what makes
   * a suite expensive to read.
   */
  async open(): Promise<void> {
    await this.page.goto('/editor');

    if (!new URL(this.page.url()).pathname.startsWith('/editor')) {
      throw new Error(
        `The editor redirected to ${this.page.url()} instead of opening. This page is behind an ` +
          `auth guard: ask for the \`signedIn\` fixture, not just \`editorPage\`.`
      );
    }

    await this.title.waitFor();
  }

  /**
   * Fills the four fields. Each tag is committed with Enter, which is how the widget turns typed
   * text into a chip — typing alone leaves it in the input and it is dropped on submit.
   */
  async fill(article: NewArticle): Promise<void> {
    await test.step(`fill the editor with "${article.title}"`, async () => {
      await this.title.fill(article.title);
      await this.description.fill(article.description);
      await this.body.fill(article.body);

      for (const tag of article.tagList) {
        await this.tags.fill(tag);
        await this.tags.press('Enter');
      }
    });
  }

  /**
   * Publishes, and returns the slug the server assigned.
   *
   * ⚠️ The request goes to `/api/articles/` — **with a trailing slash**. A predicate written as
   * `url.endsWith('/api/articles')` matches nothing and the wait times out thirty seconds later
   * with no hint as to why; that happened once during reconnaissance and cost the time it takes to
   * re-run with every request logged. Matching on the path segment rather than on an exact string
   * survives the slash either way.
   *
   * The slug is read from the response and not from the URL bar, because the URL is what the app
   * decided to navigate to and the slug is what the server decided to store. A test that wants to
   * check the two agree needs them from two sources.
   */
  async publishArticle(article: NewArticle): Promise<{ status: number; slug: string }> {
    return test.step(`publish "${article.title}"`, async () => {
      await this.fill(article);

      const [response] = await Promise.all([
        this.page.waitForResponse(
          (candidate) =>
            /\/api\/articles\/?$/.test(new URL(candidate.url()).pathname) &&
            candidate.request().method() === 'POST'
        ),
        this.publish.click(),
      ]);

      const status = response.status();
      if (status !== 200 && status !== 201) {
        return { status, slug: '' };
      }

      const body = (await response.json()) as { article?: { slug?: string } };

      return { status, slug: body.article?.slug ?? '' };
    });
  }
}
