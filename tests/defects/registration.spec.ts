import { test, expect } from '@/fixtures';

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
