import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { refreshSession } from "./lib/supabase/proxy";

const handleI18n = createMiddleware(routing);

// Next.js 16: "proxy" replaces "middleware". Handles locale routing, then refreshes the
// Supabase session cookies. Auth redirects for the (app) routes will be added here later.
export default async function proxy(request: NextRequest) {
  const response = handleI18n(request);
  return refreshSession(request, response);
}

export const config = {
  // Skip API routes, Next internals and files with an extension (images, favicon, ...)
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
