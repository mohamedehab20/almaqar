import { clerkMiddleware } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const handleI18n = createMiddleware(routing);

/** Rooms marked "coming soon" in the sidebar: their URLs go back to the main hall (the pages stay in the code). */
const COMING_SOON_ROOM = /^(\/en)?\/c\/([^/]+)\/(sales|agents)(\/.*)?$/;

/** Locale routing for pages only; API routes and Clerk's proxy path are left alone. */
function route(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api") || pathname.startsWith("/trpc") || pathname.startsWith("/__clerk")) return NextResponse.next();
  const soon = pathname.match(COMING_SOON_ROOM);
  if (soon) return NextResponse.redirect(new URL(`${soon[1] ?? ""}/c/${soon[2]}`, request.url));
  return handleI18n(request);
}

// Next.js 16: "proxy" replaces "middleware". With Clerk keys set, clerkMiddleware makes the session
// available to auth() in pages, layouts and Server Actions; without them the site runs as the demo.
export default process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? clerkMiddleware((_auth, request) => route(request)) : route;

export const config = {
  matcher: [
    // Pages: everything except Next internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|pdf|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
