"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const openai_1 = __importDefault(require("openai"));
// Ensure the API key is provided via environment variables
if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
}
// Initialize the OpenAI client
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
    // You can add other default configurations here if needed
});
exports.default = openai;
// Optional: Define reusable functions for specific API calls below
// e.g., function generateStoryText(...) { ... } 
