import type { APIRequestContext, APIResponse } from '@playwright/test';
import { stripLeadingSlash } from '@deployments/url';

export type ApiResponse = { status: number; body: unknown };

/**
 * A thin client over Playwright's APIRequestContext.
 *
 * It deliberately does three things and no more: it normalises the path so the base path is
 * preserved, it attaches the token when there is one, and it returns the status alongside an
 * untyped body. It never throws on a non-2xx response, because contract tests exist precisely to
 * assert 401, 404 and 422.
 *
 * Tests pass spec-shaped paths — `/tags`, `/users`, `/articles/:slug`.
 */
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
    return { status: response.status(), body };
  }
}
