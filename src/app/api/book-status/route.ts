import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient, BookStatus } from '@/generated/prisma/client';

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
      select: {
        status: true, // Only select the status field
      },
    });

    if (!book) {
      return NextResponse.json({ error: 'Book not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ status: book.status }, { status: 200 });

  } catch (error) {
    console.error(`Error fetching status for book ${bookId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch book status' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
} 