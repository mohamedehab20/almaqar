/**
 * Clerk is configured when its publishable key is set (.env.local, Vercel env vars).
 * Without it the app keeps running as the public demo: no ClerkProvider, no clerkMiddleware.
 */
export const clerkEnabled = () => Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/** Where Clerk sends people after signing in or up: links invites, creates a new owner's company, opens it. */
export const AFTER_AUTH_URL = "/api/auth/after-sign-in";
