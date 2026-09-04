import { test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { Navigation } from '@po/components/navigation';
import type { UserCreateInput } from '@data/userFactory';

/**
 * `/register` — the sign-up form.
 *
 * The page object exposes locators and business-level actions; every expectation stays in the
 * test. `signUp` is a business-level method in the sense the framework notes use the term: it
 * names what a person is doing, not which three fields get typed into in which order.
 */
export class RegisterPage {
  readonly nav: Navigation;

  constructor(private readonly page: Page) {
    this.nav = new Navigation(page);
  }

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Sign up' });
  }

  get usernameField(): Locator {
    return this.page.getByPlaceholder('Username');
  }

  get emailField(): Locator {
    return this.page.getByPlaceholder('Email');
  }

  get passwordField(): Locator {
    return this.page.getByPlaceholder('Password');
  }

  get signUpButton(): Locator {
    return this.page.getByRole('button', { name: 'Sign up' });
  }

  /**
   * The list the server's rejections are rendered into — `email has already been taken` and the
   * like, one `<li>` each. Observed on 30 August 2026 against conduit-overstrict.
   *
   * A locator, not a getter that reads the text: the difference decides whether an empty list can
   * be asserted on. `expect(page.errorMessages).toHaveCount(0)` waits and retries; a string read once
   * cannot, and would pass simply by looking too early.
   */
  get errorMessages(): Locator {
    return this.page.locator('.error-messages li');
  }

  async goto(): Promise<void> {
    await this.page.goto('/register');
    await this.heading.waitFor();
  }

  /** Types the three fields and leaves the form untouched otherwise. Submits nothing. */
  async fillRegistration(user: UserCreateInput): Promise<void> {
    await test.step(`fill the sign-up form as ${user.username}`, async () => {
      await this.usernameField.fill(user.username);
      await this.emailField.fill(user.email);
      await this.passwordField.fill(user.password);
    });
  }

  /**
   * Fills the form and submits it, returning when the server has answered.
   *
   * ⛔ It waits for the **response**, not for `networkidle`. That is not a style preference: the
   * first reconnaissance script for this stage used `waitForLoadState('networkidle')` and reported
   * that the form locks up and never recovers. It does not. The snapshot was taken while the
   * fields were disabled mid-submit, before the app routed away, and a second probe watching the
   * network showed a clean 201 followed by the redirect. The oracle was wrong, not the target —
   * see spec/FINDINGS.md, "The first UI finding was about the test, not the page".
   *
   * Waiting on the response is answerable: it happens once, it carries a status, and it cannot be
   * satisfied early by a quiet moment on the wire.
   */
  async signUp(user: UserCreateInput): Promise<number> {
    return test.step(`sign up as ${user.username}`, async () => {
      await this.fillRegistration(user);

      const [response] = await Promise.all([
        this.page.waitForResponse(
          (candidate) =>
            candidate.url().endsWith('/api/users') && candidate.request().method() === 'POST'
        ),
        this.signUpButton.click(),
      ]);

      return response.status();
    });
  }
}
