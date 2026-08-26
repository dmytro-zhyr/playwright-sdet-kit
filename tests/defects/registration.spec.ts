import { test, expect } from '@/fixtures';
import type { ConduitClient } from '@/api/conduitClient';
import type { NewUser } from '@/data/userFactory';

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
 * How many independent registration pairs D-1 and D-2 each sample.
 *
 * Measured directly against conduit-unsound on 26 August 2026, with ten independent trials for
 * each field: a colliding registration is handed the existing account's own token on roughly 9 of
 * 10 attempts for a duplicated email and 8 of 10 for a duplicated username — not on every single
 * one. The likely cause is the same shared "current session" state D-4 already implicates, which a
 * public, shared instance lets unrelated traffic overwrite between the two calls one trial makes.
 * Sampling several independent pairs — the same technique `CONCURRENT_REGISTRATIONS` uses in
 * authentication.spec.ts — is what keeps this test from spuriously passing on a lucky miss: at the
 * worse of the two measured rates, the chance every one of six independent trials happens to miss
 * a defect that is still present is under one in ten thousand. And unlike a retry-until-reproduced
 * loop would be, this shape stays honest at the other end too — the day the defect is gone, every
 * trial reports no hijack and the test is green because nothing failed, not because nothing ran.
 */
const COLLISION_TRIALS = 6;

type Trial = {
  original: NewUser;
  duplicate: NewUser;
  duplicateStatus: number;
  readOriginalUser: { username?: string; email?: string } | undefined;
};

/**
 * Registers an account, then a second one that collides with it on exactly one field, and reads
 * the first account's own profile back through its own token afterwards. One independent
 * observation; {@link COLLISION_TRIALS} of these make up one test.
 */
async function collide(
  api: ConduitClient,
  factories: { user: { build: (overrides?: Partial<NewUser>) => NewUser } },
  overlap: 'email' | 'username'
): Promise<Trial> {
  const original = factories.user.build();
  const originalRegistration = await api.post('/users', { user: original });
  const originalToken = (originalRegistration.body as { user?: { token?: string } }).user?.token;

  if (!originalToken) {
    throw new Error(
      `registering the original account answered HTTP ${originalRegistration.status} without a ` +
        `token: ${JSON.stringify(originalRegistration.body)}`
    );
  }

  const duplicate = factories.user.build(
    overlap === 'email' ? { email: original.email } : { username: original.username }
  );
  const duplicateRegistration = await api.post('/users', { user: duplicate });

  const readOriginal = await api.withToken(originalToken).get('/user');
  const readOriginalUser = (readOriginal.body as { user?: { username?: string; email?: string } })
    .user;

  return {
    original,
    duplicate,
    duplicateStatus: duplicateRegistration.status,
    readOriginalUser,
  };
}

// Turns green the day a duplicated email stops costing the original account its own token —
// whether POST /users refuses the collision outright, as the specification implies, or any other
// fix that leaves the original account's own token still identifying it afterwards. Plain `api`,
// not `deployment('conduit-gate')`: this is conduit-unsound's defect (D-1 to D-5), the deployment
// the `defects` project's own baseURL already points at, unlike D-9 and D-11 above, which are
// defects of the gate and name it explicitly.
//
// 🔑 The evidence is behavioural, not a bare status: a 201 on the duplicate is not itself the harm.
// Logging in turns out to be an unreliable witness here — across ten independent trials it always
// correctly told the two accounts apart by password, so it is not what this test leans on. What
// breaks is the token: reading a profile back through the ORIGINAL account's own token, the one
// issued at its own registration, returns the newer account's data instead. That is loss of
// access, not a cosmetic mismatch — the credential the original account was given stops working
// for it. `COLLISION_TRIALS` independent pairs are sampled, and a single hijacked one is enough to
// fail the test — see that constant's comment for why sampling several beats a single attempt.
test(
  'D-1 — a duplicated email must not cost the original account its own token',
  {
    annotation: {
      type: 'issue',
      description:
        'spec/FINDINGS.md — D-1; GitHub issue to be filed when the repository is published',
    },
  },
  async ({ api, factories }) => {
    // Sequential, not Promise.all: concurrent registrations reproduce D-4 instead, a different
    // defect with its own test above. Each trial here must be an independent, ordinary pair of
    // one-after-another requests, the same shape a single caller would make.
    const trials: Trial[] = [];
    for (let i = 0; i < COLLISION_TRIALS; i += 1) {
      trials.push(await collide(api, factories, 'email'));
    }

    const hijacked = trials
      .filter(
        (trial) =>
          trial.readOriginalUser?.username !== trial.original.username ||
          trial.readOriginalUser?.email !== trial.original.email
      )
      .map(
        (trial) =>
          `registering ${trial.duplicate.username} with ${trial.original.username}'s email ` +
          `answered HTTP ${trial.duplicateStatus}; reading ${trial.original.username}'s own ` +
          `profile back through its own token afterwards returned ` +
          `${trial.readOriginalUser?.username ?? '<no username>'} ` +
          `(${trial.readOriginalUser?.email ?? '<no email>'}) instead of its own data`
      );

    expect(
      hijacked,
      `${hijacked.length} of ${COLLISION_TRIALS} duplicated-email registrations left the ` +
        `original account unreachable through its own token — a token must identify the account ` +
        `it was issued to, whatever else registers afterwards:\n${hijacked.join('\n')}`
    ).toEqual([]);
  }
);

// Turns green the day a duplicated username stops costing the existing account its own token —
// whether POST /users refuses it outright, as the specification implies, or any other fix that
// leaves the existing account's own token still identifying it afterwards. Plain `api`, for the
// same reason as D-1 above: this is conduit-unsound's defect, not the gate's.
//
// 🔑 The evidence is that the existing account, read back through the very token it was issued at
// its own registration, comes back with a different email — not a new account created alongside
// it, but the existing one silently repointed. A test that only checked "a token came back" or
// "the status was 201" would not distinguish this from an ordinary, correct registration.
// `COLLISION_TRIALS` independent pairs are sampled, for the same reason as D-1 above.
test(
  'D-2 — a duplicated username must not cost the existing account its own token',
  {
    annotation: {
      type: 'issue',
      description:
        'spec/FINDINGS.md — D-2; GitHub issue to be filed when the repository is published',
    },
  },
  async ({ api, factories }) => {
    // Sequential, not Promise.all: concurrent registrations reproduce D-4 instead, a different
    // defect with its own test above. Each trial here must be an independent, ordinary pair of
    // one-after-another requests, the same shape a single caller would make.
    const trials: Trial[] = [];
    for (let i = 0; i < COLLISION_TRIALS; i += 1) {
      trials.push(await collide(api, factories, 'username'));
    }

    const hijacked = trials
      .filter(
        (trial) =>
          trial.readOriginalUser?.username !== trial.original.username ||
          trial.readOriginalUser?.email !== trial.original.email
      )
      .map(
        (trial) =>
          `registering ${trial.original.username} again with ${trial.duplicate.email} answered ` +
          `HTTP ${trial.duplicateStatus}; reading the existing account back through its own, ` +
          `untouched token afterwards returned ` +
          `${trial.readOriginalUser?.username ?? '<no username>'} ` +
          `(${trial.readOriginalUser?.email ?? '<no email>'}) instead of its own data`
      );

    expect(
      hijacked,
      `${hijacked.length} of ${COLLISION_TRIALS} duplicated-username registrations left the ` +
        `existing account's own token pointing at someone else's data instead of its own — the ` +
        `request must not silently repoint an existing account:\n${hijacked.join('\n')}`
    ).toEqual([]);
  }
);
