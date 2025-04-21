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
import { StoryGenerationJobData } from '../../app/api/generate/story/route';
import { createVisionStoryGenerationPrompt, systemPrompt } from '../../lib/openai/prompts';
import openai from '../../lib/openai/index';
import { db } from '../../lib/db';
import { Prisma, Asset, BookStatus, PageType } from '@prisma/client';
import logger from '../../lib/logger';
import { z } from 'zod';

// --- Zod Schema for expected OpenAI JSON response ---
// Assumes OpenAI returns an object like: { "1": "Text for page 1", "2": "Text for page 2", ... }
const openAIResponseSchema = z.record(
    z.string().regex(/^\d+$/), // Key must be string representation of a number
    z.string().min(1) // Value must be a non-empty string
);
// --- End Zod Schema ---

// --- Job Processing Logic ---

// Augment Job Data type to expect bookId (needs to be added by API route)
interface WorkerJobData extends StoryGenerationJobData {
  bookId: string; 
}

async function processStoryGenerationJob(job: Job<WorkerJobData>) {
  // Extract bookId and access other data directly from job.data
  const { bookId } = job.data; // Destructure only bookId
  const userId = job.data.userId; // Access directly
  const bookData = job.data.bookData; // Access directly
  
  // Add null/undefined checks just in case
  if (!userId || !bookData || !bookId) {
    logger.error({ jobId: job.id, data: job.data }, 'Missing critical job data (userId, bookData, or bookId)');
    throw new Error('Invalid job data received.');
  }
  
  logger.info({ jobId: job.id, userId, bookId, bookTitle: bookData.bookTitle }, 'Processing story generation job...');

  try {
    // Step 0: Update status to GENERATING
    await db.book.update({
      where: { id: bookId },
      data: { status: BookStatus.GENERATING }, // Use imported enum
    });
    logger.info({ jobId: job.id, bookId }, 'Book status updated to GENERATING');

    // Step 1: Construct the prompt using the new vision-specific function
    // Ensure bookData includes the fetched assets from the API route
    const messageContent = createVisionStoryGenerationPrompt(bookData); // Pass bookData directly

    logger.info({ jobId: job.id }, 'Generated vision prompt content for OpenAI');

    // Step 2: Call OpenAI API (using Chat Completions for GPT-4o Vision)
    // Reference: https://platform.openai.com/docs/guides/vision
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Or another vision-capable model
      messages: [
        {
          role: "system",
          // Use the imported systemPrompt
          content: systemPrompt 
        },
        {
          role: "user",
          // Pass the array of message content parts directly
          content: messageContent, 
        },
      ],
      // Add response_format for JSON if supported and reliable
      // response_format: { type: "json_object" }, 
      max_tokens: 1500, // Adjust as needed
      temperature: 0.7, // Adjust creativity
    });

    let rawResult = completion.choices[0]?.message?.content;
    logger.info({ jobId: job.id }, 'Received response from OpenAI');

    if (!rawResult) {
      throw new Error('OpenAI returned an empty response.');
    }

    // --- Refined Cleanup Step for Markdown Fence ---
    let jsonString = rawResult.trim();
    // Try regex first, capturing content between fences (more robust)
    const regexMatch = jsonString.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/m);
    if (regexMatch && regexMatch[1]) {
        jsonString = regexMatch[1].trim();
    } else {
        // Fallback: If it looks like it starts/ends with fences, strip first/last line
        const lines = jsonString.split('\n');
        if (lines.length >= 2 && lines[0].startsWith('```') && lines[lines.length - 1].endsWith('```')) {
            jsonString = lines.slice(1, -1).join('\n').trim();
        }
        // If still starts with ``` (maybe no closing fence?), try stripping just that
        if (jsonString.startsWith('```')) {
            jsonString = jsonString.substring(jsonString.indexOf('\n') + 1).trim();
        }
    }
    // --- End Refined Cleanup Step ---

    // Step 3: Parse and Validate the CLEANED JSON string
    let storyJson: z.infer<typeof openAIResponseSchema>;
    try {
      // Use the cleaned jsonString for parsing
      const parsedJson = JSON.parse(jsonString);
      storyJson = openAIResponseSchema.parse(parsedJson);
    } catch (parseOrValidationError: any) {
      // Log the original rawResult AND the cleaned jsonString for debugging
      logger.error({ jobId: job.id, rawResult, jsonString, error: parseOrValidationError.message }, 'Failed to parse or validate cleaned OpenAI JSON response');
      const details = parseOrValidationError instanceof z.ZodError ? parseOrValidationError.errors : parseOrValidationError.message;
      throw new Error(`Failed to parse or validate AI response: ${JSON.stringify(details)}`);
    }
    logger.info({ jobId: job.id, pages: Object.keys(storyJson).length }, 'Successfully parsed and validated story JSON');

    // Step 4: Store the generated text in the Page model
    const pageCreationData = Object.entries(storyJson).map(([pageNumberStr, textContent]) => {
      const pageNumber = parseInt(pageNumberStr, 10);
      if (isNaN(pageNumber) || typeof textContent !== 'string') {
        // Log a warning or error if the format is unexpected
        logger.warn({ jobId: job.id, pageNumberStr, textContent }, 'Skipping invalid page data from AI response');
        return null; // Filter out invalid entries later
      }
      // Determine PageType based on bookData 
      // Note: Assumes bookData contains isDoubleSpread. Need to ensure this is passed from API.
      const pageTypeEnum = bookData.isDoubleSpread ? PageType.SPREAD : PageType.SINGLE;
      
      return {
        bookId: bookId,
        pageNumber: pageNumber,
        text: textContent,
        pageType: pageTypeEnum, // Use the imported enum member
      };
    }).filter((data): data is NonNullable<typeof data> => data !== null); // Filter out nulls from invalid entries

    if (pageCreationData.length === 0 && Object.keys(storyJson).length > 0) {
        logger.error({ jobId: job.id, storyJson }, 'Failed to prepare any valid page data from AI response');
        throw new Error('AI response contained no valid page data.')
    }
    
    if (pageCreationData.length > 0) {
        logger.info({ jobId: job.id, count: pageCreationData.length }, 'Storing generated pages in database...');
        // Use createMany for efficiency
        await db.page.createMany({
          data: pageCreationData,
          skipDuplicates: true, // Skip if a page with the same unique constraint (e.g., bookId+pageNumber) somehow exists
        });
        logger.info({ jobId: job.id, count: pageCreationData.length }, 'Successfully stored generated pages.');
    } else {
        logger.warn({ jobId: job.id }, 'No pages generated or stored from AI response.');
    }
    // logger.debug({ jobId: job.id, storyJson }, `Generated Story JSON`); // Kept original log if needed

    // Step 5: Update status to COMPLETED and store token usage
    const usage = completion.usage; // Extract usage object
    logger.info({ jobId: job.id, bookId, usage }, 'Updating book status and token counts.');
    await db.book.update({
      where: { id: bookId },
      data: { 
        status: BookStatus.COMPLETED, // Use imported enum
        // Store token counts if available
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
       },
    });
    // Use logger
    logger.info({ jobId: job.id, bookId }, 'Book status updated to COMPLETED and token counts stored.');

    return storyJson; // Return result for potential logging by BullMQ

  } catch (error: any) {
    logger.error({ jobId: job.id, bookId, error: error.message }, 'Error processing story generation job');
    // Update status to FAILED on error
    try {
      await db.book.update({
        where: { id: bookId },
        data: { status: BookStatus.FAILED }, // Use imported enum
      });
      logger.info({ jobId: job.id, bookId }, 'Book status updated to FAILED');
    } catch (updateError: any) {
      logger.error({ jobId: job.id, bookId, error: updateError.message }, 'Failed to update book status to FAILED');
    }
    throw error; // Re-throw original error for BullMQ retry logic
  }
}

// --- Worker Initialization ---

logger.info('Initializing Story Generation Worker...');

const worker = new Worker<WorkerJobData>(
  QueueName.StoryGeneration,
  processStoryGenerationJob,
  {
    ...workerConnectionOptions,
    concurrency: 5, // Process up to 5 jobs concurrently (adjust as needed)
    removeOnComplete: { count: 1000 }, // Keep last 1000 completed jobs
    removeOnFail: { count: 5000 }, // Keep last 5000 failed jobs
  }
);

worker.on('completed', (job, result) => {
  logger.info({ jobId: job.id }, `Job completed.`);
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, `Job failed.`);
});

worker.on('error', err => {
  logger.error({ error: err.message }, 'Worker error');
});

logger.info('Story Generation Worker started.');

// Graceful shutdown (optional but recommended)
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing worker...');
  await worker.close();
  logger.info('Worker closed.');
  process.exit(0);
}); 