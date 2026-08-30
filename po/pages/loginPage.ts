import { test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { Navigation } from '@po/components/navigation';

/** `/login` — the sign-in form. Two fields where `/register` has three, and the same error list. */
export class LoginPage {
  readonly nav: Navigation;

  constructor(private readonly page: Page) {
    this.nav = new Navigation(page);
  }

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Sign in' });
  }

  get email(): Locator {
    return this.page.getByPlaceholder('Email');
  }

  get password(): Locator {
    return this.page.getByPlaceholder('Password');
  }

  get submit(): Locator {
    return this.page.getByRole('button', { name: 'Sign in' });
  }

  get errors(): Locator {
    return this.page.locator('.error-messages li');
  }

  async open(): Promise<void> {
    await this.page.goto('/login');
    await this.heading.waitFor();
  }

  async fill(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
  }

  /** Fills both fields and submits, returning the status the server answered with. */
  async signIn(email: string, password: string): Promise<number> {
    return test.step(`sign in as ${email}`, async () => {
      await this.fill(email, password);

      const [response] = await Promise.all([
        this.page.waitForResponse(
          (candidate) =>
            candidate.url().endsWith('/api/users/login') && candidate.request().method() === 'POST'
        ),
        this.submit.click(),
      ]);

      return response.status();
    });
  }
}
