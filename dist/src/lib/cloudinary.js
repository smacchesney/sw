"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSignedImageUrl = getSignedImageUrl;
const cloudinary_1 = require("cloudinary");
const logger_1 = __importDefault(require("./logger")); // Import the logger we created
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
if (!cloudName || !apiKey || !apiSecret) {
    const missingVars = [
        !cloudName && 'CLOUDINARY_CLOUD_NAME',
        !apiKey && 'CLOUDINARY_API_KEY',
        !apiSecret && 'CLOUDINARY_API_SECRET',
    ].filter(Boolean).join(', ');
    logger_1.default.error(`Missing Cloudinary environment variables: ${missingVars}`);
    // In a real application, you might want to throw an error here
    // or handle it gracefully depending on whether Cloudinary is critical at startup.
    // For now, we just log the error.
    // throw new Error(`Missing Cloudinary environment variables: ${missingVars}`);
}
else {
    cloudinary_1.v2.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true, // Use https
    });
    logger_1.default.info('Cloudinary configured successfully.');
}
exports.default = cloudinary_1.v2;
/**
 * Generates a signed Cloudinary URL for accessing a private resource.
 * Note: Requires 'Signed media delivery' to be enabled in Cloudinary settings.
 * @param publicId - The public ID of the asset.
 * @param options - Optional configuration for transformations in the signed URL.
 * @returns A signed URL string with a default expiration (e.g., 1 hour).
 */
function getSignedImageUrl(publicId, options = {}) {
    // The `sign_url: true` option automatically handles signing
    // Default expiration is 1 hour, can be customized via `expires_at`
    try {
        const signedUrl = cloudinary_1.v2.url(publicId, Object.assign(Object.assign({}, options), { sign_url: true, secure: true, resource_type: 'image' }));
        logger_1.default.debug({ publicId }, 'Generated signed Cloudinary URL');
        return signedUrl;
    }
    catch (error) {
        logger_1.default.error({ error, publicId }, 'Failed to generate signed Cloudinary URL');
        // Depending on requirements, return a placeholder URL or re-throw
        // For now, re-throwing to indicate failure clearly
        throw error;
    }
}
// If direct import is desired: export { cloudinary, getSignedImageUrl }; 
