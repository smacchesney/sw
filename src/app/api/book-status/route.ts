import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db as prisma } from '@/lib/db';
import { BookStatus } from '@prisma/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bookId = searchParams.get('bookId');

  const authResult = await auth();
  const userId = authResult?.userId;

  if (!userId) {
    console.warn('Unauthorized book status check attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!bookId) {
    return NextResponse.json({ error: 'Missing bookId parameter' }, { status: 400 });
  }

  try {
    const book = await prisma.book.findUnique({
      where: {
        id: bookId,
        userId: userId, // Ensure user owns the book
      },
      select: {
        status: true,
      },
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found or access denied' }, { status: 404 });
    }

    // Return the current status
    return NextResponse.json({ status: book.status }, { status: 200 });

  } catch (error) {
    console.error({ userId, bookId, error }, 'Error fetching book status');
    return NextResponse.json({ error: 'Failed to fetch book status' }, { status: 500 });
  }
} 