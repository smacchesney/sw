import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { getQueue, QueueName } from '@/lib/queue'; // Import queue utilities
// Import types from the new generated client location (Task 7.8)
import { PrismaClient, Prisma, Asset, BookStatus } from '@/generated/prisma/client';

// Initialize Prisma Client
// Note: PrismaClient is imported from the new location now
const prisma = new PrismaClient();

// REMOVED local BookStatus enum workaround (Task 7.8)

// REMOVED type Asset = any; workaround (Task 7.8)

// Define the expected input schema using Zod
const storyRequestSchema = z.object({
  childName: z.string().min(1, { message: "Child's name is required" }),
  bookTitle: z.string().min(1, { message: "Book title is required" }),
  pageCount: z.union([
    z.literal(8),
    z.literal(12),
    z.literal(16),
  ]),
  isDoubleSpread: z.boolean(),
  droppedAssets: z.record(z.string().regex(/^\d+$/).transform(Number), z.string().nullable()), // Key: grid index (string -> number), Value: assetId or null
  // Optional fields - ensure they are strings or undefined
  storyTone: z.string().optional(),
  artStyle: z.string().optional(),
  theme: z.string().optional().default(''), // Use default to avoid undefined
  people: z.string().optional().default(''),
  objects: z.string().optional().default(''),
  excitementElement: z.string().optional().default(''),
});

// Job data type now includes bookId
export interface StoryGenerationJobData {
  userId: string;
  bookId: string; // Added bookId
  bookData: Omit<z.infer<typeof storyRequestSchema>, 'assets'> & { assets: any[] }; 
}

export async function POST(request: Request) {
  // Fix: Await the auth() call
  const authResult = await auth(); 
  const userId = authResult?.userId; // Access userId from the result

  if (!userId) {
    console.warn('Unauthorized story generation attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let requestData;
  try {
    const rawData = await request.json();
    requestData = storyRequestSchema.parse(rawData);
    console.info({ userId, title: requestData.bookTitle }, 'Received story generation request');
  } catch (error) {
    console.error({ userId, error }, 'Invalid story generation request data');
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to parse request data' }, { status: 400 });
  }

  let newBook: { id: string } | null = null; // Initialize newBook to null
  try {
    // Step 1: Create the Book record in the database
    console.info({ userId, title: requestData.bookTitle }, 'Creating book record...');
    newBook = await prisma.book.create({
      data: {
        userId: userId,
        title: requestData.bookTitle,
        childName: requestData.childName,
        pageLength: requestData.pageCount,
        // isDoubleSpread: requestData.isDoubleSpread, // Schema doesn't have this, maybe store on Page?
        artStyle: requestData.artStyle,
        tone: requestData.storyTone,
        theme: requestData.theme,
        keyCharacters: requestData.people, // Map request field to schema field
        specialObjects: requestData.objects, // Map request field to schema field
        excitementElement: requestData.excitementElement,
        status: BookStatus.GENERATING, // Use imported enum
        // TODO: Add other relevant fields like typography if added later
      },
      select: {
        id: true // Select only the ID we need
      }
    });
    // Null check after creation attempt
    if (!newBook?.id) {
        console.error({ userId, title: requestData.bookTitle }, 'Failed to create book record or retrieve ID.');
        throw new Error('Book creation failed.'); // Throw error to trigger catch block
    }
    console.info({ userId, bookId: newBook.id }, 'Book record created successfully');

    // Step 2: Fetch Assets (Task 7.8 Implementation)
    const assetIds = Object.values(requestData.droppedAssets)
      .filter((id): id is string => id !== null);
    
    let assets: Asset[] = []; // Use imported Asset type
    if (assetIds.length > 0) {
      console.info({ userId, bookId: newBook.id, count: assetIds.length }, 'Fetching assets...');
      try {
        // Use prisma.asset here - relies on the 'Asset' type being defined, even if 'any'
        assets = await prisma.asset.findMany({
          where: { 
            id: { in: assetIds },
            userId: userId // Ensure user owns the assets
           },
          // Optionally include related data like tags if needed later by the prompt
          // include: { tags: true }
        });
        console.info({ userId, bookId: newBook.id, count: assets.length }, 'Assets fetched successfully');
        // Optional: Validate if all requested asset IDs were found and belong to the user
        if (assets.length !== assetIds.length) {
            console.warn({ userId, bookId: newBook.id, requested: assetIds.length, found: assets.length }, 'Mismatch between requested and found assets. Some assets might be missing or belong to another user.');
            // Decide if this is a critical error. For now, proceed with found assets.
        }
      } catch (error) {
        console.error({ userId, bookId: newBook.id, assetIds }, "Error fetching assets:", error);
        // Clean up the created book record if asset fetching fails
        console.warn({ userId, bookId: newBook.id }, 'Attempting to revert book creation due to asset fetching error...');
        // newBook.id is guaranteed non-null here due to the check above
        await prisma.book.delete({ where: { id: newBook.id } }); 
        console.info({ userId, bookId: newBook.id }, 'Reverted book creation.');
        return NextResponse.json({ error: "Failed to fetch assets for story generation" }, { status: 500 });
      }
    }

    // Step 3: Prepare job data including the new bookId and fetched assets
    // newBook.id is guaranteed non-null here
    const jobData: StoryGenerationJobData = {
      userId,
      bookId: newBook.id, // Include the created book's ID
      bookData: {
        ...requestData,
        assets: assets, // Use fetched assets (with imported type)
      }
    };

    // Step 4: Add job to queue
    const storyQueue = getQueue(QueueName.StoryGeneration);
    const job = await storyQueue.add('generate-story', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    console.info({ userId, bookId: newBook.id, jobId: job.id }, 'Added story generation job to queue');

    // Step 5: Return Job ID (and optionally Book ID)
    // newBook.id is guaranteed non-null here
    return NextResponse.json({ jobId: job.id, bookId: newBook.id }, { status: 202 }); 

  } catch (error: any) {
    console.error({ userId, error: error.message }, 'Error during book creation or job queuing');
    // Optional: Try to clean up - delete the created book if queuing failed?
    // Ensure newBook is not null before attempting deletion
    if (newBook?.id) { // Check if newBook was successfully created before attempting delete
       console.warn({ userId, bookId: newBook.id }, 'Attempting to revert book creation due to queuing error...');
       try {
         await prisma.book.delete({ where: { id: newBook.id }});
         console.info({ userId, bookId: newBook.id }, 'Reverted book creation.');
       } catch (deleteError: any) {
         console.error({ userId, bookId: newBook.id, error: deleteError.message }, 'Failed to revert book creation.');
       }
    }
    return NextResponse.json({ error: 'Failed to process story generation request' }, { status: 500 });
  }
} 