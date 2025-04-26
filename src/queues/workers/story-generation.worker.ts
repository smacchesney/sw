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

// Reverted: Zod schema for the expected multi-page OpenAI JSON response
const openAIResponseSchema = z.record(
    z.string().regex(/^\d+$/), // Key must be string representation of a number (e.g., "1", "2")
    z.string().min(1) // Value must be a non-empty string (the page text)
);

// --- Job Processing Logic ---

// Use the imported job data type definition (matches API route)
type WorkerJobData = StoryGenerationJobData; // Use the imported type

async function processStoryGenerationJob(job: Job<WorkerJobData>) {
  // Extract data from the NEW job structure
  const { bookId, userId, promptContext, storyPages } = job.data; 
  
  // Add null/undefined checks just in case
  if (!userId || !bookId || !promptContext || !storyPages || storyPages.length === 0) {
    logger.error({ jobId: job.id, data: job.data }, 'Missing critical job data (userId, bookId, promptContext, or storyPages)');
    throw new Error('Invalid job data received.');
  }
  
  // Fetch the book record to get necessary details like pageLength
  const book = await db.book.findUnique({
      where: { id: bookId },
      select: { pageLength: true /* Add other fields if needed later */ }
  });

  if (!book) {
      logger.error({ jobId: job.id, bookId }, "Book not found in database for story generation job.");
      throw new Error('Book not found.');
  }

  logger.info({ jobId: job.id, userId, bookId, bookTitle: promptContext.bookTitle, pageCount: storyPages.length }, 'Processing story generation job...');

  try {
    // Step 0: Update status to GENERATING
    await db.book.update({
      where: { id: bookId },
      data: { status: BookStatus.GENERATING }, // Use imported enum
    });
    logger.info({ jobId: job.id, bookId }, 'Book status updated to GENERATING');

    // --- Generate Text for ALL pages in one go --- 

    // Step 1: Construct the prompt with full book context
    // We need the full Asset objects here for the prompt function
    // Let's assume the API route provided them correctly in the jobData structure
    // (We might need to adjust the API route and jobData structure again if not)
    // Constructing the input based on jobData and required StoryGenerationInput type
    // This requires mapping jobData.storyPages back to droppedAssets and getting full assets
    // **Alternative (Simpler if API Route can fetch):** Pass required data directly
    
    // Let's refine jobData structure first (needs corresponding API route change)
    // Assuming jobData now includes: bookId, userId, promptContext, allAssets, droppedAssetsMap
    const fullPromptInput = {
        ...promptContext, // Includes childName, bookTitle, tone, theme etc.
        pageCount: book.pageLength as 8 | 12 | 16, // Use fetched pageLength, assert type
        // Reconstruct droppedAssets map (index -> assetId)
        droppedAssets: storyPages.reduce((acc, page, index) => {
           acc[index] = page.assetId;
           return acc;
        }, {} as Record<number, string | null>),
        // We need the full Asset objects based on the assetIds
        // This assumes we query/pass them in jobData correctly
        assets: storyPages.map(p => ({ 
            id: p.assetId, 
            url: p.originalImageUrl, 
            // We might need MORE asset fields if prompt function uses them
        })).filter(a => a.id && a.url) as Asset[] // Filter out pages without assets and cast
    };

    // Log the input being sent to the prompt function for verification
    logger.info({ jobId: job.id, bookId }, "Constructing full story prompt...");
    const messageContent = createVisionStoryGenerationPrompt(fullPromptInput);

    // Step 2: Call OpenAI API ONCE
    logger.info({ jobId: job.id, bookId }, "Calling OpenAI for full story...");
    const completion = await openai.chat.completions.create({
        model: "gpt-4o", // Or another vision-capable model
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: messageContent },
        ],
        // Use original parameters for full story generation
        max_tokens: 1500, 
        temperature: 0.7,
        response_format: { type: "json_object" }, // Explicitly ask for JSON
    });

    let rawResult = completion.choices[0]?.message?.content;
    logger.info({ jobId: job.id, bookId }, 'Received response from OpenAI.');

    if (!rawResult) {
        logger.error({ jobId: job.id, bookId }, 'OpenAI returned an empty response.');
        throw new Error('OpenAI returned an empty response.');
    }

    // Step 3: Cleanup and Parse the multi-page JSON response
    let jsonString = rawResult.trim();
    const regexMatch = jsonString.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/m);
    if (regexMatch && regexMatch[1]) {
        jsonString = regexMatch[1].trim();
    } else {
        const lines = jsonString.split('\n');
        if (lines.length >= 2 && lines[0].startsWith('```') && lines[lines.length - 1].endsWith('```')) {
            jsonString = lines.slice(1, -1).join('\n').trim();
        }
        if (jsonString.startsWith('```')) {
            jsonString = jsonString.substring(jsonString.indexOf('\n') + 1).trim();
        }
    }

    let storyJson: z.infer<typeof openAIResponseSchema>;
    try {
        const parsedJson = JSON.parse(jsonString);
        // Use the original multi-page schema
        storyJson = openAIResponseSchema.parse(parsedJson);
        logger.info({ jobId: job.id, bookId, pageCount: Object.keys(storyJson).length }, 'Successfully parsed story JSON');
    } catch (parseOrValidationError: any) {
        logger.error({ jobId: job.id, rawResult, jsonString, error: parseOrValidationError.message }, 'Failed to parse/validate OpenAI JSON response');
        const details = parseOrValidationError instanceof z.ZodError ? parseOrValidationError.errors : parseOrValidationError.message;
        throw new Error(`Failed to parse or validate AI response: ${JSON.stringify(details)}`);
    }

    // Step 4: Prepare page update promises
    const pageUpdatePromises: Promise<any>[] = [];
    for (const page of storyPages) {
        // Find the text for this pageNumber in the parsed JSON
        const pageNumberStr = String(page.pageNumber);
        const textContent = storyJson[pageNumberStr];

        if (textContent) {
            logger.info({ jobId: job.id, pageId: page.pageId, textToSave: textContent }, "Preparing to update page text in DB");
            pageUpdatePromises.push(
                db.page.update({
                    where: { id: page.pageId },
                    data: {
                        text: textContent, // Use extracted text
                        textConfirmed: false,
                    },
                })
            );
        } else {
            logger.warn({ jobId: job.id, pageId: page.pageId, pageNumber: page.pageNumber }, `No text found in OpenAI response for page number ${page.pageNumber}. Skipping update.`);
        }
    }

    // Step 5: Execute all page updates
    if (pageUpdatePromises.length > 0) {
        logger.info({ jobId: job.id, bookId, count: pageUpdatePromises.length }, 'Updating generated page text in database...');
        await Promise.all(pageUpdatePromises);
        logger.info({ jobId: job.id, bookId }, 'Successfully updated page text.');
    } else {
        logger.warn({ jobId: job.id, bookId }, 'No pages were successfully processed to update text.');
        // Consider if this should mark the book as FAILED
    }

    // Step 6: Update final book status and token usage
    const usage = completion.usage; // Extract usage object
    const totalPromptTokens = usage?.prompt_tokens || 0;
    const totalCompletionTokens = usage?.completion_tokens || 0;
    const finalTotalTokens = usage?.total_tokens || 0;
    logger.info({ jobId: job.id, bookId, totalPromptTokens, totalCompletionTokens, finalTotalTokens }, 'Updating final book status and token counts.');
    await db.book.update({
        where: { id: bookId },
        data: {
            status: BookStatus.COMPLETED, // Use imported enum
            promptTokens: totalPromptTokens,
            completionTokens: totalCompletionTokens,
            totalTokens: finalTotalTokens,
        },
    });
    logger.info({ jobId: job.id, bookId }, 'Book status updated to COMPLETED and token counts stored.');

    return { message: `Processed ${pageUpdatePromises.length} pages.` }; // Return summary

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