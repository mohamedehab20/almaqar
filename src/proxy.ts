import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16: "proxy" replaces "middleware". For now it only handles locale routing;
// auth checks for the (app) routes will be added here later.
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals and files with an extension (images, favicon, ...)
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
