// Load environment variables next
import * as dotenv from 'dotenv';
import path from 'path'; // Import path

// Explicitly point dotenv to the root .env file using forward slashes
dotenv.config({ path: path.resolve(__dirname, '../../../', '.env') });

// --- DEBUGGING: Log environment variables as seen by the worker ---
console.log(`[ILLUS Worker] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[ILLUS Worker] LOG_LEVEL: ${process.env.LOG_LEVEL}`);
// --- END DEBUGGING ---

import { Worker, Job } from 'bullmq';
// Remove .js extensions
import { QueueName, workerConnectionOptions } from '../../lib/queue/index';
import { IllustrationGenerationJobData } from '../../app/api/generate/illustrations/route';
import { db } from '../../lib/db';
import { BookStatus, Page, Book, Prisma } from '@prisma/client';

// Add OpenAI SDK import
import OpenAI, { toFile } from 'openai';

import cloudinary from '../../lib/cloudinary';
// import logger from '../../lib/logger'; // Temporarily disable standard logger
import pino from 'pino'; // Import pino directly
const logger = pino({ level: 'debug' }, pino.destination({ sync: true })); // Force debug logger
console.log('[ILLUS Worker] Logger forced to DEBUG level for this worker.'); // Add confirmation

// Use require for the new CJS prompt library
const { createIllustrationPrompt, STYLE_LIBRARY } = require('@/lib/ai/styleLibrary'); 

// --- Initialize OpenAI Client --- 
const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
  logger.error('OPENAI_API_KEY is not set in environment variables.');
}
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
// --- End OpenAI Client Init ---

// --- Define Local Type for Fetched Book Data ---
// Ensure this includes fields needed by the new prompt options
type FetchedPageData = {
  id: string;
  pageNumber: number;
  text: string | null;
  originalImageUrl: string | null;
  generatedImageUrl: string | null;
  isTitlePage?: boolean | null; // Add the optional isTitlePage flag
};
type FetchedBookData = Book & { // Book includes artStyle, tone, theme, etc. 
  pages: FetchedPageData[]; 
};

// --- Job Processing Logic ---

