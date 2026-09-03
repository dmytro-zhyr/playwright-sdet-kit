import type { APIRequestContext, APIResponse } from '@playwright/test';
import { stripLeadingSlash } from '@deployments/url';

export type ApiResponse = { status: number; body: unknown };

/**
 * A thin client over Playwright's APIRequestContext.
 *
 * It deliberately does five things and no more: it normalises the path so the base path is
 * preserved, it attaches the token when there is one, it backs off and asks again while the target
 * says it is being asked too often, it returns the status alongside an untyped body, and it refuses
 * a response that says the target would not serve us at all.
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
 * 429 is in that list, but it is reached only after backing off first — see `send` below.
 *
 * 🔑 429 and the three gateway statuses are not the same kind of answer, and treating them alike
 * was leaving CI red for a reason nobody could act on. **429 means "you, slow down", and the
 * protocol says what to do about it**: wait, then ask again. A client that does not is simply an
 * incorrect client. **502, 503 and 504 mean "we are broken"** — retrying those in process only
 * postpones a truthful red, so they still fail on the first answer.
 *
 * ⚠️ This is strictly better than the retry that already existed. `retries: 1` in the Playwright
 * config re-runs the whole test, which registers accounts again and sends **more** traffic at a
 * target that has just asked for less. Backing off inside one request does the opposite.
 */
const RATE_LIMITED = 429;

/** How the client waits, and how many times it asks. Injected so a test does not sit through it. */
export type RetryPolicy = {
  /** Total attempts including the first. 1 disables the retry entirely. */
  attempts: number;
  pause: (ms: number) => Promise<void>;
};

const DEFAULT_RETRY: RetryPolicy = {
  attempts: 4,
  pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

const BACKOFF_BASE_MS = 500;
const BACKOFF_CAP_MS = 5_000;

/**
 * How long to wait before asking again.
 *
 * `Retry-After` is honoured when the target sends one, because a number the server chose beats a
 * number we guessed. ⚠️ Only the delta-seconds form is read; the header may also carry an HTTP
 * date, and rather than half-parse that this falls back to the backoff below. Whichever is used,
 * the wait is capped — a target asking for an hour is a target this run is not going to reach.
 */
function backoffMs(retryAfter: string | undefined, attempt: number): number {
  const seconds = Number(retryAfter);
  if (retryAfter !== undefined && Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, BACKOFF_CAP_MS);
  }
  return Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_CAP_MS);
}

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
    private readonly token?: string,
    private readonly retry: RetryPolicy = DEFAULT_RETRY
  ) {}

  withToken(token: string): ConduitClient {
    return new ConduitClient(this.request, token, this.retry);
  }

  async get(path: string): Promise<ApiResponse> {
    return this.send(() => this.request.get(stripLeadingSlash(path), { headers: this.headers() }));
  }

  async post(path: string, data: unknown): Promise<ApiResponse> {
    return this.send(() =>
      this.request.post(stripLeadingSlash(path), { headers: this.headers(), data })
    );
  }

  async put(path: string, data: unknown): Promise<ApiResponse> {
    return this.send(() =>
      this.request.put(stripLeadingSlash(path), { headers: this.headers(), data })
    );
  }

  async del(path: string): Promise<ApiResponse> {
    return this.send(() =>
      this.request.delete(stripLeadingSlash(path), { headers: this.headers() })
    );
  }

  /**
   * Issues the request, and asks again while the answer is "too many requests".
   *
   * The request is a thunk rather than a response because a retry has to send it again. The last
   * attempt goes through `wrap` like any other, so a 429 that survives the backoff still ends as
   * `Target unavailable` — the report tells the same story it always did, just less often.
   */
  private async send(issue: () => Promise<APIResponse>): Promise<ApiResponse> {
    for (let attempt = 0; ; attempt++) {
      const response = await issue();

      const lastAttempt = attempt >= this.retry.attempts - 1;
      if (response.status() !== RATE_LIMITED || lastAttempt) return this.wrap(response);

      await this.retry.pause(backoffMs(response.headers()['retry-after'], attempt));
    }
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
