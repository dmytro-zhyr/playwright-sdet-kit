import type { APIRequestContext, APIResponse } from '@playwright/test';
import { stripLeadingSlash } from '@deployments/url';

export type ApiResponse = { status: number; body: unknown };

/**
 * A thin client over Playwright's APIRequestContext.
 *
 * It deliberately does four things and no more: it normalises the path so the base path is
 * preserved, it attaches the token when there is one, it returns the status alongside an untyped
 * body, and it refuses a response that says the target would not serve us at all.
 *
 * It does **not** throw on an ordinary non-2xx response, because contract tests exist precisely to
 * assert 401, 404 and 422 — and `tests/defects/schemas.spec.ts` asserts a 500, which is why 500 is
 * not in the list below. A server fault is behaviour of the application under test. Being rate
 * limited or meeting a gateway is not behaviour at all.
 *
 * Tests pass spec-shaped paths — `/tags`, `/users`, `/articles/:slug`.
 */
/**
 * Statuses that mean the request never got a serviceable answer, so nothing it returns says
 * anything about the subject of the test.
 *
 * 🔑 500 is deliberately absent. It is a fault of the application, and D-7 documents the gate
 * deployment answering blank input with one — a test asserting that must be allowed to see it.
 */
const UNSERVICEABLE = [429, 502, 503, 504];

/**
 * The message every such failure carries, and the reason this is a function of the client rather
 * than a rule for test authors.
 *
 * `report/allure.ts` classifies failures, and its `Target unavailable` category matches on the
 * message. The comment there rejects message matching in general — "it would need each test to
 * phrase its failure a particular way, which is a convention, and conventions are not enforced" —
 * and that objection is answered here rather than ignored: no test phrases this. Every request in
 * the repository goes through one `wrap`, so the wording cannot drift and cannot be forgotten.
 *
 * ⛔ Keep this string and the regex in report/allure.ts in step. tests/unit/allureCategories.spec.ts
 * fails if they part company.
 */
export const TARGET_UNAVAILABLE = 'Target unavailable';

export class ConduitClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly token?: string
  ) {}

  withToken(token: string): ConduitClient {
    return new ConduitClient(this.request, token);
  }

  async get(path: string): Promise<ApiResponse> {
    return this.wrap(await this.request.get(stripLeadingSlash(path), { headers: this.headers() }));
  }

  async post(path: string, data: unknown): Promise<ApiResponse> {
    return this.wrap(
      await this.request.post(stripLeadingSlash(path), { headers: this.headers(), data })
    );
  }

  async put(path: string, data: unknown): Promise<ApiResponse> {
    return this.wrap(
      await this.request.put(stripLeadingSlash(path), { headers: this.headers(), data })
    );
  }

  async del(path: string): Promise<ApiResponse> {
    return this.wrap(
      await this.request.delete(stripLeadingSlash(path), { headers: this.headers() })
    );
  }

  private headers(): Record<string, string> {
    // Verified against the target: `Token` works, `Bearer` returns 401. See spec/FINDINGS.md.
    return this.token ? { Authorization: `Token ${this.token}` } : {};
  }

  private async wrap(response: APIResponse): Promise<ApiResponse> {
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      // Not JSON — hand back the raw text. What to do about it is the test's decision.
    }

    const status = response.status();

    // Thrown, not returned, for the same reason registerUser throws: a test that carries on with a
    // rate-limited response fails three steps later on something that is not what broke. Seen on
    // 31 August 2026, when a 429 on a delete was reported as a known defect of the target.
    if (UNSERVICEABLE.includes(status)) {
      throw new Error(
        `${TARGET_UNAVAILABLE}: HTTP ${status} from ${response.url()}. ` +
          'The request was refused or never reached the application, so this run says nothing ' +
          'about the behaviour under test. Re-run before reading anything into it.'
      );
    }

    return { status, body };
  }
}
