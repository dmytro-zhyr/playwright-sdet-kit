import { test, expect } from '@fixtures';
import type { ConduitClient } from '@api/conduitClient';
import type { UserCreateInput } from '@data/userFactory';
import type { DataFixtures } from '@data/dataFixtures';

// Turns green the day a freshly registered account represents an unset `bio` and an unset `image`
// the same way. The conforming half — that registration echoes back the username and the email it
// was given — stays in tests/contract/registration.spec.ts and is green there.
//
// 🔑 The evidence sits inside one response, not against the specification alone. `R-065` in
// pipeline/01-rules.md, which says both fields are `null` at creation, is `Kind: assumed` — the
// honest complaint against an assumed rule is only that it is assumed. What raises this from an
// assumption to a finding is that the same response contradicts itself: `image` comes back `null`
// and `bio` comes back `""`, one handler representing "the caller did not set this" two different
// ways for two fields neither registration request can set.
test(
  'D-11 — a freshly registered account represents bio and image differently',
  {
    annotation: {
      type: 'issue',
      description:
        'spec/FINDINGS.md — D-11; GitHub issue to be filed when the repository is published',
    },
  },
  async ({ deployment, factories }) => {
    // Named, not inherited: this defect is on the deployment the contract gate runs against, not
    // on the one the defects project points at.
    const gate = await deployment('conduit-gate');

    const account = factories.user.build();
    const response = await gate.post('/users', { user: account });
    const registered = response.body as { user?: { bio?: unknown; image?: unknown } };

    expect(
      registered.user,
      `registering on conduit-gate returned HTTP ${response.status} without a user: ` +
        JSON.stringify(response.body)
    ).toBeTruthy();

    // The control: on this very response, `image` — a field registration cannot set, exactly like
    // `bio` — already comes back `null`. It is what turns the assertion below from a bare
    // preference for `null` into a self-inconsistency: the same handler already knows how to
    // represent "not given" as `null`, and does so for one field and not the other.
    expect(
      registered.user?.image,
      'a field registration cannot set represents "not given" as null on this response'
    ).toBeNull();

    expect(
      registered.user?.bio,
      'the other field registration cannot set must represent the same absence the same way — ' +
        'image on this same response is null, so a non-null bio is the account contradicting ' +
        'itself, not only the specification'
    ).toBeNull();
  }
);

/**
 * How many independent colliding pairs D-1 and D-2 each register.
 *
 * `duplicateStatus` has answered 201 on every genuine collision observed while writing and
 * revising these tests, consistent with D-3's "uniqueness enforced nowhere" — with one exception,
 * a single infrastructure 503 from the shared sandbox, unrelated to what either test asserts.
 * `COLLISION_TRIALS` samples more than one pair for the same reason spec/FINDINGS.md insists a
 * verdict be "reproduced at least twice before being written down": one sample proves less than
 * several agreeing ones, and it costs only a couple of extra requests to keep a stray 429/503 from
 * consuming the one trial a test has.
 *
 * Earlier revisions of this file sampled six trials to outrun a roughly 1-in-10 miss rate measured
 * on a *different* symptom — reading a profile back through a token, which turned out to be D-4's
 * noise, not this defect's (see the comment on the D-1 test below). `duplicateStatus` itself has
 * shown no such intermittency, so three trials here are about corroboration, not about outrunning
 * a measured miss rate.
 */
const COLLISION_TRIALS = 3;

type Trial = {
  original: UserCreateInput;
  duplicate: UserCreateInput;
  duplicateStatus: number;
};

/**
 * Registers an account, then a second one that collides with it on exactly one field.
 */
async function collide(
  api: ConduitClient,
  factories: DataFixtures['factories'],
  overlap: 'email' | 'username'
): Promise<Trial> {
  const original = factories.user.build();
  const originalRegistration = await api.post('/users', { user: original });

  if (originalRegistration.status !== 201) {
    throw new Error(
      `registering the original account answered HTTP ${originalRegistration.status}, not 201: ` +
        JSON.stringify(originalRegistration.body)
    );
  }

  const duplicate = factories.user.build(
    overlap === 'email' ? { email: original.email } : { username: original.username }
  );
  const duplicateRegistration = await api.post('/users', { user: duplicate });

  return { original, duplicate, duplicateStatus: duplicateRegistration.status };
}

