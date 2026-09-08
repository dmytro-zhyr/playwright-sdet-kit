import { test, expect } from '@fixtures';

/**
 * The header links, driven by clicking.
 *
 * 🔑 **Written because four members of `Navigation` had no caller**, which this repository treats
 * as dead code rather than as spare capacity — the same standard that kept four other navigation
 * methods from being written at all (PLAN-PO.md, P4). `goHome()` was the sharper case: two
 * documents hold it up as the worked example of the `goto` / `go…` rule, and it was exercised by
 * nothing. Measured 08.09.2026.
 *
 * 📌 **What it actually asks is whether the links work**, which no other test does. Every other UI
 * test reaches its page by address, because that is faster and because a chain of clicks is a
 * worse setup. This is the one place the chain itself is the subject.
 */
test.describe('The header', () => {
  // Turns red if a signed-out visitor cannot reach the two forms from the header, or if Home stops
  // returning from them. Sign in and Sign up are the only route a new visitor has.
  test('takes a signed-out visitor to the forms and back', async ({ page, homePage }) => {
    await homePage.goto();

    await homePage.nav.signInLink.click();
    await expect(page, 'Sign in must lead to the login form').toHaveURL(/\/login$/u);

    await homePage.nav.goHome();

    await homePage.nav.signUpLink.click();
    await expect(page, 'Sign up must lead to the registration form').toHaveURL(/\/register$/u);
  });

  // Turns red if the signed-in header stops leading where it says. The profile link is addressed by
  // the username the account was registered with, so this also catches a header that renders
  // somebody else's name — the failure `profileLink(username)` takes an argument for.
  test('takes a signed-in user to settings, the editor and their profile', async ({
    page,
    homePage,
    signedIn,
  }) => {
    await homePage.goto();

    await homePage.nav.settingsLink.click();
    await expect(page, 'Settings must lead to the settings page').toHaveURL(/\/settings$/u);

    await homePage.nav.newArticleLink.click();
    await expect(page, 'New Article must lead to the editor').toHaveURL(/\/editor$/u);

    await homePage.nav.profileLink(signedIn.user.username).click();
    await expect(page, 'the profile link must lead to the account it names').toHaveURL(
      new RegExp(`/profile/${signedIn.user.username}$`, 'u')
    );
  });
});
