import type { Locator, Page } from '@playwright/test';

/**
 * The header, which every page carries and no page owns.
 *
 * Injected into the page objects rather than inherited by them. The distinction is worth keeping:
 * inheritance would say every page *is* a navigation bar, and the first page that renders two of
 * something — a list of article cards, say — would have nowhere to put the second. Composition
 * says a page *has* one, and may have several.
 *
 * 📌 **Why it lives in `po/components/` and is not called `NavigationComponent`.** Fowler declines
 * to give this a pattern of its own, and argues the opposite way round: that "page object" was
 * always the misleading name, since it suggests one object per page, and that objects should be
 * built for the significant elements of a page rather than for pages. So this is a page object of
 * a panel, not a different species — the thing worth stating is that it is **composed in**, and
 * the directory states it once instead of every import restating it in a suffix. `Navigation` and
 * not `Nav` for the reason `deployments/registry.ts` gives about deployment names: a name is not
 * an abbreviation.
 *
 * It exposes locators and one question, and asserts nothing. An expectation written inside a
 * component cannot be read at the call site: the test would say `await nav.checkSignedIn()` and
 * the report would name the component, not the behaviour under test.
 */
export class Navigation {
  constructor(private readonly page: Page) {}

  /**
   * The header itself.
   *
   * 🔴 Not `getByRole('navigation')` on its own. The home page renders **two** `<nav>` elements:
   * this header, and the feed pagination. That was found by a reconnaissance probe on 30 August
   * 2026, not by a test — the three registration tests were green throughout, because none of
   * their locators happened to match anything inside the pagination nav. A page object narrowed
   * by luck is the kind that breaks on the first test that is not lucky.
   *
   * The filter is role-based rather than a `.navbar` class, and it says something true about the
   * page: the header is the navigation that carries the brand link, and the pagination is not.
   */
  private get root(): Locator {
    return this.page
      .getByRole('navigation')
      .filter({ has: this.page.getByRole('link', { name: 'conduit', exact: true }) });
  }

  /** Present for everyone, signed in or not. */
  get homeLink(): Locator {
    return this.root.getByRole('link', { name: 'Home', exact: true });
  }

  /** Signed out only. Their absence is how a test says "this session is authenticated". */
  get signInLink(): Locator {
    return this.root.getByRole('link', { name: 'Sign in' });
  }

  get signUpLink(): Locator {
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
  get newArticleLink(): Locator {
    return this.root.getByRole('link', { name: 'New Article' });
  }

  get settingsLink(): Locator {
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
  profileLink(username: string): Locator {
    return this.root.getByRole('link', { name: username, exact: true });
  }

  /**
   * Home by **clicking**, which is the second way to reach a page and the one a person uses.
   *
   * 🔑 Click-driven navigation belongs to the page you are leaving, not to the one you arrive at:
   * the control is the header's, so the method is the header's. A destination reached by address
   * answers `goto()` on the destination itself. See CONVENTIONS.md, "Two ways to reach a page".
   */
  async goHome(): Promise<void> {
    await this.homeLink.click();
    await this.page.waitForURL('**/');
  }
}
