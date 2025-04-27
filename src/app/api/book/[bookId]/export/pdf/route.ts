import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db as prisma } from '@/lib/db';
import { generateBookPdf } from '@/lib/pdf/generateBookPdf'; // Import the service
import logger from '@/lib/logger';
import { Book, Page } from '@prisma/client';

// Define the expected Book type with Pages for the PDF generator
type BookWithPages = Book & { pages: Page[] };

export async function GET(
  request: Request, 
  { params }: { params: { bookId: string } }
) {
  const { bookId } = params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!bookId) {
    return NextResponse.json({ error: 'Missing bookId parameter' }, { status: 400 });
  }

  try {
    logger.info({ userId, bookId }, "PDF export request received.");

    // 1. Fetch the full book data, including pages with text and generated URLs
    const bookData = await prisma.book.findUnique({
      where: {
        id: bookId,
        userId: userId, // Ensure ownership
      },
      include: {
        pages: {
          orderBy: { pageNumber: 'asc' },
          // Select all fields needed by generatePageHtml
          select: {
            id: true,
            pageNumber: true,
            text: true,
            generatedImageUrl: true,
            // Include other fields if needed by generatePageHtml
            originalImageUrl: true, // Might be useful for context? 
            textConfirmed: true,
            pageType: true,
            createdAt: true,
            updatedAt: true,
            bookId: true, // Need bookId if Page type is strictly checked
            moderationStatus: true, // Include new fields
            moderationReason: true,
          }
        },
      },
    });

    if (!bookData) {
      logger.warn({ userId, bookId }, "Book not found or user does not have permission for PDF export.");
      return NextResponse.json({ error: 'Book not found or access denied' }, { status: 404 });
    }

    // Basic check: Ensure the book is completed before allowing export?
    // if (bookData.status !== 'COMPLETED') {
    //   return NextResponse.json({ error: 'Book is not yet completed' }, { status: 400 });
    // }

    // 2. Generate the PDF buffer
    const pdfBuffer = await generateBookPdf(bookData as BookWithPages);

    // 3. Return the PDF as a response
    const fileName = `${bookData.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'storybook'}.pdf`;
    logger.info({ userId, bookId, fileName, size: pdfBuffer.length }, "Sending PDF file.");

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`, // Prompt download
      },
    });

  } catch (error: any) {
    logger.error({ userId, bookId, error: error.message }, "Error generating or retrieving PDF.");
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
} 