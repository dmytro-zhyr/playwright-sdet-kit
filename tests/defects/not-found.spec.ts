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
// conforming half — the five other article-slug paths, which answer 404 correctly — stays in
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

// The specification states no success status for creating a comment, only that it returns a
// Comment, so the control below accepts either of the two a deployment might reasonably answer.
const COMMENT_CREATED = [200, 201];
const COMMENT_CREATED_MESSAGE =
  'the specification states no success status for creating a comment, only that it returns a Comment, so 200 and 201 are both accepted';

// Turns green the day the gate deployment looks for the article before it judges the comment's
// body. The conforming half — the five other article-slug paths, which answer 404 correctly —
// stays in tests/contract/not-found.spec.ts and is green there.
//
// 🔑 The evidence is the same shape as D-6's: send the identical valid payload twice, once to a
// slug that does exist and once to one that does not. Accepted on the first, 422 on the second, is
// what shows the article lookup was never reached — a bare 422 on the unheld slug alone could just
// as easily be a validator rejecting the payload, and this test needs a reader to be able to tell
// the two apart without re-running anything.
test(
  'D-10 — commenting on an unheld slug is answered 422 instead of 404',
  {
    annotation: {
      type: 'issue',
      description:
        'spec/FINDINGS.md — D-10; GitHub issue to be filed when the repository is published',
    },
  },
  async ({ deployment, factories }) => {
    // Named, not inherited: this defect is on the deployment the contract gate runs against, not
    // on the one the defects project points at.
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

    const created = await author.post('/articles', { article: factories.article.build() });
    const { article } = created.body as { article: { slug: string } };
    expect(article?.slug, 'the case needs one article that exists for the control').toBeTruthy();

    // The control: the same valid comment payload, the same credential, against a slug that does
    // name an article.
    const control = await author.post(`/articles/${article.slug}/comments`, {
      comment: { body: factories.comment.build().body },
    });
    expect(
      COMMENT_CREATED,
      `the same payload must be accepted on a slug that exists — ${COMMENT_CREATED_MESSAGE}`
    ).toContain(control.status);

    const observed = await author.post(`/articles/${UNKNOWN_SLUG}/comments`, {
      comment: { body: factories.comment.build().body },
    });
    expect(
      observed.status,
      'the specification answers 404 when a resource cannot be found to fulfil the request; this ' +
        'comment carries a valid body and a valid credential, and still answers 422 — the article ' +
        'is never looked for, because the payload validator runs first'
    ).toBe(404);
  }
);
