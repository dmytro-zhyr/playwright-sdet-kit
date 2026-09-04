import { test, expect } from '@playwright/test';
import { z } from 'zod';
import { parseBody } from '@assertions/parseBody';
import { thrownMessage } from '@assertions/thrown';

const Sample = z.strictObject({ id: z.string(), count: z.number() });

// Turns red if the helper stops returning the value it validated, which would leave every call
// site narrowing to `undefined` and failing later on a property access rather than here.
test('a valid body comes back parsed', () => {
  const parsed = parseBody({ id: 'a', count: 1 }, Sample);

  expect(parsed.id).toBe('a');
  expect(parsed.count).toBe(1);
});

// The reason this helper exists rather than a cast: the narrowing IS the check. Turns red if a
// body that does not match is handed back anyway — which is what `as { … }` does today at the
// 32 call sites that have not been converted.
test('a body that does not match fails instead of being returned', () => {
  const message = thrownMessage(() => parseBody({ id: 1, count: 1 }, Sample));

  expect(message, 'a mismatching body was returned instead of failing the test').not.toBe('');
});

// Turns red if the failure stops naming the field — the property `toMatchSchema` was written for,
// and the reason this helper delegates to it instead of catching a ZodError of its own.
test('the failure names the field, not the library', () => {
  const message = thrownMessage(() => parseBody({ id: 1, count: 1 }, Sample));

  expect(message).toContain('id');
  expect(message).not.toContain('ZodError');
});

// Turns red if an added field starts passing. The strictness lives in the schema, but a helper
// that parsed with a stripped copy would quietly undo it, and every contract test would keep
// looking strict while catching nothing added.
test('an unexpected field still fails through the helper', () => {
  const message = thrownMessage(() => parseBody({ id: 'a', count: 1, extra: true }, Sample));

  expect(message).toContain('extra');
});
