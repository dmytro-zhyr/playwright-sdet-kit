import { test } from '@playwright/test';
import type { Page, Response } from '@playwright/test';

/**
 * Waits for the application's own request, and names it in the report:
 * `Wait for POST /api/users/login` instead of Playwright's `Wait for event "response"`, which says
 * nothing because the condition is a function. Start it together with the action that causes the
 * request — `Promise.all([waitForApi(…), button.click()])` — so it is listening before the request
 * goes out.
 *
 * A path matches the end of the response's pathname, a trailing slash aside, so it holds under a
 * deployment that serves the API below a prefix. Several paths match any of them: a feed is
 * `/api/articles` or `/api/articles/feed` depending on the tab.
 */
export function waitForApi(page: Page, method: string, ...paths: string[]): Promise<Response> {
  return test.step(`Wait for ${method} ${paths.join(' or ')}`, () =>
    page.waitForResponse((candidate) => {
      const pathname = new URL(candidate.url()).pathname.replace(/\/$/u, '');
      return (
        candidate.request().method() === method && paths.some((path) => pathname.endsWith(path))
      );
    }));
}
