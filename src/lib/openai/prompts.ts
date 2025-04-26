import { Asset } from '@/generated/prisma/client'; // Assuming Prisma Asset type

// Define MessageContentPart type based on OpenAI API
type MessageContentPart = 
  | { type: "text", text: string }
  | { type: "image_url", image_url: { url: string; detail?: "low" | "high" | "auto" } };

// Input data structure for the prompt generator
export interface StoryGenerationInput {
  childName: string;
  bookTitle: string;
  pageCount: 8 | 12 | 16; // Re-added
  isDoubleSpread: boolean; // May affect page numbering/layout perception?
  storyTone?: string; // ID or label from selection
  artStyle?: string; // ID or label from selection
  theme?: string;
  people?: string;
  objects?: string;
  excitementElement?: string;
  // Map of grid index to asset ID (e.g., {0: 'asset1', 1: null, 2: 'asset5', ...})
  droppedAssets: Record<number, string | null>; // Re-added
  // Full list of available assets to look up URLs
  assets: Asset[]; // Re-added
}

// System prompt defining the AI's role and core principles
const systemPrompt = `You are an expert children's picture book author with decades of experience, specializing in writing for toddlers (ages 2-5). Your task is to write engaging story text for a personalized picture book based on the user's photos and inputs.`;

// Function to create the user prompt message content array for Vision models
export function createVisionStoryGenerationPrompt(input: StoryGenerationInput): MessageContentPart[] {

  const messageContent: MessageContentPart[] = [];

  // --- Configuration Section (as Text) ---
  let configSection = `# Configuration\nChild\'s Name: ${input.childName || 'the child'}\nBook Title: ${input.bookTitle || 'My Special Story'}\nPage Count: ${input.pageCount}\nStory Tone: ${input.storyTone || 'Default (Engaging)'}`;
  messageContent.push({ type: "text", text: configSection });

  // --- Optional Details Section (as Text) ---
  let optionalDetails = "# Optional Details\n";
  let hasOptionalDetails = false;
  if (input.theme) { optionalDetails += `Theme: ${input.theme}\n`; hasOptionalDetails = true; }
  if (input.people) { optionalDetails += `Key People: ${input.people}\n`; hasOptionalDetails = true; }
  if (input.objects) { optionalDetails += `Key Objects: ${input.objects}\n`; hasOptionalDetails = true; }
  if (input.excitementElement) { optionalDetails += `Excitement Element: ${input.excitementElement}\n`; hasOptionalDetails = true; }
  if (!hasOptionalDetails) {
    optionalDetails += "(None provided)\n";
  }
  messageContent.push({ type: "text", text: optionalDetails });

  // --- Storyboard Sequence Section (Text and Images) ---
  messageContent.push({ type: "text", text: "# Storyboard Sequence" });
  // Reverted: Loop through all assets based on pageCount/droppedAssets
  const gridItemsCount = input.isDoubleSpread ? input.pageCount / 2 : input.pageCount;
  for (let i = 0; i < gridItemsCount; i++) {
    const assetId = input.droppedAssets[i];
    const asset = assetId ? input.assets.find(a => a.id === assetId) : null;
    const imageUrl = asset?.url; // Prioritize the main URL

    // Add text marker for the page/spread
    messageContent.push({ type: "text", text: `--- Page ${i + 1} ---` });

    if (imageUrl) {
      // Add the image URL object
      messageContent.push({ type: "image_url", image_url: { url: imageUrl, detail: "high" } }); // Use high detail if needed
    } else {
      // Add text placeholder if no image
      messageContent.push({ type: "text", text: `[No Image Provided for Page ${i + 1}]` });
    }
  }
  messageContent.push({ type: "text", text: `--- End Storyboard ---` });

  // --- Instructions Section (as Text) ---
  const instructions = `# Instructions & Guiding Principles:\n- Craft a **cohesive story** following the image sequence precisely, with a clear beginning, middle, and end.\n- Write from a **toddler\'s perspective**, focusing on familiar experiences and relatable emotions (joy, frustration, silliness, pride).\n- Keep sentences **short, simple, and concrete**. Use strong verbs and vivid nouns. (Principle: Simple but Not Boring / Less is More)\n- Use **rhythm, repetition, and fun sounds** (onomatopoeia) where natural to create read-aloud appeal. (Principle: Musical / Interactive)\n- Incorporate **gentle, age-appropriate humor** (mild mischief, surprises) if fitting. (Principle: Funny is Gold)\n- **Naturally weave in** the user\'s provided details: Child\'s Name, Title, Tone, Theme, People, Objects, and Excitement element. Match the requested Story Tone.\n- Generate **1-3 simple sentences per page number** (referring to the sequence above, e.g., Page 1, Page 2...). Adjust sentence count slightly per page to ensure a good narrative flow across the total page count.\n- Output ONLY a valid JSON object mapping page numbers (as strings, e.g., "1", "2", ...) to the story text string for that page. Example: {"1": "Leo and Mommy went to the park.", "2": "Leo saw a bright red ball!"}`; 
  messageContent.push({ type: "text", text: instructions });

  return messageContent;
}

// Keep the original function in case it's needed elsewhere, or remove if unused.
// export function createStoryGenerationPrompt(input: StoryGenerationInput): string { ... } 

// Export the system prompt so it can be used by the worker
export { systemPrompt };

// Helper function to potentially map style/tone IDs to descriptive labels if needed
// function getLabelFromId(id: string | undefined, options: {id: string, label: string}[]): string | undefined {
//   if (!id) return undefined;
//   return options.find(opt => opt.id === id)?.label;
// } 

// --- DALL-E Prompt Generation ---

// Interface for DALL-E prompt inputs
export interface DallePromptInput {
  artStyle: string | null | undefined;
  storyTone: string | null | undefined;
  pageText: string | null | undefined;
  childName?: string | null | undefined;
  theme?: string | null | undefined;
  keyCharacters?: string | null | undefined;
  specialObjects?: string | null | undefined;
  // Add any other relevant book/page data here
}

// Function to generate a DALL-E 3 prompt for a single page
export function createDalleIllustrationPrompt(input: DallePromptInput): string {
  // Base prompt structure
  let prompt = `Children's picture book illustration in a ${input.artStyle || 'charming cartoon'} style. `; 

  // Add tone if specified
  if (input.storyTone) {
    prompt += `The tone should be ${input.storyTone}. `;
  }

  // Describe the scene based on page text
  if (input.pageText) {
    prompt += `The scene shows: ${input.pageText}. `;
  } else {
    // Fallback if somehow text is missing
    prompt += "A delightful scene from a children's story. ";
  }

  // Incorporate other details subtly
  if (input.childName) {
    prompt += `Include ${input.childName} if relevant to the text. `;
  }
  if (input.keyCharacters && input.keyCharacters !== input.childName) {
    prompt += `Also feature ${input.keyCharacters} if mentioned. `;
  }
  if (input.specialObjects) {
    prompt += `Key objects like ${input.specialObjects} might appear. `;
  }
  if (input.theme) {
    prompt += `The overall theme is ${input.theme}. `;
  }

  // DALL-E 3 specific guidance (optional but can help)
  prompt += "Ensure the style is consistent, age-appropriate for toddlers (2-5 years), and visually clear."

  // Limit prompt length (DALL-E has limits, though they are generous)
  // This is a basic trim, more sophisticated truncation might be needed
  const maxLength = 950; // Keep it under 1000 chars as a safety measure
  if (prompt.length > maxLength) {
    prompt = prompt.substring(0, maxLength - 3) + '...';
  }

  return prompt;
}

// --- End DALL-E Prompt Generation --- 