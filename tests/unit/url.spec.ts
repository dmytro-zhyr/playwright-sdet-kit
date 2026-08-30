import { test, expect } from '@playwright/test';
import { stripLeadingSlash, withTrailingSlash } from '@api/url';

// Turns red if the base URL stops being slash-terminated, which silently drops the /api segment
// from every request and makes the whole suite talk to the wrong host path.
test.describe('withTrailingSlash', () => {
  test('adds a slash when it is missing', () => {
    expect(withTrailingSlash('https://api.realworld.show/api')).toBe(
      'https://api.realworld.show/api/'
    );
  });

  test('leaves an already terminated URL alone', () => {
    expect(withTrailingSlash('https://api.realworld.show/api/')).toBe(
      'https://api.realworld.show/api/'
    );
  });
});

// Turns red if a spec-shaped path such as "/tags" stops being converted to a relative one.
test.describe('stripLeadingSlash', () => {
  test('removes a single leading slash', () => {
    expect(stripLeadingSlash('/tags')).toBe('tags');
  });

  test('removes repeated leading slashes', () => {
    expect(stripLeadingSlash('///articles/slug')).toBe('articles/slug');
  });

  test('leaves an already relative path alone', () => {
    expect(stripLeadingSlash('articles/slug')).toBe('articles/slug');
  });

  test('does not touch slashes inside the path', () => {
    expect(stripLeadingSlash('/articles/slug/comments')).toBe('articles/slug/comments');
  });
});

// The point of the two helpers together: this is the only spelling that keeps the base path.
test('the two helpers together preserve the base path', () => {
  const href = new URL(
    stripLeadingSlash('/tags'),
    withTrailingSlash('https://api.realworld.show/api')
  ).href;

  expect(href).toBe('https://api.realworld.show/api/tags');
});
