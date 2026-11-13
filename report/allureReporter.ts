import AllureReporter from 'allure-playwright';
import type { TestCase, TestResult, TestStep } from '@playwright/test/reporter';

const HOOK_ROOTS = ['Before Hooks', 'After Hooks'];
// Steps the report reads as they are; everything else in hooks is fixture plumbing.
const OWN_CATEGORIES = ['test.step', 'expect', 'attach', 'test.attach'];

/**
 * allure-playwright with three changes:
 *
 * - The epic label comes from the top `describe`, so the Behaviors view groups UI tests by
 *   feature (`Sign in`, `Registration`). A test without a `describe` gets none.
 * - An action step names its target. Playwright passes it apart from the title (`subtitle`), and
 *   allure-playwright leaves it out, so every click reads "Click".
 * - The fixtures' own plumbing is left out of the hooks: "Fixture "page"", "Create context" and the
 *   like, a dozen per test. Steps the code names itself stay, with everything inside them, and a
 *   hook block with none of them is not shown.
 */
export default class Reporter extends AllureReporter {
  onTestBegin(test: TestCase): void {
    addEpic(test);
    super.onTestBegin(test);
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep): void {
    // A hook block is not opened here: allure-playwright opens it at the first step it is given
    // inside, so a block of nothing but plumbing does not appear at all.
    if (HOOK_ROOTS.includes(step.title) || isPlumbing(step)) {
      return;
    }
    nameTarget(step);
    super.onStepBegin(test, result, step);
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep): void {
    if (isPlumbing(step)) {
      return;
    }
    super.onStepEnd(test, result, step);
  }
}

/** As an annotation allure-playwright turns into a label. Once per test, not again on a retry. */
function addEpic(test: TestCase): void {
  // ['', project, file, ...describes, title]
  const [epic] = test.titlePath().slice(3, -1);
  const type = 'allure.label.epic';
  if (epic && !test.annotations.some((annotation) => annotation.type === type)) {
    test.annotations.push({ type, description: epic });
  }
}

/**
 * Inside a hook, and not one of our steps or inside one — or Playwright's own wait inside a
 * `waitForApi` step, which already names the request.
 */
function isPlumbing(step: TestStep): boolean {
  if (step.title === 'Wait for event "response"' && step.parent?.title.startsWith('Wait for ')) {
    return true;
  }
  if (HOOK_ROOTS.includes(step.title) || OWN_CATEGORIES.includes(step.category)) {
    return false;
  }
  let inHook = false;
  for (let parent = step.parent; parent; parent = parent.parent) {
    if (parent.category === 'test.step') {
      return false;
    }
    if (HOOK_ROOTS.includes(parent.title)) {
      inHook = true;
    }
  }
  return inHook;
}

/**
 * "Click" becomes "Click getByRole('button', …)", "POST" becomes "POST /api/users", and a check
 * with no message, `Expect "toBeDisabled"`, names what it checked.
 * The step object is shared with the other reporters; the list reporter does not print steps.
 */
function nameTarget(step: TestStep): void {
  const { subtitle } = step as TestStep & { subtitle?: string };
  // A check with its own message keeps it as the title; one without reads `Expect "toBeDisabled"`.
  const action = step.category === 'pw:api' || step.title.startsWith('Expect "');
  if (action && subtitle && !step.title.endsWith(subtitle)) {
    step.title = `${step.title} ${subtitle}`;
  }
}
