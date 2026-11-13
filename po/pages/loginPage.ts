import { test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { Navigation } from '@po/components/navigation';

/** `/login` — the sign-in form. Two fields where `/register` has three, and the same error list. */
export class LoginPage {
  readonly nav: Navigation;

  constructor(private readonly page: Page) {
    this.nav = new Navigation(page);
  }

  private get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Sign in' }).describe('"Sign in" heading');
  }

  get emailField(): Locator {
    return this.page.getByPlaceholder('Email').describe('"Email" field');
  }

  get passwordField(): Locator {
    return this.page.getByPlaceholder('Password').describe('"Password" field');
  }

  get signInButton(): Locator {
    return this.page.getByRole('button', { name: 'Sign in' }).describe('[Sign in]');
  }

  get errorMessages(): Locator {
    return this.page.locator('.error-messages li').describe('Error messages');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.heading.waitFor();
  }

  private async fillCredentials(email: string, password: string): Promise<void> {
    await this.emailField.fill(email);
    await this.passwordField.fill(password);
  }

  /** Fills both fields and submits, returning the status the server answered with. */
  async signIn(email: string, password: string): Promise<number> {
    return test.step(`Sign in as '${email}'`, async () => {
      await this.fillCredentials(email, password);

      const [response] = await Promise.all([
        this.page.waitForResponse(
          (candidate) =>
            candidate.url().endsWith('/api/users/login') && candidate.request().method() === 'POST'
        ),
        this.signInButton.click(),
      ]);

      return response.status();
    });
  }
}
