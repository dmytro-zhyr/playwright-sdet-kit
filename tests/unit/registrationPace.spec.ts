import { test, expect } from '@fixtures';
import { RegistrationPace, type Clock } from '@api/registrationPace';
import type { RegistrationQuota } from '@deployments/registry';

/**
 * The pacer, with time injected so these run in milliseconds rather than in windows.
 *
 * 🔑 The fake clock does not tick on its own: it moves only when `pause` is called, and by exactly
 * the amount asked for. That is what makes the assertions about *how long* the pacer waited exact
 * rather than a tolerance.
 *
 * ⚠️ An earlier, sliding-window implementation passed tests very like these. What they could not
 * see was that the model was wrong — only the suite running against the real target showed that,
 * when the sixth test died at the default 30-second timeout while the pacer sat waiting out a
 * window it had modelled incorrectly. The test named *one wait returns the whole allowance* is the
 * one that pins the difference, and it is the property the test timeout depends on.
 */
const LIMITS: RegistrationQuota = { limit: 3, windowMs: 1_000 };

function fakeClock(): Clock & { waits: number[]; advance: (ms: number) => void } {
  let current = 0;
  const waits: number[] = [];

  return {
    waits,
    now: (): number => current,
    advance: (ms: number): void => {
      current += ms;
    },
    pause: (ms: number): Promise<void> => {
      waits.push(ms);
      current += ms;
      return Promise.resolve();
    },
  };
}

test('registrations inside the limit never wait', async () => {
  const clock = fakeClock();
  const pace = new RegistrationPace(LIMITS, clock);

  await pace.take();
  await pace.take();
  await pace.take();

  expect(clock.waits, 'three registrations under a limit of three must go straight out').toEqual(
    []
  );
});

test('the one over the limit waits out the rest of the window', async () => {
  const clock = fakeClock();
  const pace = new RegistrationPace(LIMITS, clock);

  await pace.take();
  await pace.take();
  await pace.take();
  await pace.take();

  expect(clock.waits, 'the window opened at zero, so the fourth owes the whole thousand').toEqual([
    1_000,
  ]);
});

test('one wait returns the whole allowance, not a single slot', async () => {
  // 🔑 The property the test timeout depends on. Under a sliding window each of these would owe
  // its own wait, and a test making several registrations could sit through minutes of them.
  const clock = fakeClock();
  const pace = new RegistrationPace(LIMITS, clock);

  await pace.take();
  await pace.take();
  await pace.take();
  await pace.take();
  await pace.take();
  await pace.take();

  expect(
    clock.waits,
    'six registrations across two windows of three cost exactly one wait'
  ).toEqual([1_000]);
});

test('time that passed on its own counts — the pacer does not wait for it twice', async () => {
  const clock = fakeClock();
  const pace = new RegistrationPace(LIMITS, clock);

  await pace.take();
  clock.advance(400);
  await pace.take();
  await pace.take();
  await pace.take();

  expect(
    clock.waits,
    'four hundred milliseconds had already passed, so only six hundred were owed'
  ).toEqual([600]);
});

test('a window that elapsed on its own opens a new one without waiting', async () => {
  const clock = fakeClock();
  const pace = new RegistrationPace(LIMITS, clock);

  await pace.take();
  await pace.take();
  await pace.take();
  clock.advance(1_000);

  await pace.take();
  await pace.take();
  await pace.take();

  expect(
    clock.waits,
    'three registrations, a full window of silence, then three more — none owes a wait'
  ).toEqual([]);
});

test('a pause that returns early does not let a registration through', async () => {
  // ⚠️ The case the loop exists for. A clock whose `pause` returns without moving time as far as
  // it was asked to — a real one can, under load — must not be taken as permission to send.
  let current = 0;
  const waits: number[] = [];
  const lazy: Clock = {
    now: (): number => current,
    pause: (ms: number): Promise<void> => {
      waits.push(ms);
      current += ms / 2;
      return Promise.resolve();
    },
  };

  const pace = new RegistrationPace(LIMITS, lazy);
  await pace.take();
  await pace.take();
  await pace.take();
  await pace.take();

  expect(
    waits.length,
    'the first pause covered only half the window, so the pacer had to ask again'
  ).toBeGreaterThan(1);
  expect(
    current,
    'and it did not return until the window had actually passed'
  ).toBeGreaterThanOrEqual(1_000);
});

test('a deployment with no measured quota never waits', async () => {
  // ⛔ `null` is *measured, none found* — see deployments/registry.ts. Pacing such a target would
  // cost the `ui` and `defects` jobs minutes for a limit nobody has observed.
  const clock = fakeClock();
  const pace = new RegistrationPace(null, clock);

  for (let i = 0; i < 20; i += 1) await pace.take();

  expect(clock.waits, 'twenty registrations against an unmetered target cost nothing').toEqual([]);
});
