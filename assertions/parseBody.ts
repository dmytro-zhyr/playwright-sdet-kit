import type { ZodType } from 'zod';
import { expect } from '@assertions/toMatchSchema';

/**
 * Validates a response body against a schema and returns it typed.
 *
 * 🔑 **The point is that the narrowing and the check are one call.** The pattern this replaces was
 * two statements, and only the first of them was true:
 *
 * ```ts
 * expect(response.body).toMatchSchema(UserResponseSchema);
 * const { user } = response.body as { user: { email: string; username: string } };
 * ```
 *
 * The cast asserts nothing — it tells the compiler to stop asking — and it restates a shape the
 * schema beside it already knows. Written as `const { user } = parseBody(response.body,
 * UserResponseSchema)`, the shape a test relies on is the shape that was checked.
 *
 * ⛔ It is deliberately not `schema.parse(body)` with a `try/catch` of its own. `toMatchSchema`
 * already does the one thing that matters when this fails — saying `user.bio: expected string,
 * received null` instead of rendering a ZodError as a stack trace — and it lands in the report as
 * an assertion rather than as an error. A second way of failing for the same class of problem is a
 * second vocabulary for the reader to learn.
 *
 * So the matcher runs first and stops the test on a mismatch; `schema.parse` below is only ever
 * reached when it cannot fail. Parsing twice costs microseconds and buys one failure message.
 *
 * ⚠️ **Not every cast should become this call.** Some are partial on purpose —
 * `as { article?: { slug?: string } }` exists so the test can report its own message about the
 * missing field, and a strict parse would fail before that message could be produced. See
 * PLAN.md, B2.
 */
export function parseBody<T>(body: unknown, schema: ZodType<T>): T {
  expect(body).toMatchSchema(schema);

  return schema.parse(body);
}
