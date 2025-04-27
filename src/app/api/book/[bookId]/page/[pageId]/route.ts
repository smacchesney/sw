import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';

// Zod schema for request body validation
const updatePageSchema = z.object({
  text: z.string(), // Allow empty string, can be handled by confirmation logic if needed
});

export async function PATCH(
  request: NextRequest,
  { params }
) {
  // Cast params inside
  const { bookId, pageId } = params as { bookId: string, pageId: string };
  
  // Now perform auth check
  const authResult = await auth();
  const userId = authResult?.userId;
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
        // Add bookId and userId check here for extra safety
        bookId: bookId,
        book: { userId: userId },
      },
      data: {
        text: text,
        textConfirmed: false, // Explicitly unconfirm on edit
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
  }
} 