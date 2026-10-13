/**
 * Clerk is configured when its publishable key is set (.env.local, Vercel env vars).
 * Without it the app keeps running as the public demo: no ClerkProvider, no clerkMiddleware.
 */
export const clerkEnabled = () => Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/**
 * Clerk's Frontend API host, read from the publishable key ("pk_test_" + base64("<host>$")). The layout
 * preconnects to it so the sign-in form's scripts start sooner. null when Clerk is off or the key is odd.
 */
export function clerkFrontendHost() {
  const encoded = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.split("_")[2];
  if (!encoded) return null;
  const host = Buffer.from(encoded, "base64").toString("utf8").replace(/\$$/, "");
  return /^[a-z0-9.-]+$/i.test(host) ? host : null;
}

/** Where Clerk sends people after signing in or up: links invites, creates a new owner's company, opens it. */
export const AFTER_AUTH_URL = "/api/auth/after-sign-in";
