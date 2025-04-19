"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const server_1 = require("@clerk/nextjs/server");
// Use default middleware - all routes public by default, protect specific routes later.
exports.default = (0, server_1.clerkMiddleware)();
// Try a slightly different, common matcher pattern
exports.config = {
    matcher: ['/((?!.+\.[\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
