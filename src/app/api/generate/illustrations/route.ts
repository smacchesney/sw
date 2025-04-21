import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { getQueue, QueueName } from '@/lib/queue';
import { db as prisma } from '@/lib/db';
import { BookStatus } from '@prisma/client';

// Define the expected input schema using Zod
const illustrationRequestSchema = z.object({
  bookId: z.string().min(1, { message: "Valid Book ID is required" }),
});

// Define the structure of the job data
export interface IllustrationGenerationJobData {
  userId: string;
  bookId: string;
}

export async function POST(request: Request) {
  const authResult = await auth();
  const userId = authResult?.userId;

  if (!userId) {
    console.warn('Unauthorized illustration generation attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let requestData;
  try {
    const rawData = await request.json();
    requestData = illustrationRequestSchema.parse(rawData);
    console.info({ userId, bookId: requestData.bookId }, 'Received illustration generation request');
  } catch (error) {
    console.error({ userId, error }, 'Invalid illustration generation request data');
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to parse request data' }, { status: 400 });
  }

  try {
    // Step 1: Validate Book Ownership and Status
    console.info({ userId, bookId: requestData.bookId }, 'Validating book...');
    const book = await prisma.book.findUnique({
      where: {
        id: requestData.bookId,
        userId: userId, // Ensure the user owns the book
      },
      select: {
        status: true, // Select only the status we need for validation
        id: true,
      }
    });

    if (!book) {
      console.warn({ userId, bookId: requestData.bookId }, 'Book not found or user mismatch for illustration generation.');
      return NextResponse.json({ error: 'Book not found or access denied.' }, { status: 404 });
    }

    // Ideally, story generation should be COMPLETED before illustration starts
    if (book.status !== BookStatus.COMPLETED && book.status !== BookStatus.GENERATING) {
      // Allow GENERATING if polling is slow, but COMPLETED is ideal
      // Might need refinement based on exact polling/state flow
      console.warn({ userId, bookId: requestData.bookId, status: book.status }, 'Book not in correct state for illustration generation.');
      // For now, let's allow it and let the worker potentially handle retries/waits if needed
      // return NextResponse.json({ error: `Book must be in COMPLETED state (current: ${book.status})` }, { status: 409 });
    }

    console.info({ userId, bookId: book.id }, 'Book validation successful.');

    // Step 2: Update Book Status to ILLUSTRATING
    // It's important to update status *before* queuing to avoid race conditions
    // if the worker picks up the job instantly.
    await prisma.book.update({
        where: { id: book.id },
        data: { status: BookStatus.ILLUSTRATING }
    });
    console.info({ userId, bookId: book.id }, 'Book status updated to ILLUSTRATING.');

    // Step 3: Prepare Job Data
    const jobData: IllustrationGenerationJobData = {
      userId,
      bookId: book.id,
    };

    // Step 4: Add job to the Illustration Generation queue
    const illustrationQueue = getQueue(QueueName.IllustrationGeneration);
    const job = await illustrationQueue.add('generate-illustrations', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 }, // Longer delay for image gen?
    });

    console.info({ userId, bookId: book.id, jobId: job.id }, 'Added illustration generation job to queue');

    // Step 5: Return Job ID and Book ID
    return NextResponse.json({ jobId: job.id, bookId: book.id }, { status: 202 });

  } catch (error: any) {
    console.error({ userId, bookId: requestData.bookId, error: error.message }, 'Error during illustration job queuing or validation');
    // Attempt to revert status if queuing failed after status update?
    // This is complex; maybe the worker should handle initial status checks.
  }
} 