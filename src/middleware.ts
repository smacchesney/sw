import { clerkMiddleware } from "@clerk/nextjs/server";

// Revert to simplest default middleware
// This protects all routes including API routes by default
export default clerkMiddleware();

// Keep the original matcher which should invoke the middleware for API routes
export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}; 