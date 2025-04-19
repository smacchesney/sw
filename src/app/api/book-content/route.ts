import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '@/generated/prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bookId = searchParams.get('bookId');

  if (!bookId) {
    return NextResponse.json({ error: 'Missing bookId parameter' }, { status: 400 });
  }

  try {
    const book = await prisma.book.findUnique({
      where: {
        id: bookId,
        userId: userId, // Ensure user owns the book
      },
      include: {
        pages: { // Include the related pages
          orderBy: {
            pageNumber: 'asc', // Order pages correctly
          },
          select: {
            id: true,
            text: true, // Select the text field
            pageNumber: true,
            // Add other fields if needed by review page, e.g., originalImageUrl?
          },
        },
      },
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found or access denied' }, { status: 404 });
    }

    // We only need to return the pages array for the frontend
    return NextResponse.json({ pages: book.pages }, { status: 200 });

  } catch (error) {
    console.error(`Error fetching content for book ${bookId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch book content' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
} 