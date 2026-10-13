import { clerkMiddleware } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { COMPANY_PATH, GUEST_COOKIE } from "./lib/guest";

const handleI18n = createMiddleware(routing);
const DEMO_SLUG = "demo";

/** Rooms marked "coming soon" in the sidebar: their URLs go back to the main hall (the pages stay in the code). */
const COMING_SOON_ROOM = /^(\/en)?\/c\/([^/]+)\/(sales|agents)(\/.*)?$/;

/** Locale routing for pages only; API routes and Clerk's proxy path are left alone. */
function route(request: NextRequest, userId: string | null = null) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api") || pathname.startsWith("/trpc") || pathname.startsWith("/__clerk")) return NextResponse.next();
  // Company pages need a sign-in. The only exception is the demo opened from the guest button (its cookie):
  // a link copied to another browser asks to sign in, then comes back to the same page.
  const company = pathname.match(COMPANY_PATH);
  if (company && !userId && !(company[2] === DEMO_SLUG && request.cookies.get(GUEST_COOKIE)?.value === "1")) {
    const login = new URL(`${company[1] ?? ""}/login`, request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  const soon = pathname.match(COMING_SOON_ROOM);
  if (soon) return NextResponse.redirect(new URL(`${soon[1] ?? ""}/c/${soon[2]}`, request.url));
  return handleI18n(request);
}

// Next.js 16: "proxy" replaces "middleware". With Clerk keys set, clerkMiddleware makes the session
// available to auth() in pages, layouts and Server Actions; without them the site runs as the demo.
export default process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? clerkMiddleware(async (auth, request) => route(request, (await auth()).userId))
  : (request: NextRequest) => route(request);

export const config = {
  matcher: [
    // Pages: everything except Next internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|pdf|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
