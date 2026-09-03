import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { Status } from 'allure-js-commons';
import { ConduitClient, TARGET_UNAVAILABLE, type RetryPolicy } from '@api/conduitClient';
import { ALLURE_CATEGORIES } from '@report/allure';

/**
 * Two halves of one contract: the wording ConduitClient produces when a target refuses to serve,
 * and the regex `report/allure.ts` uses to recognise it. Either one can be edited alone, and
 * nothing else in the repository would notice — the report would simply go back to filing an
 * outage as a known defect, silently, which is exactly what it did until 31 August 2026.
 *
 * ⚠️ **What this does not test.** It does not run Allure. `classify` below reproduces the
 * documented first-match-wins rule over the declared categories; it is not the generator, and if
 * Allure ever changed that rule this file would keep passing. That rule was measured on 30 August
 * 2026 and the measurement is recorded in report/allure.ts. What this file catches is the failure
 * that actually happened: a message and a regex drifting apart.
 */

/** A stand-in for one HTTP exchange, shaped like the part of APIResponse the client uses. */
function respondingWith(status: number, body = '{}'): APIRequestContext {
  return respondingInSequence([status], body);
}

/**
 * The same stand-in, answering a different status each time it is asked.
 *
 * The client retries a 429, so a stub that can only give one answer cannot show the difference
 * between backing off and giving up. The last entry repeats for any further calls.
 */
function respondingInSequence(statuses: number[], body = '{}'): APIRequestContext {
  let call = 0;

  const respond = (): unknown => {
    const status = statuses[Math.min(call, statuses.length - 1)];
    call += 1;
    return {
      status: (): number => status,
      text: (): Promise<string> => Promise.resolve(body),
      url: (): string => 'https://example.invalid/api/articles',
      headers: (): Record<string, string> => ({}),
    };
  };

  return {
    get: () => Promise.resolve(respond()),
    post: () => Promise.resolve(respond()),
    put: () => Promise.resolve(respond()),
    delete: () => Promise.resolve(respond()),
  } as unknown as APIRequestContext;
}

/**
 * The client's waiting, made instant and countable.
 *
 * ⛔ Not a shorter real delay. A test that sleeps is a test that is slow for a reason unrelated to
 * what it is checking, and the thing worth checking here is *how many times* the client waited,
 * not for how long.
 */
function noWait(): RetryPolicy & { waits: number[] } {
  const waits: number[] = [];
  return {
    attempts: 4,
    waits,
    pause: (ms: number): Promise<void> => {
      waits.push(ms);
      return Promise.resolve();
    },
  };
}

/**
 * ⚠️ **The declared patterns are Java regexes, not JavaScript ones.** `(?s)` is an inline flag in
 * Java and Python; JavaScript has no inline flags at all, and `new RegExp('(?s).*')` throws
 * `Invalid group`. It works in the report because `allure-commandline` is a Java program — which is
 * easy to forget, since everything around it here is TypeScript. Discovered by this file failing on
 * 31 August 2026, which is a fair result for a test whose whole subject is those patterns.
 */
function compile(pattern: string | RegExp): RegExp {
  // Allure's type allows a RegExp as well as a string. Nothing here declares one — it would be
  // serialised into categories.json as `{}` and match nothing — but the type says it is possible,
  // so it is handled rather than cast away.
  if (pattern instanceof RegExp) return pattern;

  const dotAll = pattern.startsWith('(?s)');

  // Deliberately not a general translator. Anything else Java-only in a pattern would be silently
  // mistranslated here, so the test below refuses a construct this does not cover rather than
  // guessing at it.
  return new RegExp(dotAll ? pattern.slice('(?s)'.length) : pattern, dotAll ? 's' : '');
}

/**
 * The first category that claims a failure, which is how the generator assigns one.
 *
 * A category with no `messageRegex` matches on `traceRegex` alone, and vice versa.
 */
function classify(message: string, trace: string, status: Status = Status.FAILED): string | null {
  for (const category of ALLURE_CATEGORIES) {
    if (category.matchedStatuses && !category.matchedStatuses.includes(status)) continue;
    if (category.messageRegex && !compile(category.messageRegex).test(message)) continue;
    if (category.traceRegex && !compile(category.traceRegex).test(trace)) continue;
    return category.name ?? null;
  }
  return null;
}

