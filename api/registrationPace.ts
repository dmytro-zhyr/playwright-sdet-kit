/**
 * Keeps the suite under the gate's registration quota instead of discovering it.
 *
 * 🔑 **Why this exists at all, and why it is not more backoff.** `conduitClient` already reacts to
 * a 429: it waits and asks again, capped at five seconds, then reports `Target unavailable`. That
 * is the right behaviour for a target that is briefly busy. It is the wrong behaviour for a
 * **quota**, and on 15 September 2026 the difference was measured:
 *
 * ```
 * # 1  200   # 2  200   # 3  200   # 4  200   # 5  200
 * # 6  429   retry-after: 173
 * ```
 *
 * Five registrations, then a refusal that asks for **173 seconds**. No backoff inside a test can
 * honour that — the client's own comment says so: *"a target asking for an hour is a target this
 * run is not going to reach."* So the cap is correct and the reaction is correct; what was missing
 * is not asking for the sixth in the first place.
 *
 * ⚠️ **The quota is new.** The same suite ran green against the same target on 10 September with
 * all 31 registrations, in under three minutes. This is a change in the world, recorded in
 * spec/FINDINGS.md, not a flaw the suite was hiding.
 *
 * 🔴 **UNVERIFIED AGAINST THE TARGET — 15 September 2026.** The mechanism is right and its unit
 * tests are green; **the number is not confirmed**. A paced run waited out the full window exactly
 * as designed and the next registration was refused anyway — 175 seconds of silence, then 429.
 * So the window is longer than the `Retry-After` header suggested, and by how much is unknown.
 *
 * ⚠️ **And the measurement that produced 175 is contaminated.** By the time that run happened the
 * same target had absorbed a registration probe, a login probe and four contract suites in one
 * afternoon. Rate limiters commonly escalate, so `Retry-After: 173` — read from a rested target
 * that morning — may not describe the same target hours later. The next measurement has to be
 * taken on a target that has been left alone.
 *
 * 🔴 **And one possibility this does not yet rule out:** if the quota is per hour rather than per
 * few minutes, pacing cannot save this suite at all. 31 registrations at five an hour is six
 * hours. Pacing would then not be a fix but a slower way of failing.
 *
 * ⛔ **Registration only, never login.** Measured the same day: 40 logins in 49 seconds, all 200,
 * against the target that refuses a sixth registration. Throttling authentication would cost
 * minutes and buy nothing.
 */

import { quotaAt, type RegistrationQuota } from '@deployments/registry';

/** Time and waiting, injected — so a unit test does not sit through three minutes of it. */
export type Clock = {
  now: () => number;
  pause: (ms: number) => Promise<void>;
};

export const systemClock: Clock = {
  now: () => Date.now(),
  pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * A **fixed** window, not a sliding one — and the first version of this class got that wrong.
 *
 * 🔑 The distinction is not academic; it decides whether a test timeout can be chosen at all.
 *
 * - **Sliding:** each registration ages out on its own schedule, so exhausting the quota frees one
 *   slot at a time. A test making three registrations near a boundary waits three separate
 *   windows — about nine minutes — and no timeout survives that.
 * - **Fixed:** the window opens at the first registration and closes for everyone at once, so a
 *   single wait returns the whole allowance. **A test waits at most one window**, which is what
 *   makes `windowMs` plus a normal test budget a bound rather than a hope.
 *
 * ⚠️ And the measurement says the target is the second kind. The sixth request went out **8.9
 * seconds** after the first and was told to come back in **173**; a sliding window would have
 * asked for far less. So the window is about 182 seconds, and the value in the registry carries a
 * margin on top of that.
 *
 * 📌 The sliding version was not caught by its own unit tests, which passed. It was caught by
 * running the suite: five tests went green and the sixth died at exactly 30.0 seconds — the
 * default test timeout — while the pacer sat waiting out a window it had modelled wrongly.
 */
export class RegistrationPace {
  /** When the current window opened, or `null` while none is open. */
  private openedAt: number | null = null;
  /** How many registrations have gone out inside it. */
  private issued = 0;

  constructor(
    private readonly limits: RegistrationQuota | null,
    private readonly clock: Clock = systemClock
  ) {}

  /** Returns once another registration may be sent, waiting out the window if it may not. */
  async take(): Promise<void> {
    const limits = this.limits;

    // A deployment nobody has measured a limit on. Waiting here would be acting on a number that
    // does not exist — the `ui` job registers six accounts on such a target in under a minute.
    if (limits === null) return;

    for (;;) {
      const now = this.clock.now();

      // No window open, or the last one has closed: this registration opens a fresh one.
      if (this.openedAt === null || now - this.openedAt >= limits.windowMs) {
        this.openedAt = now;
        this.issued = 1;
        return;
      }

      if (this.issued < limits.limit) {
        this.issued += 1;
        return;
      }

      // ⛔ Not `return` after the pause. A pause can come back early — a loaded machine, a timer
      // that fires short — so the decision is made from the clock on the next turn rather than
      // from an assumption that sleeping worked.
      await this.clock.pause(Math.max(this.openedAt + limits.windowMs - now, 0));
    }
  }
}

/**
 * One pacer per base URL, for the life of the worker process.
 *
 * 🔑 **Shared deliberately, and this is the whole point.** A pacer built per test would count to
 * five inside each one and never wait, which is exactly the state the suite was already in. The
 * quota belongs to the target, so the record of what has been sent to it has to outlive the test
 * that sent it.
 *
 * 📌 Keyed by URL rather than by deployment name because the caller that needs it most — the `api`
 * fixture — is handed a `baseURL` by its project and never learns the name.
 */
const pacers = new Map<string, RegistrationPace>();

export function paceFor(baseUrl: string | undefined): RegistrationPace {
  const key = baseUrl ?? '';
  const existing = pacers.get(key);
  if (existing !== undefined) return existing;

  const created = new RegistrationPace(quotaAt(baseUrl));
  pacers.set(key, created);
  return created;
}
