"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const client_1 = require("@/generated/prisma/client");
// Initialize PrismaClient, reusing the instance in development
exports.db = globalThis.prisma || new client_1.PrismaClient({
// Optional: Log database queries during development
// log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
// Store the instance in the global variable in development
if (process.env.NODE_ENV !== 'production')
    globalThis.prisma = exports.db;