async function processIllustrationGenerationJob(job: Job<IllustrationGenerationJobData>) {
  const { userId, bookId } = job.data;
  logger.info({ jobId: job.id, userId, bookId }, 'Processing illustration generation job...');

  // Use the specific local type for the book variable
  let book: FetchedBookData | null = null;

  try {
    // Cast the result of the Prisma query to our specific type
    book = await db.book.findUnique({
      where: { id: bookId, userId },
      include: {
        pages: {
          orderBy: { pageNumber: 'asc' },
          // IMPORTANT: Include originalImageUrl for re-illustration
          select: { 
              id: true, 
              pageNumber: true, 
              text: true, 
              originalImageUrl: true, // Make sure this field exists in schema
              isTitlePage: true,
              generatedImageUrl: true // To check if already done
          }
        },
      },
    }) as FetchedBookData | null;

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

    for (const page of book.pages) {
      if (page.generatedImageUrl) {
           logger.info({ jobId: job.id, pageNumber: page.pageNumber }, 'Illustration already exists, skipping.');
           continue;
      }
      
      // **** DEBUG: Check isTitlePage flag ****
      logger.debug({ jobId: job.id, pageNumber: page.pageNumber, isTitleFlagValue: page.isTitlePage }, 'Value of isTitlePage for current page');
      // **************************************

      logger.info({ jobId: job.id, bookId, pageNumber: page.pageNumber }, 'Generating illustration for page...');

      // **** ADD THIS LOG ****
      logger.debug({ jobId: job.id, pageNumber: page.pageNumber, isTitleFlag: page.isTitlePage }, 'Checking isTitlePage flag before prompt input');
      // *********************

      // --- Step 2a: Fetch original image data and get buffer --- 
      let originalImageBuffer: Buffer | null = null;
      let originalImageMimeType: string | null = null;

      // Ensure page.originalImageUrl is not null before using it
      if (page.originalImageUrl) {
          try {
              logger.info({ jobId: job.id, pageNumber: page.pageNumber }, `Fetching original image from ${page.originalImageUrl}`);
              const imageResponse = await fetch(page.originalImageUrl);
              if (!imageResponse.ok) {
                  throw new Error(`Failed to fetch original image: ${imageResponse.status} ${imageResponse.statusText}`);
              }

              // Get content type from header or infer
              const contentTypeHeader = imageResponse.headers.get('content-type');
              if (contentTypeHeader?.startsWith('image/')) {
                  originalImageMimeType = contentTypeHeader;
              } else {
                  const extension = page.originalImageUrl.split('.').pop()?.toLowerCase();
                  if (extension === 'jpg' || extension === 'jpeg') originalImageMimeType = 'image/jpeg';
                  else if (extension === 'png') originalImageMimeType = 'image/png';
                  else originalImageMimeType = 'image/jpeg'; // Default
              }

              // Store buffer directly
              const imageArrayBuffer = await imageResponse.arrayBuffer();
              originalImageBuffer = Buffer.from(imageArrayBuffer);
              logger.info({ jobId: job.id, pageNumber: page.pageNumber }, `Successfully fetched and stored original image (${originalImageMimeType}).`);

          } catch (fetchError: any) {
              logger.error({ jobId: job.id, pageNumber: page.pageNumber, error: fetchError.message }, 'Failed to fetch or store original image.');
              // Continue to next page if fetch fails
              continue; 
          }
      } else {
           logger.warn({ jobId: job.id, pageNumber: page.pageNumber }, 'Original image URL is missing, cannot generate illustration for this page.');
           continue; // Skip this page
      }
      // --- End Step 2a ---

      // Check for buffer instead of base64 string
      if (!originalImageBuffer || !originalImageMimeType) {
          logger.error({ jobId: job.id, pageNumber: page.pageNumber }, 'Missing image buffer or mime type after fetch attempt.');
          continue;
      }

      // --- Step 2b: Create OpenAI prompt using new function --- 
      const promptInput = {
          // Use the style key directly from the book record
          style: book.artStyle as keyof typeof STYLE_LIBRARY | undefined ?? 'cartoonBrights', // Provide default
          theme: book.theme,
          tone: book.tone,
          pageText: page.text,
          bookTitle: book.title,
          isTitlePage: !!page.isTitlePage       // Double-bang guarantees a boolean
      };
      // Call the NEW prompt function
      const textPrompt = createIllustrationPrompt(promptInput);
      logger.info({ jobId: job.id, pageNumber: page.pageNumber }, 'Generated OpenAI illustration prompt.');
      logger.debug({ jobId: job.id, pageNumber: page.pageNumber, prompt: textPrompt }, 'OpenAI Illustration Prompt Text:');
      // --- End Step 2b ---

      // --- Step 2c, 2d: Call OpenAI Edit API and Handle Response --- 
      let generatedImageBase64: string | null = null;
      let moderationBlocked = false; // Flag for moderation rejection
      let moderationReasonText: string | null = null; // Reason if blocked
      try {
         if (!openai) throw new Error("OpenAI Client not initialized.");
         if (!originalImageBuffer) throw new Error("Original image buffer missing.");
         const fileExtension = originalImageMimeType?.split('/')[1] || 'jpg';
         const fileName = `page_${page.pageNumber}_original.${fileExtension}`;
         const imageFile = await toFile(
             originalImageBuffer,
             fileName,
             { type: originalImageMimeType }
         );
         logger.info({ jobId: job.id, pageNumber: page.pageNumber }, 'Calling OpenAI Images Edit API...');

         const result = await openai.images.edit({
             model: "gpt-image-1",
             image: imageFile,
             prompt: textPrompt, // Use the newly generated prompt
             n: 1,
             size: "1024x1024",
             // response_format removed
         });

         logger.info({ jobId: job.id, pageNumber: page.pageNumber }, 'Received response from OpenAI.');

          // Check for content policy violations (example structure, adjust if needed)
          // NOTE: The exact structure for moderation feedback in the edit endpoint isn't 
          // clearly documented; this assumes a similar pattern to other endpoints.
          // We might need to inspect the raw `result` object if this doesn't work.
          if (result?.data?.[0]?.revised_prompt && result.data[0].revised_prompt !== textPrompt) {
              logger.warn({ jobId: job.id, pageNumber: page.pageNumber, original: textPrompt, revised: result.data[0].revised_prompt }, 'OpenAI revised the prompt.');
              // Decide if revision constitutes a failure or just a warning
          }
          // Check common safety/error fields (adjust based on actual API errors)
          // For example, DALL-E errors might be in error field or data might be empty with a flag
          // Let's assume for now a missing b64_json might indicate blocking or error

          const b64ImageData = result.data[0]?.b64_json;
          if (b64ImageData) {
              generatedImageBase64 = b64ImageData;
              logger.info({ jobId: job.id, pageNumber: page.pageNumber }, 'Extracted generated image data (b64_json).');
          } else {
              // If no image data, assume failure/blocking
              moderationBlocked = true;
              moderationReasonText = "Image generation failed or blocked by content policy."; // Generic reason
              // Attempt to get more specific reason if possible from API response structure
              // (e.g., result.error?.message, result.data[0]?.error, etc. - Inspect `result` object)
              logger.warn({ jobId: job.id, pageNumber: page.pageNumber, response: JSON.stringify(result) }, 'OpenAI response did not contain b64_json image data.');
          }

      } catch (apiError: any) {
          logger.error({ 
              jobId: job.id, 
              pageNumber: page.pageNumber, 
              error: apiError instanceof Error ? apiError.message : String(apiError),
              ...(apiError?.response?.data && { responseData: apiError.response.data }) 
          }, 'Error calling OpenAI Images Edit API.');
          moderationBlocked = true; // Treat API errors as generation failure
          moderationReasonText = apiError instanceof Error ? apiError.message : String(apiError);
          // No need to `continue` here, we want to update the page status below
      }
      // --- End Step 2c & 2d ---
      
      // --- Step 2e: Upload generated buffer to Cloudinary (only if not blocked) --- 
      let finalImageUrl: string | undefined = undefined;
      if (generatedImageBase64 && !moderationBlocked) {
        try {
            logger.info({ jobId: job.id, pageNumber: page.pageNumber }, 'Decoding and uploading generated image to Cloudinary...');
            const generatedImageBuffer = Buffer.from(generatedImageBase64, 'base64');
            
            // Upload buffer to Cloudinary
            const uploadResult = await new Promise<any>((resolve, reject) => {
                 cloudinary.uploader.upload_stream(
                     {
                         folder: `storywink/${bookId}/generated`, 
                         public_id: `page_${page.pageNumber}`,
                         overwrite: true,
                         tags: [`book:${bookId}`, `page:${page.pageNumber}`],
                         resource_type: "image"
                     },
                     (error, result) => {
                         if (error) { reject(error); } else { resolve(result); }
                     }
                 ).end(generatedImageBuffer);
            });

            if (!uploadResult?.secure_url) {
                throw new Error('Cloudinary upload did not return a secure URL.');
            }
            finalImageUrl = uploadResult.secure_url;
            logger.info({ jobId: job.id, pageNumber: page.pageNumber, cloudinaryUrl: finalImageUrl }, 'Successfully uploaded generated image to Cloudinary');

        } catch (uploadError: any) {
            logger.error({ jobId: job.id, pageNumber: page.pageNumber, error: uploadError.message }, 'Failed to upload generated image to Cloudinary.');
            // If upload fails after generation, mark as failed for this page
            moderationBlocked = true;
            moderationReasonText = moderationReasonText || `Cloudinary upload failed: ${uploadError.message}`;
        }
      } else if (!moderationBlocked) {
          // This case means API call succeeded but somehow no base64 data was extracted - treat as failure
          logger.warn({ jobId: job.id, pageNumber: page.pageNumber }, 'Skipping Cloudinary upload because no image data was generated/extracted.');
          moderationBlocked = true;
          moderationReasonText = moderationReasonText || "Image data extraction failed after API call.";
      }
      // --- End Step 2e --- 

      // --- Step 2f: Update Page Status and URL --- 
      // Always update the page status, even on failure
      try {
          await db.page.update({
              where: { id: page.id },
              data: {
                  // Set URL only if successful
                  generatedImageUrl: !moderationBlocked ? finalImageUrl : null,
                  // Set status based on outcome
                  moderationStatus: moderationBlocked ? "FLAGGED" : "OK", // Use FLAGGED for any failure/block
                  moderationReason: moderationReasonText,
              },
          });
          logger.info({ 
              jobId: job.id, 
              pageNumber: page.pageNumber, 
              status: moderationBlocked ? "FLAGGED" : "OK",
              reason: moderationReasonText
          }, 'Page status updated.');
      } catch (dbError: any) {
           logger.error({ jobId: job.id, pageNumber: page.pageNumber, error: dbError.message }, 'Failed to update page status in database.');
           // This is a more critical error, might warrant failing the job
      }
    }

    // Step 3: Update overall Book Status based on page outcomes
    logger.info({ jobId: job.id, bookId }, 'Checking final status of all pages...');
    const finalPages = await db.page.findMany({
        where: { bookId: bookId },
        select: { 
            generatedImageUrl: true,
            moderationStatus: true 
        }
    });

    let finalBookStatus: BookStatus;
    const totalPageCount = book.pages.length; // Get expected page count from initial fetch
    const successfulPages = finalPages.filter(p => p.moderationStatus === "OK" && p.generatedImageUrl);
    const flaggedPages = finalPages.filter(p => p.moderationStatus === "FLAGGED");
    // Consider other failure modes if needed

    if (successfulPages.length === totalPageCount) {
        finalBookStatus = BookStatus.COMPLETED;
        logger.info({ jobId: job.id, bookId }, 'All pages OK. Setting book status to COMPLETED.');
    } else if (flaggedPages.length > 0) {
        finalBookStatus = BookStatus.PARTIAL;
        logger.warn({ jobId: job.id, bookId, flaggedCount: flaggedPages.length }, 'Some pages were flagged. Setting book status to PARTIAL.');
    } else {
        // If not all pages are OK, but none are explicitly FLAGGED, assume general failure
        finalBookStatus = BookStatus.FAILED;
        logger.error({ jobId: job.id, bookId, successfulCount: successfulPages.length, totalCount: totalPageCount }, 'Not all pages completed successfully, none flagged. Setting book status to FAILED.');
    }

    // Update the book status
    await db.book.update({
      where: { id: bookId },
      data: { status: finalBookStatus },
    });
    logger.info({ jobId: job.id, bookId, finalStatus: finalBookStatus }, 'Final book status updated.');

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

logger.info('Initializing Illustration Generation Worker (OpenAI Mode)...');

const worker = new Worker<IllustrationGenerationJobData>(
  QueueName.IllustrationGeneration,
  processIllustrationGenerationJob,
  {
    ...workerConnectionOptions,
    concurrency: 1, // Keep concurrency 1 for now
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

logger.info('Illustration Generation Worker started (OpenAI Mode).');

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing illustration worker...');
  await worker.close();
  logger.info('Illustration worker closed.');
  process.exit(0);
}); 