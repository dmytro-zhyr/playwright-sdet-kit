import { test, expect } from '@fixtures';

/**
 * Registration through the browser — the first tests of the UI layer, and the seed file the
 * Playwright generator agent is pointed at.
 *
 * ⚠️ `npx playwright init-agents` wrote its own seed into `tests/contract/` — a `test('seed')`
 * with an empty body and the comment `// generate code here.`. It was deleted rather than kept:
 * a test that asserts nothing, sitting inside the gate suite, is the exact thing this repository
 * exists to refuse, and its greenness would have been counted in the gate's own pass rate. A seed
 * exists to show a generator the fixtures and conventions of the project, and a real test does
 * that better than an empty one.
 *
 * The target is conduit-overstrict, named by the `ui` project in playwright.config.ts. Its
 * uniqueness enforcement is genuine — which is worth stating, because the same two scenarios are
 * documented as **defects** D-1 and D-2 on conduit-unsound. The same behaviour is correct on one
 * deployment and broken on another, and only a named deployment lets both facts live in one repo.
 */
test.describe('Registration', () => {
  // Turns red if a new account stops being created, or stops being signed in on creation. The
  // assertion is on the navigation rather than on the URL: landing on `/` proves routing, while
  // the header naming the account proves the session belongs to the user who just registered.
  test('a new account is created and signed in', async ({ page, registerPage, factories }) => {
    const user = factories.user.build();

    await registerPage.open();
    const status = await registerPage.signUp(user);

    expect(status, 'the server rejected a registration it should have accepted').toBe(201);

    await page.waitForURL('**/');
    await expect(registerPage.nav.profile(user.username)).toBeVisible();
    await expect(registerPage.nav.newArticle).toBeVisible();
    await expect(
      registerPage.nav.signIn,
      'the header still offers Sign in, so the session did not take'
    ).toBeHidden();
  });

  // Turns red if uniqueness stops being enforced here — the defect D-1 and D-2 document on
  // conduit-unsound. Registering the same account twice must fail, and must say why: an app that
  // rejects silently is indistinguishable from one that is broken.
  test('registering the same account twice is rejected, and says why', async ({
    page,
    registerPage,
    factories,
  }) => {
    const user = factories.user.build();

    await registerPage.open();
    expect(await registerPage.signUp(user)).toBe(201);
    await page.waitForURL('**/');

    // A second, independent browser session. Clearing the token is what makes the second attempt
    // an unauthenticated registration rather than a signed-in user re-submitting a form.
    await page.evaluate(() => localStorage.clear());
    await registerPage.open();
    const status = await registerPage.signUp(user);

    expect(status, 'a duplicate registration was accepted').not.toBe(201);
    await expect(registerPage.errors).toContainText([
      'email has already been taken',
      'username has already been taken',
    ]);
    await expect(page, 'a rejected registration navigated away instead of staying put').toHaveURL(
      /\/register$/
    );
  });

  // Turns red if the submit button stops being gated on the three fields being non-empty.
  //
  // 🔑 The last assertion is the point of the test, and it is not a bug report. The button enables
  // on a **malformed** email, so the gate is "all three fields have something in them", not "the
  // input is valid" — observed, not assumed. Writing it down is what stops a later test from
  // asserting client-side email validation that was never there.
  test('the submit button is gated on the fields being filled, not on them being valid', async ({
    registerPage,
    factories,
  }) => {
    const user = factories.user.build();

    await registerPage.open();
    await expect(registerPage.submit).toBeDisabled();

    await registerPage.username.fill(user.username);
    await registerPage.email.fill(user.email);
    await expect(
      registerPage.submit,
      'the button enabled before the last field was filled'
    ).toBeDisabled();

    await registerPage.password.fill(user.password);
    await expect(registerPage.submit).toBeEnabled();

    await registerPage.email.fill('not-an-email');
    await expect(
      registerPage.submit,
      'the form now validates the email client-side; the observation this test records has changed'
    ).toBeEnabled();
  });
});
