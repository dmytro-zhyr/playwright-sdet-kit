import { test, expect } from '@/fixtures';

/**
 * Publishing an article through the editor.
 *
 * Every test here signs in through `signedIn`, which creates the account over the API and seeds
 * the token before the app boots. Only publishing is driven through the interface, because only
 * publishing is what these tests are about.
 */
test.describe('Publishing an article', () => {
  // Turns red if publishing stops working end to end. Three sources are checked against each
  // other on purpose: the response says what the server stored, the URL says where the app
  // decided to go, and the page says what the reader is shown. A test reading only one of the
  // three cannot tell "it was saved" from "it was displayed".
  test('an article is published and shown to its author', async ({
    page,
    editorPage,
    articlePage,
    signedIn,
    factories,
  }) => {
    const article = factories.article.build();

    await editorPage.open();
    const { status, slug } = await editorPage.publishArticle(article);

    expect(status, 'the server refused an article it should have accepted').toBe(201);
    expect(slug, 'the response carried no slug').not.toBe('');

    await expect(page).toHaveURL(new RegExp(`/article/${slug}$`));
    await expect(articlePage.title).toHaveText(article.title);
    await expect(articlePage.body).toContainText(article.body.split('\n')[0]);
    await expect(articlePage.author(signedIn.user.username)).toBeVisible();
  });

  // Turns red if the author stops being offered the controls only an author has. This is the
  // page's own answer to "does this session own this article", so it is worth asking of the page
  // rather than inferring it from the fact that we just published it.
  test('its author is offered edit and delete', async ({
    editorPage,
    articlePage,
    signedIn,
    factories,
  }) => {
    await editorPage.open();
    const { slug } = await editorPage.publishArticle(factories.article.build());

    await articlePage.open(slug);

    await expect(articlePage.author(signedIn.user.username)).toBeVisible();
    await expect(articlePage.edit).toBeVisible();
    await expect(articlePage.delete).toBeVisible();
  });

  // Turns red if a published article stops appearing in the global feed. The card is addressed by
  // slug rather than by title: nothing in the specification forbids two articles sharing a title,
  // and a locator that cannot tell them apart would happily pass on somebody else's.
  test('it appears in the global feed', async ({ editorPage, homePage, signedIn, factories }) => {
    const article = factories.article.build();

    await editorPage.open();
    const { slug } = await editorPage.publishArticle(article);

    await homePage.open();

    await expect(homePage.card(slug)).toBeVisible();
    await expect(homePage.card(slug)).toContainText(article.title);
    await expect(homePage.card(slug)).toContainText(signedIn.user.username);
  });

  // 🔑 Not a bug report — a record of what the application does. A tag typed as `qa` comes back as
  // `QA`, from the server: the POST response carries `tagList: ["QA"]`. Writing it down is what
  // stops a later test from asserting the tag it typed and being right by accident on a lower-case
  // input, or wrong for a reason nobody can find on a mixed-case one.
  test('a tag is stored upper-cased, not as typed', async ({
    editorPage,
    articlePage,
    signedIn,
    factories,
  }) => {
    const article = factories.article.build({ tagList: ['qa'] });

    await editorPage.open();
    const { slug } = await editorPage.publishArticle(article);

    await articlePage.open(slug);

    await expect(
      articlePage.tags,
      'the application no longer upper-cases tags; the observation this test records has changed'
    ).toHaveText(['QA']);
  });

  // Turns red if the guard on /editor is lifted. An anonymous visitor must not reach the form,
  // and the failure a test wants here is a redirect it can name — not a locator timing out on a
  // field that was never going to render.
  test('an anonymous visitor is turned away from the editor', async ({ page, editorPage }) => {
    await page.goto('/editor');

    await expect(page, 'the editor is reachable without a session').toHaveURL(/\/$/);
    await expect(editorPage.title).toBeHidden();
  });
});
