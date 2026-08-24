import { test, expect } from '@/fixtures';
import { ArticlesResponseSchema, ErrorsSchema } from '@/schemas/conduit.schema';

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
