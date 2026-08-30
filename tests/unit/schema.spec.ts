import { test, expect as playwrightExpect } from '@playwright/test';
import { z } from 'zod';
import { expect } from '@schemas/toMatchSchema';

const Sample = z.strictObject({ id: z.string(), count: z.number() });

test('the matcher accepts a valid object', () => {
  expect({ id: 'a', count: 1 }).toMatchSchema(Sample);
});

// The most important test in this file. It pins the decision to use strictObject: a plain
// z.object() silently strips unknown keys, so the schema would stop catching an ADDED field —
// the most common shape of a contract change.
test('the matcher rejects an unexpected extra field', () => {
  expect({ id: 'a', count: 1, extra: true }).not.toMatchSchema(Sample);
});

test('the matcher rejects a wrong type', () => {
  expect({ id: 'a', count: 'many' }).not.toMatchSchema(Sample);
});

test('the matcher rejects a missing field', () => {
  expect({ id: 'a' }).not.toMatchSchema(Sample);
});

// Turns red if extending a strict schema quietly drops strictness, which would make every
// schema built with .extend() stop catching added fields while still looking strict in the source.
test('extending a strict schema keeps it strict', () => {
  const Extended = Sample.extend({ note: z.string() });

  expect({ id: 'a', count: 1, note: 'ok' }).toMatchSchema(Extended);
  expect({ id: 'a', count: 1, note: 'ok', extra: true }).not.toMatchSchema(Extended);
});

// Turns red if the failure message stops naming the offending field, which is the whole reason
// this matcher exists instead of a bare Schema.parse().
test('the failure message names the field and the problem', () => {
  let message = '';
  try {
    expect({ id: 1, count: 1 }).toMatchSchema(Sample);
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  playwrightExpect(message).toContain('id');
  playwrightExpect(message).not.toContain('ZodError');
});