// Turns red if a category is declared with a Java construct `compile` above does not handle — a
// named group `(?<name>…)`, a possessive quantifier, an inline flag other than `(?s)`. Without it
// the translation would quietly diverge from what the generator does and every assertion below
// would be about a pattern that is not the one shipped in the report.
test('every declared pattern is one this file can evaluate faithfully', () => {
  const patterns = ALLURE_CATEGORIES.flatMap((category) =>
    [category.messageRegex, category.traceRegex].filter((p): p is string => typeof p === 'string')
  );

  expect(
    patterns.length,
    'the categories must declare patterns for this to be about anything'
  ).toBeGreaterThan(0);

  const unsupported = patterns.filter((pattern) => {
    const body = pattern.startsWith('(?s)') ? pattern.slice('(?s)'.length) : pattern;
    return /\(\?[^:=!]/.test(body);
  });

  expect(unsupported, 'a Java-only construct this file cannot translate').toEqual([]);
});

const DEFECTS_TRACE = 'at E:\\Workspace\\playwright-sdet-kit\\tests\\defects\\schemas.spec.ts:82:5';
const CONTRACT_TRACE = 'at /home/runner/work/kit/kit/tests/contract/not-found.spec.ts:134:5';

// Turns red if the client stops refusing a status that means the request was never served. Each
// one is a case where carrying on produces a failure three steps later, naming the wrong thing.
for (const status of [429, 502, 503, 504]) {
  test(`the client refuses HTTP ${status} instead of returning it`, async () => {
    const client = new ConduitClient(respondingWith(status), undefined, noWait());

    await expect(client.get('/articles')).rejects.toThrow(TARGET_UNAVAILABLE);
  });
}

// Turns red if the guard grows to cover a status a test is entitled to see. 500 is the one that
// matters: D-7 asserts the gate deployment answering blank input with a server fault, and a client
// that swallowed it would delete that finding.
for (const status of [200, 401, 404, 422, 500]) {
  test(`the client returns HTTP ${status} to the test, as it always has`, async () => {
    const client = new ConduitClient(respondingWith(status), undefined, noWait());

    expect((await client.get('/articles')).status).toBe(status);
  });
}

// Turns red if the client stops backing off on a rate limit and goes straight to refusing. The
// target answers 429 twice and then serves the request; a client that gives up on the first one
// turns a passing test red for a reason that is not about the application.
test('a rate limit is waited out rather than reported', async () => {
  const retry = noWait();
  const client = new ConduitClient(respondingInSequence([429, 429, 200]), undefined, retry);

  expect((await client.get('/articles')).status, 'the third answer is the one that counts').toBe(
    200
  );
  expect(retry.waits, 'it waited once per refusal, and the waits grow').toEqual([500, 1000]);
});

// And the other half: backing off is bounded. A target that never stops saying 429 still produces
// the same failure it always did, so the report tells one story rather than two.
test('a rate limit that never lifts still ends as an unavailable target', async () => {
  const retry = noWait();
  const client = new ConduitClient(respondingWith(429), undefined, retry);

  await expect(client.get('/articles')).rejects.toThrow(TARGET_UNAVAILABLE);
  expect(retry.waits, 'four attempts means three waits').toHaveLength(3);
});

// 🔑 The check this file exists for. A 429 inside tests/defects/ matches BOTH categories — the
// message of one and the file path of the other — so it is decided by order alone. Reverse the two
// declarations and this is the test that says so.
test('an unavailable target inside tests/defects is not counted as a known defect', async () => {
  const client = new ConduitClient(respondingWith(429), undefined, noWait());
  const message = await client
    .get('/articles')
    .then(() => '')
    .catch((error: Error) => error.message);

  expect(message, 'the client must produce a message at all').not.toBe('');
  expect(classify(message, DEFECTS_TRACE)).toBe('Target unavailable');
});

// And the other direction, which is what keeps the fix from being a category that swallows the
// suite it was meant to sit in front of: an ordinary assertion failure in the same file still
// belongs to the defect it documents.
test('a genuine assertion failure in tests/defects is still a known defect', () => {
  const message =
    'The value does not match the schema:\n  comment.author.following: expected boolean';

  expect(classify(message, DEFECTS_TRACE)).toBe('Known defect of the target');
});

// Outside tests/defects/ the same outage is still an outage — the contract gate must not read a
// third party's rate limiting as a contract violation.
test('an unavailable target in the contract suite is an outage, not a contract failure', async () => {
  const client = new ConduitClient(respondingWith(503));
  const message = await client
    .get('/articles')
    .then(() => '')
    .catch((error: Error) => error.message);

  expect(classify(message, CONTRACT_TRACE)).toBe('Target unavailable');
});

// A failure nobody has explained must stay unclaimed. A category that matched this would be the
// catch-all the module's own note warns about — first-match-wins means a loose category steals
// results rather than adding to them.
test('an unexplained failure is claimed by no declared category', () => {
  expect(classify('expect(received).toBe(expected)', CONTRACT_TRACE)).toBeNull();
});