// Turns green the day POST /users stops accepting an email another account already holds. Plain
// `api`, not `deployment('conduit-gate')`: this is conduit-unsound's defect (D-1 to D-5), the
// deployment the `defects` project's own baseURL already points at, unlike D-9 in
// tests/defects/authentication.spec.ts and D-11 above, in this file — both defects of the gate,
// which name it explicitly.
//
// 🔑 A fix-round review caught this test asserting D-4's invariant instead of D-1's: an earlier
// revision read the original account's profile back through its own token and asserted it still
// matched, which is character-for-character what tests/defects/authentication.spec.ts:11 already
// asserts. A control settled it — registering two entirely UNRELATED accounts, no collision at
// all — reproduced the same "the read returns someone else's data" symptom 8 times out of 10.
// That symptom is D-4's, not this collision's; a test built on it would go green the day D-4 alone
// is fixed, with email uniqueness still unenforced. What the same control ruled out as noise: the
// duplicate registration's own status. Every non-colliding registration in that control answered
// 201, and every non-colliding one is *supposed* to — the differential a conforming API must show
// is refusing the colliding one specifically, which today it does not. `COLLISION_TRIALS`
// independent pairs are registered; see that constant's comment for why more than one.
test(
  'D-1 — a duplicated email must not be accepted',
  {
    annotation: {
      type: 'issue',
      description:
        'spec/FINDINGS.md — D-1; GitHub issue to be filed when the repository is published',
    },
  },
  async ({ api, factories }) => {
    const trials: Trial[] = [];
    for (let i = 0; i < COLLISION_TRIALS; i += 1) {
      trials.push(await collide(api, factories, 'email'));
    }

    const accepted = trials
      .filter((trial) => trial.duplicateStatus === 201)
      .map(
        (trial) =>
          `registering ${trial.duplicate.username} with ${trial.original.username}'s email, ` +
          `already registered moments earlier, answered HTTP ${trial.duplicateStatus}`
      );

    expect(
      accepted,
      `${accepted.length} of ${COLLISION_TRIALS} registrations with an already-taken email were ` +
        `accepted instead of refused:\n${accepted.join('\n')}`
    ).toEqual([]);
  }
);

// Turns green the day POST /users stops accepting a username another account already holds. Plain
// `api`, for the same reason as D-1 above: this is conduit-unsound's defect, not the gate's.
//
// 🔑 The same fix-round review, and the same control, apply here. An earlier revision asserted
// that the duplicate registration's own response carried a token DIFFERENT from the existing
// account's own — spec/FINDINGS.md's literal "returns the same token" description of D-2. A
// second control (ten trials, two entirely UNRELATED registrations back to back, tokens compared
// directly from each registration response) reproduced a shared token 9 times out of 10 — again
// with no collision involved. Token sharing on back-to-back registrations is not specific to a
// colliding username either; it is the same generic noise D-1's comment above describes for reads.
// What is specific, by the same reasoning as D-1: the duplicate registration's own status.
// `COLLISION_TRIALS` independent pairs are registered, for the same reason as D-1 above.
test(
  'D-2 — a duplicated username must not be accepted',
  {
    annotation: {
      type: 'issue',
      description:
        'spec/FINDINGS.md — D-2; GitHub issue to be filed when the repository is published',
    },
  },
  async ({ api, factories }) => {
    const trials: Trial[] = [];
    for (let i = 0; i < COLLISION_TRIALS; i += 1) {
      trials.push(await collide(api, factories, 'username'));
    }

    const accepted = trials
      .filter((trial) => trial.duplicateStatus === 201)
      .map(
        (trial) =>
          `registering ${trial.original.username} again, already registered moments earlier, ` +
          `with a fresh email answered HTTP ${trial.duplicateStatus}`
      );

    expect(
      accepted,
      `${accepted.length} of ${COLLISION_TRIALS} registrations with an already-taken username ` +
        `were accepted instead of refused:\n${accepted.join('\n')}`
    ).toEqual([]);
  }
);
