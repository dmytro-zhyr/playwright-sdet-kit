// A catch variable is `unknown`, so reading `.message` off one needs narrowing — and narrowing is
// a conditional, which `playwright/no-conditional-in-test` refuses inside a test body. The rule is
// right about the category and wrong about this branch, which decides nothing. Lifting it out
// satisfies both readings honestly, where a disable comment would have satisfied neither.
//
// 📌 The `throw` at the end is not decoration. Without it a call that stopped throwing would leave
// the message empty, and every assertion about its *contents* would still be made — against an
// empty string. That is a check that cannot go red, which is the defect this repository already
// spent a week on. See spec/FINDINGS.md, "How D-12 was missed".
export function thrownMessage(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('expected the call to throw and it returned; there is no message to read');
}
