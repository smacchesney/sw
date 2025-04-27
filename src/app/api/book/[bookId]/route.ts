import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db as prisma } from '@/lib/db';
import { BookStatus } from '@prisma/client'; // Import necessary types

export async function GET(
  request: NextRequest,
  { params }
) {
  const { bookId } = params as { bookId: string };

  const authResult = await auth();
  const userId = authResult?.userId;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!bookId) {
    return NextResponse.json({ error: 'Missing bookId parameter' }, { status: 400 });
  }

  try {
    console.log(`Attempting to fetch book ${bookId} for user ${userId}`);
    const book = await prisma.book.findUnique({
      where: {
        id: bookId,
        userId: userId, // Crucial check for ownership
      },
      include: {
        pages: {
          orderBy: {
            pageNumber: 'asc',
          },
        },
      },
    });

    if (!book) {
      console.log(`Book ${bookId} not found or user ${userId} does not have permission.`);
      return NextResponse.json({ error: 'Book not found or you do not have permission to view it' }, { status: 404 });
    }

    console.log(`Successfully fetched book ${bookId} with ${book.pages.length} pages.`);
    // You might want to conditionally return data based on status if needed
    // For preview, we generally want the data regardless of status to show progress/errors
    return NextResponse.json(book, { status: 200 });

  } catch (error) {
    console.error(`Error fetching book ${bookId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch book data' }, { status: 500 });
  }
} 