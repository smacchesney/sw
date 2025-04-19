import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PrismaClient } from '@/generated/prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema for request body validation
const updatePageSchema = z.object({
  text: z.string().min(1, { message: "Text content cannot be empty" }), // Require text
});

export async function PATCH(
  request: Request,
  { params }: { params: { bookId: string; pageId: string } }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { bookId, pageId } = params;

  if (!bookId || !pageId) {
    return NextResponse.json({ error: 'Missing bookId or pageId parameter' }, { status: 400 });
  }

  try {
    // Validate request body
    const body = await request.json();
    const validation = updatePageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validation.error.errors }, { status: 400 });
    }

    const { text } = validation.data;

    // Find the book and verify ownership (implicitly via userId on Book)
    // Also verify the page belongs to this book
    const page = await prisma.page.findUnique({
      where: {
        id: pageId,
        bookId: bookId, // Ensure page belongs to the specified book
        // Optional but recommended: Ensure the book belongs to the user
        // This requires adding a relation from Page -> Book -> User or just checking Book ownership separately
        book: {
           userId: userId,
        },
      },
    });

    if (!page) {
      return NextResponse.json({ error: 'Page not found or you do not have permission to edit it' }, { status: 404 });
    }

    // Update the page text
    const updatedPage = await prisma.page.update({
      where: {
        id: pageId,
      },
      data: {
        text: text,
      },
    });

    console.log(`User ${userId} updated page ${pageId} for book ${bookId}`);
    return NextResponse.json(updatedPage, { status: 200 });

  } catch (error) {
    console.error(`Error updating page ${pageId} for book ${bookId}:`, error);
    // Handle potential JSON parsing errors
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update page' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
} 