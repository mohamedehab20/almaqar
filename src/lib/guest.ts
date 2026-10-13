/**
 * Guest mode is opened only by the "continue as a guest" button, which sets this session cookie.
 * A company link copied to another browser (no sign-in, no cookie) goes to sign-in instead of the demo.
 */
export const GUEST_COOKIE = "almaqr_guest";

/** Company pages: /c/<slug>/… with an optional /en prefix. */
export const COMPANY_PATH = /^(\/en)?\/c\/([a-z0-9-]+)(\/[a-z0-9\-/]*)?$/;

/** The page to open after sign-in: only a company page on this site (never an outside URL). */
export function safeNext(next: string | null | undefined) {
  return next && COMPANY_PATH.test(next) ? next : null;
}
