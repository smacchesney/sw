import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db as prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  const { searchParams } = new URL(request.url);
  const bookId = searchParams.get('bookId');

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!bookId) {
    return NextResponse.json({ error: 'Missing bookId query parameter' }, { status: 400 });
  }

  try {
    const book = await prisma.book.findUnique({
      where: {
        id: bookId,
        userId: userId, // Ensure ownership
      },
      select: {
        status: true, // Select only the status field
      },
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ status: book.status }, { status: 200 });

  } catch (error) {
    console.error(`Error fetching status for book ${bookId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch book status' }, { status: 500 });
  }
} 