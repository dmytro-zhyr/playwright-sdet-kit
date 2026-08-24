import { z } from 'zod';

/**
 * Response shapes of the Conduit API.
 *
 * Every schema is strict: an unexpected field is a failure, not something to ignore. A
 * non-strict schema catches a REMOVED field and misses an ADDED one, and adding a field is the
 * more common way a contract changes. See spec/FINDINGS.md.
 *
 * Shapes were verified against the live target on 23 August 2026, not copied from the
 * specification. Where the two disagree, FINDINGS.md records it.
 */

export const ProfileSchema = z.strictObject({
  username: z.string().min(1),
  bio: z.string().nullable(),
  image: z.string().nullable(),
  following: z.boolean(),
});

export const UserSchema = z.strictObject({
  email: z.email(),
  // Not a JWT on this target — it returns an opaque token_<hex>. Asserting a JWT shape here
  // would be red for a reason that has nothing to do with the contract. See spec/FINDINGS.md.
  token: z.string().min(1),
  username: z.string().min(1),
  bio: z.string().nullable(),
  image: z.string().nullable(),
});

/**
 * An article as it appears inside a list. Deliberately without `body`.
 *
 * This is not a quirk of the instance: the specification removed `body` from list responses on
 * 16 August 2024 for performance. It affects GET /articles and GET /articles/feed.
 */
export const ArticlePreviewSchema = z.strictObject({
  // The specification states that slug is only guaranteed to be a unique string, and that how it
  // is derived is up to the implementation. No kebab-case regex here on purpose.
  slug: z.string().min(1),
  title: z.string(),
  description: z.string(),
  tagList: z.array(z.string()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  favorited: z.boolean(),
  favoritesCount: z.number().int().nonnegative(),
  author: ProfileSchema,
});

/** An article fetched on its own — the same shape plus `body`. */
export const ArticleSchema = ArticlePreviewSchema.extend({
  body: z.string(),
});

export const CommentSchema = z.strictObject({
  id: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  body: z.string(),
  author: ProfileSchema,
});

/** Validation failures: every field maps to an array of messages. */
export const ErrorsSchema = z.strictObject({
  errors: z.record(z.string(), z.array(z.string())),
});

export const UserResponseSchema = z.strictObject({ user: UserSchema });
export const ProfileResponseSchema = z.strictObject({ profile: ProfileSchema });
export const ArticleResponseSchema = z.strictObject({ article: ArticleSchema });
export const CommentResponseSchema = z.strictObject({ comment: CommentSchema });
export const CommentsResponseSchema = z.strictObject({ comments: z.array(CommentSchema) });
export const TagsResponseSchema = z.strictObject({ tags: z.array(z.string()) });

export const ArticlesResponseSchema = z.strictObject({
  articles: z.array(ArticlePreviewSchema),
  articlesCount: z.number().int().nonnegative(),
});
