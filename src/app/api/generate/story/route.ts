import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { getQueue, QueueName } from '@/lib/queue'; // Import queue utilities
// Import types from the default client path
import { Asset, BookStatus, Prisma } from '@prisma/client';
// Import shared prisma instance
import { db as prisma } from '@/lib/db'; 

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
  droppedAssets: z.record(
    z.string(), // Allow any string key (numeric index OR 'title-page')
    z.string().nullable() // Value: assetId or null
  ),
  // Optional fields - ensure they are strings or undefined
  storyTone: z.string().optional(),
  artStyle: z.string().optional(),
  theme: z.string().optional().default(''), // Use default to avoid undefined
  people: z.string().optional().default(''),
  objects: z.string().optional().default(''),
  excitementElement: z.string().optional().default(''),
});

// Define the data structure required by the story generation worker job
export interface StoryGenerationJobData {
  userId: string;
  bookId: string;
  // Context needed for prompt generation
  promptContext: {
    childName: string;
    bookTitle: string;
    storyTone?: string;
    theme?: string;
    people?: string;
    objects?: string;
    excitementElement?: string;
    isDoubleSpread: boolean;
  };
  // Array of story pages needing text generation
  storyPages: {
    pageId: string;       // ID of the Page record to update
    pageNumber: number;   // Original page number (1-based for story)
    assetId: string | null; // ID of the original asset for this page
    originalImageUrl: string | null; // URL of the original asset image
  }[];
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

    // Step 2: Fetch Assets - Ensure we fetch the full Asset object or at least URL
    const assetIds = Object.values(requestData.droppedAssets)
      .filter((id): id is string => id !== null);
    
    let assets: Asset[] = []; // Use the full Asset type from @prisma/client
    if (assetIds.length > 0) {
      console.info({ userId, bookId: newBook.id, count: assetIds.length }, 'Fetching assets...');
      try {
        assets = await prisma.asset.findMany({
          where: { 
            id: { in: assetIds },
            userId: userId 
           },
           // Select necessary fields, ensure `url` is included
           select: { 
               id: true, 
               url: true, 
               // Add any other Asset fields required by StoryGenerationInput if any
               // Example: Assuming Asset type needs these based on error trace
               createdAt: true, 
               userId: true, // Already filtered by this, but selecting doesn't hurt
               thumbnailUrl: true,
               publicId: true,
               fileType: true,
               size: true
           }
        });
        console.info({ userId, bookId: newBook.id, count: assets.length }, 'Assets fetched successfully');
        // Optional: Validate if all requested asset IDs were found and belong to the user
        if (assets.length !== assetIds.length) {
            console.warn({ userId, bookId: newBook.id, requested: assetIds.length, found: assets.length }, 'Mismatch between requested and found assets.');
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

    // --- Step 3: Create Initial Page Records --- 
    const pagesToCreate: Prisma.PageCreateManyInput[] = [];

    // Determine Title Page info
    const titlePageAssetId = requestData.droppedAssets['title-page'] || null;
    const includeTitlePage = titlePageAssetId !== null;
    const titlePageAsset = titlePageAssetId ? assets.find(a => a.id === titlePageAssetId) : null;

    if (includeTitlePage) {
      pagesToCreate.push({
        bookId: newBook.id,
        pageNumber: 0, // Title page is page 0
        assetId: titlePageAssetId,
        originalImageUrl: titlePageAsset?.url || null, // Use fetched asset URL
        text: requestData.bookTitle, // Use book title as text
        textConfirmed: true, // Title text is confirmed
        isTitlePage: true,
        pageType: requestData.isDoubleSpread ? 'SPREAD' : 'SINGLE', // Set pageType
      });
    }

    // Prepare Story Page placeholders
    for (let i = 0; i < requestData.pageCount; i++) {
      const pageNumber = i + 1; // Story pages are 1-based
      const assetKey = String(i); // Key in droppedAssets is 0-based index as string
      const storyAssetId = requestData.droppedAssets[assetKey] || null;
      const storyAsset = storyAssetId ? assets.find(a => a.id === storyAssetId) : null;
      
      // Basic validation: ensure an asset was found if an ID was provided
      if (storyAssetId && !storyAsset) {
        console.warn({ userId, bookId: newBook.id, pageNumber, assetId: storyAssetId }, `Asset ID provided for page ${pageNumber}, but asset data not found. Skipping page asset link.`);
        // Decide if you want to throw an error or just proceed without the asset link
      }

      pagesToCreate.push({
        bookId: newBook.id,
        pageNumber: pageNumber,
        assetId: storyAsset?.id || null, // Use validated asset ID
        originalImageUrl: storyAsset?.url || null, // Use fetched asset URL
        text: null, // Text will be generated by worker
        textConfirmed: false,
        isTitlePage: false,
        pageType: requestData.isDoubleSpread ? 'SPREAD' : 'SINGLE',
      });
    }

    // Create pages in DB
    if (pagesToCreate.length > 0) {
       console.info({ userId, bookId: newBook.id, count: pagesToCreate.length }, 'Creating initial page records...');
       await prisma.page.createMany({
          data: pagesToCreate,
       });
       console.info({ userId, bookId: newBook.id }, 'Initial page records created.');
    } else {
        console.warn({ userId, bookId: newBook.id }, 'No pages were prepared for creation.');
        // Consider if this is an error state - should always have story pages?
    }

    // --- Step 4: Prepare Job Data (New Structure) --- 
    // Fetch the IDs and asset info for the STORY pages we just created
    const createdStoryPages = await prisma.page.findMany({
        where: {
            bookId: newBook.id,
            isTitlePage: false
        },
        orderBy: { pageNumber: 'asc' },
        select: { 
            id: true, 
            pageNumber: true, 
            assetId: true, 
            originalImageUrl: true 
        }
    });

    // Construct the job data payload
    const jobData: StoryGenerationJobData = {
        userId,
        bookId: newBook.id,
        promptContext: {
            childName: requestData.childName,
            bookTitle: requestData.bookTitle,
            storyTone: requestData.storyTone,
            theme: requestData.theme,
            people: requestData.people,
            objects: requestData.objects,
            excitementElement: requestData.excitementElement,
            isDoubleSpread: requestData.isDoubleSpread,
        },
        storyPages: createdStoryPages.map(p => ({ // Map the fetched story pages
            pageId: p.id,
            pageNumber: p.pageNumber,
            assetId: p.assetId,
            originalImageUrl: p.originalImageUrl,
        })),
    };

    // Step 5: Add job to queue
    const storyQueue = getQueue(QueueName.StoryGeneration);
    const job = await storyQueue.add('generate-story', jobData, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
    });

    console.info({ userId, bookId: newBook.id, jobId: job.id }, 'Added story generation job to queue');

    // Step 6: Return Job ID and Book ID
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
    // Ensure a response is returned even after cleanup attempt
    return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 });
  }
} 