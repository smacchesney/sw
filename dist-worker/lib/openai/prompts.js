"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemPrompt = void 0;
exports.createVisionStoryGenerationPrompt = createVisionStoryGenerationPrompt;
// System prompt defining the AI's role and core principles
const systemPrompt = `You are an expert children's picture book author with decades of experience, specializing in writing for toddlers (ages 2-5). Your task is to write engaging story text for a personalized picture book based on the user's photos and inputs.`;
exports.systemPrompt = systemPrompt;
// Function to create the user prompt message content array for Vision models
function createVisionStoryGenerationPrompt(input) {
    const messageContent = [];
    // --- Configuration Section (as Text) ---
    let configSection = `# Configuration\nChild\'s Name: ${input.childName || 'the child'}\nBook Title: ${input.bookTitle || 'My Special Story'}\nPage Count: ${input.pageCount}\nStory Tone: ${input.storyTone || 'Default (Engaging)'}`;
    messageContent.push({ type: "text", text: configSection });
    // --- Optional Details Section (as Text) ---
    let optionalDetails = "# Optional Details\n";
    let hasOptionalDetails = false;
    if (input.theme) {
        optionalDetails += `Theme: ${input.theme}\n`;
        hasOptionalDetails = true;
    }
    if (input.people) {
        optionalDetails += `Key People: ${input.people}\n`;
        hasOptionalDetails = true;
    }
    if (input.objects) {
        optionalDetails += `Key Objects: ${input.objects}\n`;
        hasOptionalDetails = true;
    }
    if (input.excitementElement) {
        optionalDetails += `Excitement Element: ${input.excitementElement}\n`;
        hasOptionalDetails = true;
    }
    if (!hasOptionalDetails) {
        optionalDetails += "(None provided)\n";
    }
    messageContent.push({ type: "text", text: optionalDetails });
    // --- Storyboard Sequence Section (Text and Images) ---
    messageContent.push({ type: "text", text: "# Storyboard Sequence" });
    // Determine the number of storyboard items (cells/spreads)
    const gridItemsCount = input.isDoubleSpread ? input.pageCount / 2 : input.pageCount;
    for (let i = 0; i < gridItemsCount; i++) {
        const assetId = input.droppedAssets[i];
        const asset = assetId ? input.assets.find(a => a.id === assetId) : null;
        const imageUrl = asset === null || asset === void 0 ? void 0 : asset.url; // Prioritize the main URL
        // Add text marker for the page/spread
        messageContent.push({ type: "text", text: `--- Page ${i + 1} ---` });
        if (imageUrl) {
            // Add the image URL object
            messageContent.push({ type: "image_url", image_url: { url: imageUrl, detail: "high" } }); // Use high detail if needed
        }
        else {
            // Add text placeholder if no image
            messageContent.push({ type: "text", text: `[No Image Provided for Page ${i + 1}]` });
        }
    }
    messageContent.push({ type: "text", text: `--- End Storyboard ---` });
    // --- Instructions Section (as Text) ---
    const instructions = `# Instructions & Guiding Principles:\n- Craft a **cohesive story** following the image sequence precisely, with a clear beginning, middle, and end.\n- Write from a **toddler\'s perspective**, focusing on familiar experiences and relatable emotions (joy, frustration, silliness, pride).\n- Keep sentences **short, simple, and concrete**. Use strong verbs and vivid nouns. (Principle: Simple but Not Boring / Less is More)\n- Use **rhythm, repetition, and fun sounds** (onomatopoeia) where natural to create read-aloud appeal. (Principle: Musical / Interactive)\n- Incorporate **gentle, age-appropriate humor** (mild mischief, surprises) if fitting. (Principle: Funny is Gold)\n- **Naturally weave in** the user\'s provided details: Child\'s Name, Title, Tone, Theme, People, Objects, and Excitement element. Match the requested Story Tone.\n- Generate **1-3 simple sentences per page number** (referring to the sequence above, e.g., Page 1, Page 2...). Adjust sentence count slightly per page to ensure a good narrative flow across the total page count.\n- Output ONLY a valid JSON object mapping page numbers (as strings, e.g., "1", "2", ...) to the story text string for that page. Example: {"1": "Leo and Mommy went to the park.", "2": "Leo saw a bright red ball!"}`; // Add page count range to example
    messageContent.push({ type: "text", text: instructions });
    return messageContent;
}
// Helper function to potentially map style/tone IDs to descriptive labels if needed
// function getLabelFromId(id: string | undefined, options: {id: string, label: string}[]): string | undefined {
//   if (!id) return undefined;
//   return options.find(opt => opt.id === id)?.label;
// } 
