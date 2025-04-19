"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImage = uploadImage;
const cloudinary_1 = __importDefault(require("./cloudinary"));
const logger_1 = __importDefault(require("./logger"));
/**
 * Uploads an image file to Cloudinary.
 * @param file - The file to upload (e.g., base64 data URI or buffer).
 * @param options - Optional configuration for the upload (folder, public_id, etc.).
 * @returns A promise resolving to the Cloudinary upload response.
 */
async function uploadImage(file, options = {}) {
    try {
        const result = await cloudinary_1.default.uploader.upload(
        // Cloudinary type definition expects string for file path/URL/base64
        // but Buffer might be common in Node.js environments. Handle appropriately.
        // For simplicity, assuming `file` is a base64 string or URL for now.
        // If using Buffers, might need conversion or different upload method (e.g., upload_stream).
        file, {
            resource_type: 'image', // Explicitly set resource type
            ...options,
        });
        logger_1.default.info({ publicId: result.public_id, folder: options.folder }, 'Image uploaded successfully to Cloudinary');
        return result; // Cast to our defined interface
    }
    catch (error) {
        logger_1.default.error({ error, options }, 'Cloudinary image upload failed');
        // Re-throw or handle error appropriately based on application needs
        throw error;
    }
}
// Optional: Add functions for deleting, renaming, etc. as needed
// export async function deleteImage(publicId: string) { ... } 
