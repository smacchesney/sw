import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaClient } from '@/generated/prisma/client'; // Explicit import path
import { auth } from '@clerk/nextjs/server'; // Correct import for server-side

const prisma = new PrismaClient();

// --- DEBUG: Log environment variables before configuration ---
console.log("--- Cloudinary Env Vars Check ---");
console.log("CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET'); // Log SET/NOT SET for secrets
console.log("CLOUDINARY_API_SECRET:", process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET');
console.log("-----------------------------------");
// --- End Debug Log ---

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

// Helper function to upload a buffer to Cloudinary
async function uploadToCloudinary(buffer: Buffer, options: object): Promise<any> {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) {
                console.error("Cloudinary Upload Error:", error);
                return reject(error);
            }
            resolve(result);
        }).end(buffer);
    });
}

export async function POST(request: Request) {
    const authResult = await auth(); // Await the auth() call
    const userId = authResult?.userId; // Access userId safely
    console.log(">>> DEBUG: Authenticated userId for upload:", userId); // Keep debug log for now

    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const files = formData.getAll('files') as File[]; // Assuming files are sent under the 'files' key

        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'No files provided' }, { status: 400 });
        }

        const uploadedAssets = [];

        for (const file of files) {
            // --- Validation (Add more as needed) ---
            if (file.size > 10 * 1024 * 1024) { // Example: 10MB limit
                 console.warn(`Skipping file ${file.name} due to size limit.`);
                 continue; // Skip this file or return error
            }
            if (!['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'].includes(file.type)) {
                 console.warn(`Skipping file ${file.name} due to invalid type ${file.type}.`);
                 continue; // Skip this file or return error
            }
            // --- End Validation ---

            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);

            // --- Upload to Cloudinary ---
            const cloudinaryResult = await uploadToCloudinary(buffer, {
                folder: `user_${userId}/uploads`, // Organize uploads by user
            });

            if (!cloudinaryResult || !cloudinaryResult.secure_url) {
                throw new Error(`Failed to upload ${file.name} to Cloudinary.`);
            }

            // --- Save Asset to Database (Using correct field names from schema.prisma) ---
            const newAsset = await prisma.asset.create({
                data: {
                    userId: userId,
                    publicId: cloudinaryResult.public_id, // Correct field name
                    url: cloudinaryResult.secure_url,       // Correct field name
                    thumbnailUrl: cloudinary.url(cloudinaryResult.public_id, {
                        width: 200, height: 200, crop: 'fill', quality: 'auto', fetch_format: 'auto'
                    }),
                    fileType: file.type,                   // Correct field name
                    size: file.size,
                },
            });

            uploadedAssets.push({
                 id: newAsset.id,
                 thumbnailUrl: newAsset.thumbnailUrl,
            });
        }

        return NextResponse.json({ assets: uploadedAssets }, { status: 201 });

    } catch (error) {
        console.error('Upload API Error:', error);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: 'File upload failed', details: message }, { status: 500 });
    } finally {
        await prisma.$disconnect(); // Disconnect Prisma client
    }
} 