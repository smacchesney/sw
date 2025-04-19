"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const cloudinary_1 = require("cloudinary");
const client_1 = require("@/generated/prisma/client"); // Explicit import path
const server_2 = require("@clerk/nextjs/server"); // Correct import for server-side
const prisma = new client_1.PrismaClient();
// --- DEBUG: Log environment variables before configuration ---
console.log("--- Cloudinary Env Vars Check ---");
console.log("CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET'); // Log SET/NOT SET for secrets
console.log("CLOUDINARY_API_SECRET:", process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET');
console.log("-----------------------------------");
// --- End Debug Log ---
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});
// Helper function to upload a buffer to Cloudinary
async function uploadToCloudinary(buffer, options) {
    return new Promise((resolve, reject) => {
        cloudinary_1.v2.uploader.upload_stream(options, (error, result) => {
            if (error) {
                console.error("Cloudinary Upload Error:", error);
                return reject(error);
            }
            resolve(result);
        }).end(buffer);
    });
}
async function POST(request) {
    const authResult = await (0, server_2.auth)(); // Await the auth() call
    const userId = authResult === null || authResult === void 0 ? void 0 : authResult.userId; // Access userId safely
    console.log(">>> DEBUG: Authenticated userId for upload:", userId); // Keep debug log for now
    if (!userId) {
        return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const formData = await request.formData();
        const files = formData.getAll('files'); // Assuming files are sent under the 'files' key
        if (!files || files.length === 0) {
            return server_1.NextResponse.json({ error: 'No files provided' }, { status: 400 });
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
                    url: cloudinaryResult.secure_url, // Correct field name
                    thumbnailUrl: cloudinary_1.v2.url(cloudinaryResult.public_id, {
                        width: 200, height: 200, crop: 'fill', quality: 'auto', fetch_format: 'auto'
                    }),
                    fileType: file.type, // Correct field name
                    size: file.size,
                },
            });
            uploadedAssets.push({
                id: newAsset.id,
                thumbnailUrl: newAsset.thumbnailUrl,
            });
        }
        return server_1.NextResponse.json({ assets: uploadedAssets }, { status: 201 });
    }
    catch (error) {
        console.error('Upload API Error:', error);
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        return server_1.NextResponse.json({ error: 'File upload failed', details: message }, { status: 500 });
    }
    finally {
        await prisma.$disconnect(); // Disconnect Prisma client
    }
}
