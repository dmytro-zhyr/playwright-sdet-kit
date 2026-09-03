import { expect as baseExpect } from '@playwright/test';
import type { ZodType } from 'zod';

/**
 * Asserts that a value matches a zod schema.
 *
 * The reason this exists rather than a bare `Schema.parse(value)`: parse throws a ZodError, which
 * the reporter renders as a stack trace. What a failing contract test needs to say is which field
 * was wrong and how — "user.bio: expected string, received null" — so the message is built here.
 */
export const expect = baseExpect.extend({
  toMatchSchema(received: unknown, schema: ZodType) {
    const result = schema.safeParse(received);

    if (result.success) {
      // Phrased for the .not case: this branch is only ever printed when the caller expected a
      // mismatch and did not get one.
      return {
        pass: true,
        message: (): string => 'Expected the value NOT to match the schema, but it does.',
      };
    }

    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('\n');

    return {
      pass: false,
      message: (): string => `The value does not match the schema:\n${issues}`,
    };
  },
});
