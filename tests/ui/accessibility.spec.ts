import { test, expect } from '@fixtures';
import AxeBuilder from '@axe-core/playwright';
import { WCAG_A_AA, describeViolations } from '@assertions/accessibility';

/**
 * The first accessibility **gate** in this repository, as opposed to the first accessibility
 * finding — those are D-13 and D-14 in `tests/defects-ui/`.
 *
 * 🔑 **The scope is a form, not a page, and that is the whole reason this can be a gate.** Measured
 * on 7 September 2026 against `conduit-overstrict`: the home page carries **119 WCAG A/AA nodes**
 * and `/login` carries 9, so a page-level assertion of zero would be red from the day it was
 * written. Scoped to `form`, both pages report **0 violations and 0 incomplete** — a real, passing
 * property that a future change can break.
 *
 * ⛔ **This is the answer to "add axe and assert no violations", which is the wrong move here.** Of
 * the 98 contrast nodes on the home page, 76 are inside `.article-preview` — that is somebody
 * else's blog posts, and the number moves when they publish. An oracle that tracks how many
 * articles exist is not an oracle. What a gate needs is a region with no third-party content in it,
 * and the sign-in and sign-up forms are the two this application has.
 *
 * ⚠️ `incomplete` is not asserted. It is axe saying "a human has to look at this", not a failure,
 * and turning an admission of uncertainty into a red build teaches people to widen the filter.
 * Both forms happen to report zero of it today; that is recorded in spec/FINDINGS.md, not pinned
 * here.
 */
test.describe('Accessibility', () => {
  // Turns red if the sign-in form acquires a WCAG A or AA failure — a placeholder used as a label,
  // an input that stops being reachable by its label, a contrast change in the theme.
  test('the sign-in form has no WCAG A or AA violations', async ({ page, loginPage }) => {
    await loginPage.goto();
    await expect(loginPage.emailField, 'the form never rendered').toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .include('form')
      .withTags([...WCAG_A_AA])
      .analyze();

    expect(
      describeViolations(violations),
      'the sign-in form is the narrowest thing in this application a keyboard-and-screen-reader user must get through, and it must stay clean'
    ).toBe('none');
  });

  // The same property on the other end of the same journey. Written separately rather than as a
  // loop over two routes: they are different forms, and a failure should name which.
  test('the sign-up form has no WCAG A or AA violations', async ({ page, registerPage }) => {
    await registerPage.goto();
    await expect(registerPage.usernameField, 'the form never rendered').toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .include('form')
      .withTags([...WCAG_A_AA])
      .analyze();

    expect(
      describeViolations(violations),
      'registration is the first thing a new user meets, and a form that fails here fails before anything else can be tried'
    ).toBe('none');
  });
});
