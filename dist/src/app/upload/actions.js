"use strict";
"use server";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleImageUpload = handleImageUpload;
const server_1 = require("@clerk/nextjs/server");
const logger_1 = __importDefault(require("@/lib/logger"));
const imageUpload_1 = require("@/lib/imageUpload");
const db_1 = require("@/lib/db");
// Basic validation types/limits (can be refined)
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
async function handleImageUpload(params) {
    var _a;
    const { userId } = await (0, server_1.auth)();
    const { fileName, fileType, fileSize, fileDataUrl, folder } = params;
    if (!userId) {
        logger_1.default.error({ fileName }, "Upload attempt without authentication.");
        return { success: false, message: "Authentication required." };
    }
    logger_1.default.info({ userId, fileName, fileType, fileSize, folder }, "Received upload request.");
    // --- Server-side Validation ---
    // 1. File Type
    if (!ACCEPTED_FILE_TYPES.includes(fileType)) {
        logger_1.default.warn({ userId, fileName, fileType }, "Upload rejected: Invalid file type.");
        return { success: false, message: `Invalid file type: ${fileType}. Accepted types: ${ACCEPTED_FILE_TYPES.join(', ')}` };
    }
    // 2. File Size (checking size passed from client - Cloudinary might re-check)
    if (fileSize > MAX_FILE_SIZE_BYTES) {
        logger_1.default.warn({ userId, fileName, fileSize }, "Upload rejected: File size exceeds limit.");
        return { success: false, message: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit.` };
    }
    // --- Cloudinary Upload & DB Record ---
    try {
        logger_1.default.info({ userId, fileName }, "Attempting Cloudinary upload...");
        const cloudinaryResult = await (0, imageUpload_1.uploadImage)(fileDataUrl, {
            folder: folder !== null && folder !== void 0 ? folder : `user_${userId}/uploads`,
        });
        logger_1.default.info({ userId, publicId: cloudinaryResult.public_id }, "Cloudinary upload successful.");
        // --- Generate Thumbnail URL ---
        // Example transformation: fill crop, 200px width, auto quality/format
        const transformation = "c_fill,w_200,q_auto,f_auto";
        // Insert transformation into the URL
        const thumbnailUrl = cloudinaryResult.secure_url.replace('/upload/', `/upload/${transformation}/`);
        logger_1.default.info({ userId, thumbnailUrl }, "Thumbnail URL generated.");
        // Create Asset record in Prisma DB using actual Cloudinary result
        const asset = await db_1.db.asset.create({
            data: {
                userId: userId,
                url: cloudinaryResult.secure_url,
                publicId: cloudinaryResult.public_id,
                fileType: fileType,
                size: cloudinaryResult.bytes,
                thumbnailUrl: thumbnailUrl, // Add the generated thumbnail URL
            },
            select: { id: true }
        });
        logger_1.default.info({ userId, assetId: asset.id, publicId: cloudinaryResult.public_id }, "Asset record created in database.");
        return {
            success: true,
            assetId: asset.id,
            cloudinaryUrl: cloudinaryResult.secure_url,
            publicId: cloudinaryResult.public_id,
            message: "File uploaded successfully."
        };
    }
    catch (error) {
        logger_1.default.error({ userId, fileName, error }, "Server error during upload process.");
        const message = (_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : "An error occurred during upload. Please try again.";
        return { success: false, message };
    }
}
