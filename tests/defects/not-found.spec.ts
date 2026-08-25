import { test, expect } from '@/fixtures';

const UNKNOWN_SLUG = 'there-is-no-such-slug-000';
const UNKNOWN_COMMENT_ID = 999999999;

// The specification states no success status for a delete, so the control below accepts either of
// the two a deployment might reasonably answer. What it still refuses is a delete that does not
// succeed at all, which is what would make the 404 assertions above it meaningless.
const DELETE_SUCCESS = [200, 204];
const DELETE_SUCCESS_MESSAGE =
  'the specification states no success status for a delete, so 200 and 204 are both accepted';

// Turns green the day the gate deployment stops answering 204 for a resource it never held. The
// conforming half — the six read paths, which answer 404 correctly — stays in
// tests/contract/not-found.spec.ts and is green there.
test(
  'D-6 — deleting an identifier that names nothing is answered 404',
  {
    annotation: {
      type: 'issue',
      description:
        'spec/FINDINGS.md — D-6; GitHub issue to be filed when the repository is published',
    },
  },
  async ({ deployment, factories }) => {
    // Named, not inherited: this defect is on the deployment the contract gate runs against, not
    // on the one the defects project points at. Naming it is what let this test leave the gate.
    const gate = await deployment('conduit-gate');

    const user = factories.user.build();
    const registration = await gate.post('/users', { user });
    const registered = registration.body as { user?: { token?: string } };
    const token = registered.user?.token;
    expect(
      token,
      `registering on conduit-gate returned HTTP ${registration.status} without a token: ` +
        JSON.stringify(registration.body)
    ).toBeTruthy();

    const author = gate.withToken(token as string);

    // A comment can only be deleted from an article that exists, so the comment identifier is the
    // only thing missing in the second deletion below.
    const created = await author.post('/articles', { article: factories.article.build() });
    const { article } = created.body as { article: { slug: string } };
    expect(
      article?.slug,
      'the case needs one article that exists to delete a comment from'
    ).toBeTruthy();

    const deletions = [
      {
        name: 'DELETE /articles/:unknown',
        response: await author.del(`/articles/${UNKNOWN_SLUG}`),
      },
      {
        name: 'DELETE /articles/:slug/comments/:unknown',
        response: await author.del(`/articles/${article.slug}/comments/${UNKNOWN_COMMENT_ID}`),
      },
    ];

    expect(
      deletions.map(({ name, response }) => `${name} -> ${response.status}`),
      'the specification answers 404 when a resource cannot be found to fulfil the request; a ' +
        'delete that answers 204 claims to have removed something that was never there'
    ).toEqual(deletions.map(({ name }) => `${name} -> 404`));

    // The positive control, and it is what makes the two assertions above mean anything: the same
    // verb, the same path shape, the same credential, with an identifier that does name something.
    const removed = await author.del(`/articles/${article.slug}`);
    expect(
      DELETE_SUCCESS,
      `the same delete must succeed when the slug names an article — ${DELETE_SUCCESS_MESSAGE}`
    ).toContain(removed.status);
  }
);
