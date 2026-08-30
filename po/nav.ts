import type { Locator, Page } from '@playwright/test';

/**
 * The header, which every page carries and no page owns.
 *
 * A **component object**, injected into the page objects rather than inherited by them. The
 * distinction is worth keeping: inheritance would say every page *is* a navigation bar, and the
 * first page that renders two of something — a list of article cards, say — would have nowhere to
 * put the second. Composition says a page *has* one, and a page may have several.
 *
 * It exposes locators and one question, and asserts nothing. An expectation written inside a
 * component cannot be read at the call site: the test would say `await nav.checkSignedIn()` and
 * the report would name the component, not the behaviour under test.
 */
export class Nav {
  private readonly root: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByRole('navigation');
  }

  /** Present for everyone, signed in or not. */
  get home(): Locator {
    return this.root.getByRole('link', { name: 'Home', exact: true });
  }

  /** Signed out only. Their absence is how a test says "this session is authenticated". */
  get signIn(): Locator {
    return this.root.getByRole('link', { name: 'Sign in' });
  }

  get signUp(): Locator {
    return this.root.getByRole('link', { name: 'Sign up' });
  }

  /**
   * Signed in only.
   *
   * ⚠️ The accessible names are ` New Article` and ` Settings` — with a leading space, because an
   * icon element sits inside the link before the text. `exact: true` would therefore never match,
   * and matching on the substring is not a shortcut here but the accurate reading of what the page
   * renders. Observed 30 August 2026; see spec/FINDINGS.md, "UI reconnaissance".
   */
  get newArticle(): Locator {
    return this.root.getByRole('link', { name: 'New Article' });
  }

  get settings(): Locator {
    return this.root.getByRole('link', { name: 'Settings' });
  }

  /**
   * The link to the signed-in user's own profile, addressed by the username it should be showing.
   *
   * Taking the username as an argument rather than returning "whatever the last link says" is
   * deliberate. A locator built from the page's own text can only ever confirm that the page
   * agrees with itself; a test that passes the name it registered is asking a question the page
   * can answer wrongly — which is the only kind worth asking.
   */
  profile(username: string): Locator {
    return this.root.getByRole('link', { name: username, exact: true });
  }

  async goHome(): Promise<void> {
    await this.home.click();
    await this.page.waitForURL('**/');
  }
}
