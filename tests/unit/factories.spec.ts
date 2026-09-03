import { test, expect } from '@playwright/test';
import { userFactory } from '@data/userFactory';

/**
 * The factories, tested directly rather than through the `factories` fixture.
 *
 * 📌 These two lived in `tests/contract/registration.spec.ts` until 4 September 2026, and they were
 * in the wrong suite the whole time: they build an object and assert on it, touching no network at
 * all. The type-aware ESLint rules noticed the symptom on 3 September — `require-await` on two
 * bodies that never awaited anything — and the `async` keyword was removed without anyone asking
 * the question behind it, which is *why a test with no I/O was in the suite that needs a live
 * deployment*.
 *
 * 🔑 The consequence is not tidiness. A test of our own code that sits in `tests/contract/` cannot
 * run when the target is down, and it is invisible to a coverage figure gathered from unit tests
 * only — which is the figure this repository reports. See CONVENTIONS.md, "What coverage counts".
 */

// Turns red if the factory starts reusing values, which would make parallel workers collide on the
// same account, or if the qa_ prefix is dropped and the accounts stop being recognisable.
test('the user factory produces unique, recognisable accounts', () => {
  const first = userFactory.build();
  const second = userFactory.build();

  expect(first.email).not.toBe(second.email);
  expect(first.username).not.toBe(second.username);
  expect(first.username.startsWith('qa_'), 'accounts must be recognisable as ours').toBe(true);
  expect(first.email.startsWith('qa_'), 'accounts must be recognisable as ours').toBe(true);
});

// Turns red if overrides stop being applied, which would silently ignore the one field a test cares
// about while still producing a plausible-looking user.
test('the user factory applies overrides', () => {
  const user = userFactory.build({ username: 'qa_fixed_name' });

  expect(user.username).toBe('qa_fixed_name');
  expect(user.email).toBeTruthy();
  expect(user.password).toBeTruthy();
});
