import { test, expect } from '@fixtures';

/**
 * Signing in through the form.
 *
 * The account is created over the API and the form is then driven with credentials that are known
 * to be good — which is what makes a failure here mean "sign-in is broken" rather than "sign-up is
 * broken". A test that registers through the form and then logs in through the form cannot say
 * which of the two failed.
 */
test.describe('Sign in', () => {
  // Turns red if a valid sign-in stops producing a session. The header naming the account is the
  // assertion, not the redirect: landing on `/` only proves the router ran.
  test('valid credentials sign the user in', async ({ page, loginPage, uiAccount }) => {
    await loginPage.open();
    const status = await loginPage.signIn(uiAccount.user.email, uiAccount.user.password);

    expect(status, 'the server refused credentials it had just issued').toBe(200);

    await page.waitForURL('**/');
    await expect(loginPage.nav.profile(uiAccount.user.username)).toBeVisible();
    await expect(loginPage.nav.signIn).toBeHidden();
  });

  // Turns red if a wrong password stops being refused, and — the half that matters more — if it
  // stops being refused *out loud*. An app that rejects silently is indistinguishable from one
  // that is broken, and a user cannot tell the two apart either.
  test('a wrong password is refused, and the page says so', async ({
    page,
    loginPage,
    uiAccount,
  }) => {
    await loginPage.open();
    const status = await loginPage.signIn(uiAccount.user.email, 'not-the-password');

    expect(status, 'a wrong password was accepted').not.toBe(200);
    await expect(loginPage.errors).toHaveCount(1);
    await expect(page, 'a refused sign-in navigated away instead of staying put').toHaveURL(
      /\/login$/
    );
    await expect(
      loginPage.nav.signIn,
      'the header shows a session after a refused sign-in'
    ).toBeVisible();
  });

  // Turns red if the submit button stops being gated on both fields carrying something. Same
  // observation as on the sign-up form, asserted separately: the two forms are different
  // components and one of them can lose the behaviour without the other noticing.
  test('the submit button is gated on both fields being filled', async ({ loginPage }) => {
    await loginPage.open();
    await expect(loginPage.submit).toBeDisabled();

    await loginPage.email.fill('someone@example.com');
    await expect(loginPage.submit, 'the button enabled with no password').toBeDisabled();

    await loginPage.password.fill('something');
    await expect(loginPage.submit).toBeEnabled();
  });
});
