import { test, expect } from '@fixtures';

/**
 * The feed toggle on the home page.
 *
 * The first tests to touch it, and they exist for a reason beyond coverage: the toggle is the one
 * control in this application that a role-first locator cannot address at all — the tabs are `<a>`
 * elements with no `href`, so they have no role, no focus and no `aria-selected`. Everything the
 * page says about which feed is showing is a CSS class. See `po/pages/homePage.ts` and
 * spec/FINDINGS.md, "The feed toggle is not what it looks like".
 */
test.describe('The feed toggle', () => {
  // Turns red if a brand-new account stops seeing an empty personal feed — which would mean either
  // that Your Feed has started showing articles from people the account does not follow, or that
  // the tab no longer switches at all. `signedIn` creates the account over the API moments before,
  // so "follows nobody" is not an assumption about the deployment's data: it is a fact about an
  // account that has existed for one second.
  test('a new account sees nothing in Your Feed', async ({ homePage, signedIn }) => {
    expect(signedIn.user.username, 'the session fixture produced no account').toBeTruthy();

    await homePage.goto();
    await homePage.openFeedTab('Your Feed');

    await expect(
      homePage.articleCards,
      'a new account, which follows nobody, was shown articles in its personal feed'
    ).toHaveCount(0);

    await expect(
      homePage.emptyFeedNotice,
      'the feed is empty and the page says nothing about it'
    ).toBeVisible();
  });

  // Turns red if switching away from Global Feed stops deselecting it. Selection is carried by a
  // single class and nothing else, so "the tab I clicked is active" and "the tab I left is not"
  // are two separate claims — an application that added `active` without removing the old one
  // would pass the first and fail this.
  test('selecting a tab deselects the one before it', async ({ homePage, signedIn }) => {
    expect(signedIn.user.username, 'the session fixture produced no account').toBeTruthy();

    await homePage.goto();
    await expect(homePage.activeFeedTab('Global Feed')).toBeVisible();

    await homePage.openFeedTab('Your Feed');

    await expect(
      homePage.activeFeedTab('Global Feed'),
      'two feeds are selected at once'
    ).toHaveCount(0);
  });
});
