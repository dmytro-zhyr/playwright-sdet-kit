import { test, expect } from '@fixtures';

/**
 * Request interception — and the boundary that decides when it is the wrong tool.
 *
 * Playwright offers three ways to get at network traffic, and they sit on one axis: **does this
 * need to change anything?**
 *
 * | | What it is | Blocks the request | Can change it |
 * |---|---|---|---|
 * | `page.waitForResponse(pred)` | one awaited response | no | no |
 * | `page.on('response', fn)` | a stream of events | no | no |
 * | `page.route(glob, fn)` | a handler **in the request path** | **yes** | **yes** |
 *
 * 🔑 **The rule is the least invasive tool that answers the question.** `route` pauses the request
 * until the handler resolves it — `continue`, `fulfill`, `abort` or `fetch` — so a handler that
 * forgets to do that does not slow a test down, it hangs it. The two observers cannot break
 * anything, because nothing waits on them.
 *
 * ⛔ **So interception is not the default, and this suite does not treat it as one.** Its value is
 * that it runs against three live deployments and reports what they actually do; stubbing by habit
 * would throw that away and leave a suite that tests its own fixtures. The observing half is
 * already here five times over, in the page objects, where waiting on a response is the honest
 * tool: `homePage.goto`, `homePage.openFeedTab`, `loginPage.signIn`, `registerPage`, `editorPage`.
 *
 * ✅ **What earns interception is a state reality will not produce on demand.** A live deployment
 * does not serve an empty global feed to order, and it does not fail on request. That is the whole
 * of the case for the first test below.
 *
 * ⚠️ **The second test does not intercept at all, and that is the point.** It asks what the
 * application *sends*, and a listener answers that without standing in the request's way. Reaching
 * for `route.continue()` there would block every login request in order to read one — an
 * interceptor doing an observer's job.
 *
 * 🔑 **`page.waitForRequest` is not the answer either**, and the reason is the assertion rather
 * than style: it resolves on the first match and stops listening, so a form that submitted twice
 * would pass. A listener stays — measured at five firings across two navigations — which is what
 * makes `toHaveLength(1)` a claim about the application instead of a formality.
 */
test.describe('Request interception', () => {
  // Turns red if the empty state stops rendering — which is invisible against a live deployment,
  // because the global feed on this target always has articles in it. The payload is the shape the
  // specification defines for a list response, so this asserts the application against the
  // contract rather than against a fixture invented here.
  test('an empty feed renders the notice instead of nothing', async ({ page, homePage }) => {
    await page.route('**/api/articles*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ articles: [], articlesCount: 0 }),
      })
    );

    await homePage.goto();

    await expect(
      homePage.emptyFeedNotice,
      'a feed with no articles must say so rather than render an empty page'
    ).toBeVisible();
    await expect(
      homePage.articleCards,
      'no article card may survive a response that carried no articles'
    ).toHaveCount(0);
  });

  // Turns red if the sign-in form starts sending something other than what it was given — a
  // renamed field, a trimmed value, an envelope that changed shape. Nothing else in this suite
  // watches the request itself: every other test reads what came back, which is one step too late
  // to say who was wrong when a login fails.
  //
  // An array rather than one variable, and for a reason the report can use: a variable keeps the
  // last request, an array keeps how many there were. A form that submits twice is a defect this
  // suite would otherwise never see.
  test('the sign-in form sends the credentials it was given', async ({
    page,
    loginPage,
    uiAccount,
  }) => {
    const sent: string[] = [];

    // Not `await` — a listener registers synchronously. Only `route` travels to the browser.
    page.on('request', (request) => {
      if (request.url().endsWith('/api/users/login') && request.method() === 'POST') {
        const body = request.postData();
        if (body !== null) sent.push(body);
      }
    });

    await loginPage.goto();
    const status = await loginPage.signIn(uiAccount.user.email, uiAccount.user.password);

    expect(
      status,
      'the account was registered over the API moments before, so login must succeed'
    ).toBe(200);
    expect(sent, 'the form must send exactly one login request').toHaveLength(1);
    expect(
      JSON.parse(sent[0] ?? 'null'),
      'the request body must carry the credentials the form was given, under the envelope the API defines'
    ).toEqual({
      user: { email: uiAccount.user.email, password: uiAccount.user.password },
    });
  });
});
