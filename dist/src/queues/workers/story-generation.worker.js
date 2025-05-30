"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const index_1 = require("../../lib/queue/index"); // Keep index for clarity
const prompts_1 = require("../../lib/openai/prompts"); // No .ts
const index_2 = __importDefault(require("../../lib/openai/index")); // Keep index for clarity
const db_1 = require("../../lib/db"); // No .ts
const client_1 = require("@/generated/prisma/client");
const logger_1 = __importDefault(require("../../lib/logger")); // No .ts
const zod_1 = require("zod");
// --- Zod Schema for expected OpenAI JSON response ---
// Assumes OpenAI returns an object like: { "1": "Text for page 1", "2": "Text for page 2", ... }
const openAIResponseSchema = zod_1.z.record(zod_1.z.string().regex(/^\d+$/), // Key must be string representation of a number
zod_1.z.string().min(1) // Value must be a non-empty string
);
async function processStoryGenerationJob(job) {
    var _a, _b;
    // Extract bookId here
    const { userId, bookData, bookId } = job.data;
    logger_1.default.info({ jobId: job.id, userId, bookId, bookTitle: bookData.bookTitle }, 'Processing story generation job...');
    try {
        // Step 0: Update status to GENERATING
        await db_1.db.book.update({
            where: { id: bookId },
            data: { status: client_1.BookStatus.GENERATING }, // Use imported enum
        });
        logger_1.default.info({ jobId: job.id, bookId }, 'Book status updated to GENERATING');
        // Step 1: Construct the prompt using the new vision-specific function
        // Ensure bookData.assets contains the *actual* fetched asset data (from subtask 7.8)
        const messageContent = (0, prompts_1.createVisionStoryGenerationPrompt)(bookData);
        logger_1.default.info({ jobId: job.id }, 'Generated vision prompt content for OpenAI');
        // Step 2: Call OpenAI API (using Chat Completions for GPT-4o Vision)
        // Reference: https://platform.openai.com/docs/guides/vision
        const completion = await index_2.default.chat.completions.create({
            model: "gpt-4o", // Or another vision-capable model
            messages: [
                {
                    role: "system",
                    // Use the imported systemPrompt
                    content: prompts_1.systemPrompt
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
        const rawResult = (_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content;
        logger_1.default.info({ jobId: job.id }, 'Received response from OpenAI');
        if (!rawResult) {
            throw new Error('OpenAI returned an empty response.');
        }
        // Step 3: Parse and Validate the JSON result using Zod
        let storyJson;
        try {
            const parsedJson = JSON.parse(rawResult);
            storyJson = openAIResponseSchema.parse(parsedJson); // Validate structure
        }
        catch (parseOrValidationError) {
            logger_1.default.error({ jobId: job.id, rawResult, error: parseOrValidationError.message }, 'Failed to parse or validate OpenAI JSON response');
            // Include Zod error details if available
            const details = parseOrValidationError instanceof zod_1.z.ZodError ? parseOrValidationError.errors : parseOrValidationError.message;
            throw new Error(`Failed to parse or validate AI response: ${JSON.stringify(details)}`);
        }
        logger_1.default.info({ jobId: job.id, pages: Object.keys(storyJson).length }, 'Successfully parsed and validated story JSON');
        // Step 4: Store the generated text in the Page model
        const pageCreationData = Object.entries(storyJson).map(([pageNumberStr, textContent]) => {
            const pageNumber = parseInt(pageNumberStr, 10);
            if (isNaN(pageNumber) || typeof textContent !== 'string') {
                // Log a warning or error if the format is unexpected
                logger_1.default.warn({ jobId: job.id, pageNumberStr, textContent }, 'Skipping invalid page data from AI response');
                return null; // Filter out invalid entries later
            }
            // Determine PageType based on bookData 
            // Note: Assumes bookData contains isDoubleSpread. Need to ensure this is passed from API.
            const pageTypeEnum = bookData.isDoubleSpread ? client_1.PageType.SPREAD : client_1.PageType.SINGLE;
            return {
                bookId: bookId,
                pageNumber: pageNumber,
                text: textContent,
                pageType: pageTypeEnum, // Use the imported enum member
            };
        }).filter((data) => data !== null); // Filter out nulls from invalid entries
        if (pageCreationData.length === 0 && Object.keys(storyJson).length > 0) {
            logger_1.default.error({ jobId: job.id, storyJson }, 'Failed to prepare any valid page data from AI response');
            throw new Error('AI response contained no valid page data.');
        }
        if (pageCreationData.length > 0) {
            logger_1.default.info({ jobId: job.id, count: pageCreationData.length }, 'Storing generated pages in database...');
            // Use createMany for efficiency
            await db_1.db.page.createMany({
                data: pageCreationData,
                skipDuplicates: true, // Skip if a page with the same unique constraint (e.g., bookId+pageNumber) somehow exists
            });
            logger_1.default.info({ jobId: job.id, count: pageCreationData.length }, 'Successfully stored generated pages.');
        }
        else {
            logger_1.default.warn({ jobId: job.id }, 'No pages generated or stored from AI response.');
        }
        // logger.debug({ jobId: job.id, storyJson }, `Generated Story JSON`); // Kept original log if needed
        // Step 5: Update status to COMPLETED and store token usage
        const usage = completion.usage; // Extract usage object
        logger_1.default.info({ jobId: job.id, bookId, usage }, 'Updating book status and token counts.');
        await db_1.db.book.update({
            where: { id: bookId },
            data: {
                status: client_1.BookStatus.COMPLETED, // Use imported enum
                // Store token counts if available
                promptTokens: usage === null || usage === void 0 ? void 0 : usage.prompt_tokens,
                completionTokens: usage === null || usage === void 0 ? void 0 : usage.completion_tokens,
                totalTokens: usage === null || usage === void 0 ? void 0 : usage.total_tokens,
            },
        });
        // Use logger
        logger_1.default.info({ jobId: job.id, bookId }, 'Book status updated to COMPLETED and token counts stored.');
        return storyJson; // Return result for potential logging by BullMQ
    }
    catch (error) {
        logger_1.default.error({ jobId: job.id, bookId, error: error.message }, 'Error processing story generation job');
        // Update status to FAILED on error
        try {
            await db_1.db.book.update({
                where: { id: bookId },
                data: { status: client_1.BookStatus.FAILED }, // Use imported enum
            });
            logger_1.default.info({ jobId: job.id, bookId }, 'Book status updated to FAILED');
        }
        catch (updateError) {
            logger_1.default.error({ jobId: job.id, bookId, error: updateError.message }, 'Failed to update book status to FAILED');
        }
        throw error; // Re-throw original error for BullMQ retry logic
    }
}
// --- Worker Initialization ---
logger_1.default.info('Initializing Story Generation Worker...');
const worker = new bullmq_1.Worker(index_1.QueueName.StoryGeneration, processStoryGenerationJob, Object.assign(Object.assign({}, index_1.workerConnectionOptions), { concurrency: 5, removeOnComplete: { count: 1000 }, removeOnFail: { count: 5000 } }));
worker.on('completed', (job, result) => {
    logger_1.default.info({ jobId: job.id }, `Job completed.`);
});
worker.on('failed', (job, err) => {
    logger_1.default.error({ jobId: job === null || job === void 0 ? void 0 : job.id, error: err.message }, `Job failed.`);
});
worker.on('error', err => {
    logger_1.default.error({ error: err.message }, 'Worker error');
});
logger_1.default.info('Story Generation Worker started.');
// Graceful shutdown (optional but recommended)
process.on('SIGTERM', async () => {
    logger_1.default.info('SIGTERM signal received: closing worker...');
    await worker.close();
    logger_1.default.info('Worker closed.');
    process.exit(0);
});
