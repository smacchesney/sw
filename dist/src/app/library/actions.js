"use strict";
"use server"; // Mark this file as containing Server Actions
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserBooks = getUserBooks;
exports.deleteBook = deleteBook;
exports.duplicateBook = duplicateBook;
const server_1 = require("@clerk/nextjs/server");
const db_1 = require("@/lib/db"); // Use named import
const logger_1 = __importDefault(require("@/lib/logger"));
// Import types from the new generated client location (Task 16.3)
const client_1 = require("@/generated/prisma/client");
const cache_1 = require("next/cache"); // Import for revalidation
async function getUserBooks() {
    // Fix: Add await to auth() call (Task 16.2)
    const { userId } = await (0, server_1.auth)();
    if (!userId) {
        logger_1.default.error("Attempted to fetch books without authentication.");
        // In a real app, you might redirect or throw a specific error
        // For now, return empty to avoid breaking the page for unauthenticated (though middleware should prevent this)
        // throw new Error("User not authenticated"); 
        return { inProgressBooks: [], completedBooks: [] };
    }
    logger_1.default.info({ userId }, "Fetching books for user library.");
    try {
        // Define selection explicitly for type safety
        const bookSelect = {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            childName: true,
            // thumbnailUrl: true, // Add if exists
        };
        // Fetch books using the defined selection
        const books = await db_1.db.book.findMany({
            where: { userId: userId },
            select: bookSelect, // Use the selection object
            orderBy: { updatedAt: 'desc' },
        });
        const inProgressBooks = [];
        const completedBooks = [];
        // Use Prisma.BookGetPayload for explicit typing (Task 16.3)
        books.forEach((book) => {
            // No need to check for null book here, findMany doesn't return sparse arrays
            const libraryBook = {
                // Map fields from the explicitly typed book object
                id: book.id,
                title: book.title,
                status: book.status,
                createdAt: book.createdAt,
                childName: book.childName,
                thumbnailUrl: null // Replace if needed
            };
            // Use imported BookStatus enum (Task 16.3)
            if (book.status === client_1.BookStatus.COMPLETED) {
                completedBooks.push(libraryBook);
            }
            else {
                // Treat DRAFT and GENERATING as in progress
                inProgressBooks.push(libraryBook);
            }
        });
        logger_1.default.info({ userId, inProgressCount: inProgressBooks.length, completedCount: completedBooks.length }, "Successfully fetched user books.");
        return { inProgressBooks, completedBooks };
    }
    catch (error) {
        logger_1.default.error({ userId, error }, "Failed to fetch user books.");
        // Depending on how you want to handle errors on the page,
        // you could throw the error here to be caught by an Error Boundary,
        // or return an empty state / error indicator.
        // Returning empty state for now.
        return { inProgressBooks: [], completedBooks: [] };
        // throw new Error("Failed to fetch books."); 
    }
}
async function deleteBook(bookId) {
    // Fix: Add await to auth() call (Task 16.2)
    const { userId } = await (0, server_1.auth)();
    if (!userId) {
        logger_1.default.error({ bookId }, "Attempted to delete book without authentication.");
        return { success: false, message: "Authentication required." };
    }
    logger_1.default.info({ userId, bookId }, "Attempting to delete book.");
    try {
        // First, verify the user owns the book
        const book = await db_1.db.book.findUnique({
            where: {
                id: bookId,
                userId: userId,
            },
            select: { id: true }, // Select only necessary field
        });
        if (!book) {
            logger_1.default.warn({ userId, bookId }, "Attempted to delete non-existent or unauthorized book.");
            return { success: false, message: "Book not found or access denied." };
        }
        // Delete the book
        await db_1.db.book.delete({
            where: {
                id: bookId,
                // No need for userId here again as we verified ownership above,
                // but including it adds an extra layer of safety.
                // userId: userId 
            },
        });
        logger_1.default.info({ userId, bookId }, "Successfully deleted book.");
        // Revalidate the library path to refresh the data on the page
        (0, cache_1.revalidatePath)('/library');
        return { success: true };
    }
    catch (error) {
        logger_1.default.error({ userId, bookId, error }, "Failed to delete book.");
        return { success: false, message: "Failed to delete book. Please try again." };
    }
}
async function duplicateBook(bookId) {
    // Fix: Add await to auth() call (Task 16.2)
    const { userId } = await (0, server_1.auth)();
    if (!userId) {
        logger_1.default.error({ bookId }, "Attempted to duplicate book without authentication.");
        return { success: false, message: "Authentication required." };
    }
    logger_1.default.info({ userId, bookId }, "Attempting to duplicate book.");
    try {
        // Find the original book and verify ownership
        const originalBook = await db_1.db.book.findUnique({
            where: {
                id: bookId,
                userId: userId,
            },
            // Select fields needed for duplication (exclude id, createdAt, updatedAt, status)
            select: {
                title: true,
                childName: true,
                pageLength: true,
                artStyle: true,
                tone: true,
                typography: true,
                theme: true,
                keyCharacters: true,
                specialObjects: true,
                excitementElement: true,
                userId: true,
                // Do NOT select pages here if we are not duplicating them
            }
        });
        if (!originalBook) {
            logger_1.default.warn({ userId, bookId }, "Attempted to duplicate non-existent or unauthorized book.");
            return { success: false, message: "Book not found or access denied." };
        }
        // Create the new book record
        const newBook = await db_1.db.book.create({
            data: Object.assign(Object.assign({}, originalBook), { title: `${originalBook.title} (Copy)`, status: client_1.BookStatus.DRAFT }),
            select: { id: true } // Select only the new ID
        });
        logger_1.default.info({ userId, originalBookId: bookId, newBookId: newBook.id }, "Successfully duplicated book.");
        // Revalidate the library path
        (0, cache_1.revalidatePath)('/library');
        return { success: true, newBookId: newBook.id };
    }
    catch (error) {
        logger_1.default.error({ userId, bookId, error }, "Failed to duplicate book.");
        return { success: false, message: "Failed to duplicate book. Please try again." };
    }
}
