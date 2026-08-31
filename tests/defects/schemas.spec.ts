import { test, expect } from '@fixtures';
import {
  ArticlesResponseSchema,
  CommentResponseSchema,
  CommentsResponseSchema,
  ErrorsSchema,
} from '@schemas/conduit.schema';
import { registerUser } from '@api/registerUser';

// The same gap the contract suite names for registration and for delete: the specification states
// no success status for creating a comment, only that the call returns a Comment. This deployment
// answers 201. Pinning 200 here would make the test red for a reason that is not the defect — the
// first version of it did exactly that, on 31 August 2026, and the run is what said so.
const CREATE_SUCCESS = [200, 201];

// Turns green the day the gate deployment answers blank input with a validation failure instead
// of a server fault. The specification is explicit — "if a request fails any validations, expect a
// 422" — and three empty strings are a validation failure, not something the server may crash on.
test(
  'blank input is answered with a validation failure, not a server fault',
  {
    annotation: {
      type: 'issue',
      description:
        'spec/FINDINGS.md — D-7; GitHub issue to be filed when the repository is published',
    },
  },
  async ({ deployment }) => {
    const gate = await deployment('conduit-gate');

    const response = await gate.post('/users', {
      user: { username: '', email: '', password: '' },
    });

    expect(
      response.status,
      'empty strings are a validation failure, and the specification answers those 422'
    ).toBe(422);
    expect(response.body).toMatchSchema(ErrorsSchema);
  }
);

// Turns green the day the gate deployment stops serialising `body` into list responses. The
// specification removed it on 16 August 2024, in a dated notice, for performance.
//
// ⛔ ArticlesResponseSchema is right and is not to be relaxed to make this pass. It is strict, so
// an added field is a failure — and that strictness is the only thing in the repository that
// notices a stale serializer. Loosening it would turn this green and delete the observation.
test(
  'GET /articles answers without the article body',
  {
    annotation: {
      type: 'issue',
      description:
        'spec/FINDINGS.md — D-8; GitHub issue to be filed when the repository is published',
    },
  },
  async ({ deployment }) => {
    const gate = await deployment('conduit-gate');

    const response = await gate.get('/articles?limit=5');

    expect(response.status).toBe(200);
    expect(response.body).toMatchSchema(ArticlesResponseSchema);
  }
);

// Turns green the day the gate deployment serialises a comment's author the way it already
// serialises every other author. `following` is part of the Profile the specification defines, and
// the same deployment returns it on GET /profiles/:username and on an article's author — it is
// missing only where a comment carries one.
//
// ⛔ ProfileSchema is right and is not to be relaxed to make this pass. Making `following`
// optional would turn this green everywhere and delete the observation, and it would take the
// article author and the profile endpoint down with it — one schema serves all three on purpose,
// which is what makes a disagreement between them visible at all.
//
// 🔑 It seeds its own comment, and that is the point of the test as much as the assertion is.
// Its predecessor in tests/contract/schemas.spec.ts read the newest article's comments, which are
// almost always none, so it validated an empty array and passed. A test that reads somebody else's
// data cannot promise it looked at any.
test(
  'D-12 — a comment carries its author the way every other endpoint does',
  {
    annotation: {
      type: 'issue',
      description:
        'spec/FINDINGS.md — D-12; GitHub issue to be filed when the repository is published',
    },
  },
  async ({ deployment, factories }) => {
    const gate = await deployment('conduit-gate');
    const { token } = await registerUser(gate);
    const author = gate.withToken(token);

    const written = await author.post('/articles', { article: factories.article.build() });
    const { article } = written.body as { article?: { slug?: string } };
    expect(
      article?.slug,
      `the case needs one article of its own to comment on; creating it answered HTTP ${written.status}`
    ).toBeTruthy();

    const posted = await author.post(`/articles/${article?.slug}/comments`, {
      comment: { body: 'A comment written by the test, so there is always exactly one to read.' },
    });

    expect(
      CREATE_SUCCESS,
      'the specification states no success status for creating a comment, only that it returns a ' +
        `Comment, so 200 and 201 are both accepted; this answered ${posted.status}`
    ).toContain(posted.status);
    expect(posted.body, 'the comment as the write returns it').toMatchSchema(CommentResponseSchema);

    const listed = await author.get(`/articles/${article?.slug}/comments`);
    const { comments } = listed.body as { comments?: unknown[] };

    // The floor the predecessor never had. Without it an empty list satisfies the schema below and
    // the test passes about nothing — which is exactly how this defect went unseen.
    expect(
      comments?.length,
      'the comment posted above must come back, or the schema assertion is about an empty array'
    ).toBe(1);

    expect(listed.status).toBe(200);
    expect(listed.body, 'and the same comment as the list returns it').toMatchSchema(
      CommentsResponseSchema
    );
  }
);
