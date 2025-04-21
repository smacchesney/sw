// Register module alias programmatically FIRST - REMOVE THIS BLOCK
// import path from 'path';
// import moduleAlias from 'module-alias';
// moduleAlias.addAlias('@', path.join(__dirname, '..', '..'));
// END REMOVE BLOCK

// Load environment variables next
import * as dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
// Remove .js extensions
import { QueueName, workerConnectionOptions } from '../../lib/queue/index';
import { IllustrationGenerationJobData } from '../../app/api/generate/illustrations/route';
import { db } from '../../lib/db';
import { BookStatus, Page, Book, Prisma } from '@prisma/client';
import openai from '../../lib/openai/index';
import cloudinary from '../../lib/cloudinary';
import { createDalleIllustrationPrompt, DallePromptInput } from '../../lib/openai/prompts';
import logger from '../../lib/logger';

// --- Job Processing Logic ---

async function processIllustrationGenerationJob(job: Job<IllustrationGenerationJobData>) {
  const { userId, bookId } = job.data;
  logger.info({ jobId: job.id, userId, bookId }, 'Processing illustration generation job...');

  let book: (Book & { pages: Page[] }) | null = null; // Define book variable outside try block for finally block

  try {
    // Step 1: Fetch Book and Pages
    book = await db.book.findUnique({
      where: { id: bookId, userId },
      include: {
        pages: {
          orderBy: { pageNumber: 'asc' }, // Process pages in order
        },
      },
    });

    if (!book) {
      throw new Error(`Book not found (ID: ${bookId}) for user ${userId}`);
    }

    if (book.status !== BookStatus.ILLUSTRATING) {
      // If status isn't ILLUSTRATING, maybe it was already processed or failed?
      // Log a warning and potentially skip, or re-verify status.
      logger.warn({ jobId: job.id, bookId, status: book.status }, 'Book not in ILLUSTRATING state, potentially skipping job.');
      // For now, we'll exit gracefully. Consider more robust handling if needed.
      return; 
    }

    logger.info({ jobId: job.id, bookId, pageCount: book.pages.length }, 'Fetched book and pages for illustration.');

    // Step 2: Loop through pages and generate illustrations
    for (const page of book.pages) {
      logger.info({ jobId: job.id, bookId, pageNumber: page.pageNumber }, 'Generating illustration for page...');
      
      // 2a: Generate DALL-E Prompt
      const promptInput: DallePromptInput = {
        artStyle: book.artStyle,
        storyTone: book.tone,
        pageText: page.text,
        childName: book.childName,
        theme: book.theme,
        keyCharacters: book.keyCharacters,
        specialObjects: book.specialObjects,
      };
      const dallePrompt = createDalleIllustrationPrompt(promptInput);
      logger.info({ jobId: job.id, pageNumber: page.pageNumber }, 'Generated DALL-E prompt');
      // logger.debug({ jobId: job.id, prompt: dallePrompt }, 'DALL-E Prompt Content'); // Uncomment for debugging

      // 2b: Call DALL-E API
      // --- Add Delay to respect rate limits (5 RPM = 12s delay) ---
      logger.info({ jobId: job.id, pageNumber: page.pageNumber, delaySeconds: 12 }, 'Waiting before DALL-E request...');
      await new Promise(resolve => setTimeout(resolve, 12000)); // 12 seconds
      // --- End Delay ---
      
      // Ref: https://platform.openai.com/docs/api-reference/images/create
      const imageResponse = await openai.images.generate({
        model: "dall-e-3", 
        prompt: dallePrompt,
        n: 1, // Generate one image per page
        size: "1024x1024", // Standard square size
        quality: "standard", // Or "hd"
        response_format: "url", // Get URL directly for easier upload
        // style: "vivid", // or "natural"
        user: userId, // Pass user ID for monitoring/safety
      });

      const generatedUrl = imageResponse.data[0]?.url;
      if (!generatedUrl) {
        throw new Error(`DALL-E did not return a URL for page ${page.pageNumber}`);
      }
      logger.info({ jobId: job.id, pageNumber: page.pageNumber }, 'Received image URL from DALL-E');

      // 2c: Upload image URL to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(generatedUrl, {
        folder: `storywink/${bookId}/generated`, // Organize uploads
        public_id: `page_${page.pageNumber}`,
        overwrite: true, // Overwrite if regenerating
        // Add tags or other metadata if needed
        tags: [`book:${bookId}`, `page:${page.pageNumber}`]
      });

      if (!uploadResult?.secure_url) {
         throw new Error(`Failed to upload image to Cloudinary for page ${page.pageNumber}`);
      }
      const finalImageUrl = uploadResult.secure_url;
      logger.info({ jobId: job.id, pageNumber: page.pageNumber, cloudinaryUrl: finalImageUrl }, 'Uploaded image to Cloudinary');

      // 2d: Update Page with generatedImageUrl
      await db.page.update({
        where: { id: page.id },
        data: { generatedImageUrl: finalImageUrl },
      });
      logger.info({ jobId: job.id, bookId, pageNumber: page.pageNumber }, 'Page updated with illustration URL.');
    }

    // Step 3: Update Book Status to COMPLETED
    await db.book.update({
      where: { id: bookId },
      data: { status: BookStatus.COMPLETED },
    });
    logger.info({ jobId: job.id, bookId }, 'Book status updated to COMPLETED after illustration.');

  } catch (error: any) {
    logger.error({ jobId: job.id, bookId, error: error.message, stack: error.stack }, 'Error processing illustration generation job');
    // Update status to FAILED on error ONLY IF book exists and status is ILLUSTRATING
    if (book && book.status === BookStatus.ILLUSTRATING) {
      try {
        await db.book.update({
          where: { id: bookId },
          data: { status: BookStatus.FAILED },
        });
        logger.info({ jobId: job.id, bookId }, 'Book status updated to FAILED due to error.');
      } catch (updateError: any) {
        logger.error({ jobId: job.id, bookId, error: updateError.message }, 'Failed to update book status to FAILED');
      }
    }
    throw error; // Re-throw original error for BullMQ retry logic
  }
}

// --- Worker Initialization ---

logger.info('Initializing Illustration Generation Worker...');

const worker = new Worker<IllustrationGenerationJobData>(
  QueueName.IllustrationGeneration,
  processIllustrationGenerationJob,
  {
    ...workerConnectionOptions,
    concurrency: 1, // Set concurrency to 1
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  }
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, `Illustration job completed.`);
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message, stack: err.stack }, `Illustration job failed.`);
});

worker.on('error', err => {
  logger.error({ error: err.message }, 'Illustration worker error');
});

logger.info('Illustration Generation Worker started.');

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing illustration worker...');
  await worker.close();
  logger.info('Illustration worker closed.');
  process.exit(0);
}); 