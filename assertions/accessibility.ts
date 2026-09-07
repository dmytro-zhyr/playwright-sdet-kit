/**
 * The tags that make an axe run mean "WCAG", and nothing more than WCAG.
 *
 * 🔑 **The list is here rather than in each spec because it was already wrong once.** The first
 * measurement, on 7 September 2026, used four tags and silently omitted `wcag22aa` — so it reported
 * a WCAG figure that excluded WCAG 2.2. Nothing failed; the number was just quietly smaller. A
 * constant with one definition cannot drift between two callers that way.
 *
 * ⛔ `best-practice` is deliberately absent. 30 of axe's 105 rules carry no WCAG tag at all —
 * `landmark-one-main`, `region` and `page-has-heading-one` are the three this application trips —
 * and they are Deque's recommendations, not a standard. Reporting them as "WCAG violations" would
 * be false, and it is the kind of false that gets noticed.
 *
 * ⚠️ AAA is absent for the opposite reason: W3C itself does not recommend AAA as a whole-site
 * target. AA is what conformance means in practice, and what EN 301 549 and Section 508 point at.
 */
export const WCAG_A_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;

/**
 * Renders axe's violations as something a person reads in a failure message.
 *
 * Rule, impact and node count on one line each, then the first selector — enough to find the
 * element without opening the trace, and short enough that ten of them do not bury the assertion.
 *
 * 📌 The node count is included and the nodes are not. A count says how big the problem is; the
 * list of 98 selectors behind it says nothing a reader can act on in a terminal.
 *
 * ⛔ It takes a shape of its own rather than axe's `Result`, and that is not decoration: axe's type
 * is a class of its own with a dozen fields this function never reads, and depending on it would
 * mean a unit test could only be written by casting a literal into it. The narrower type is what
 * `tests/unit/accessibility.spec.ts` calls with, and axe's own results satisfy it structurally.
 */
export type Violation = {
  readonly id: string;
  readonly impact?: string | null;
  readonly nodes: readonly { readonly target: readonly unknown[] }[];
};

export function describeViolations(violations: readonly Violation[]): string {
  if (violations.length === 0) {
    return 'none';
  }

  return violations
    .map((violation) => {
      const where = violation.nodes[0]?.target.join(' ') ?? 'unknown';

      return `${violation.impact ?? 'unknown'} · ${violation.id} · ${violation.nodes.length} node(s) · first at ${where}`;
    })
    .join('\n');
}
