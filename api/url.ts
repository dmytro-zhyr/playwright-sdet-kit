/**
 * URL joining rules, kept in one place because getting them wrong fails quietly.
 *
 * Playwright resolves a request path against `baseURL` with `new URL(path, baseURL)`, and that
 * gives the intended result for exactly one of the four possible spellings:
 *
 *   base "…/api"   + path "/tags"  ->  https://host/tags        the /api segment is dropped
 *   base "…/api"   + path "tags"   ->  https://host/tags        same
 *   base "…/api/"  + path "/tags"  ->  https://host/tags        same
 *   base "…/api/"  + path "tags"   ->  https://host/api/tags    correct
 *
 * A leading slash makes the path absolute, which discards the base path. Tests are written with
 * spec-shaped paths (`/tags`, `/users`, `/articles/:slug`), so the normalisation has to happen
 * in code rather than in a convention nobody remembers.
 */

/** Guarantees the base URL ends with a slash, so its last path segment survives joining. */
export function withTrailingSlash(base: string): string {
  return base.endsWith('/') ? base : `${base}/`;
}

/** Strips leading slashes, so the path is joined onto the base instead of replacing it. */
export function stripLeadingSlash(path: string): string {
  return path.replace(/^\/+/, '');
}
