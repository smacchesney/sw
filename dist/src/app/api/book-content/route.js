"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const server_2 = require("@clerk/nextjs/server");
const client_1 = require("@/generated/prisma/client");
const prisma = new client_1.PrismaClient();
async function GET(request) {
    const { userId } = await (0, server_2.auth)();
    if (!userId) {
        return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get('bookId');
    if (!bookId) {
        return server_1.NextResponse.json({ error: 'Missing bookId parameter' }, { status: 400 });
    }
    try {
        const book = await prisma.book.findUnique({
            where: {
                id: bookId,
                userId: userId, // Ensure user owns the book
            },
            include: {
                pages: {
                    orderBy: {
                        pageNumber: 'asc', // Order pages correctly
                    },
                    select: {
                        text: true, // Only select the text field
                        pageNumber: true,
                        // Add other fields if needed by review page, e.g., originalImageUrl?
                    },
                },
            },
        });
        if (!book) {
            return server_1.NextResponse.json({ error: 'Book not found or access denied' }, { status: 404 });
        }
        // We only need to return the pages array for the frontend
        return server_1.NextResponse.json({ pages: book.pages }, { status: 200 });
    }
    catch (error) {
        console.error(`Error fetching content for book ${bookId}:`, error);
        return server_1.NextResponse.json({ error: 'Failed to fetch book content' }, { status: 500 });
    }
    finally {
        await prisma.$disconnect();
    }
}
