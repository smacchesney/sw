// Using CommonJS syntax as this file is within src/lib

// Define the structure for the input data
interface GeminiIllustrationPromptInput {
  artStyle: string | null;
  storyTone: string | null;
  pageText: string | null; // The text to attempt embedding
  childName: string | null;
  theme: string | null;
  keyCharacters: string | null;
  specialObjects: string | null;
  originalImageMimeType: string; // Mime type of the original image
  originalImageBase64: string;   // Base64 encoded original image data
}

// Define the structure for the output (contents array for Gemini API)
interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

type GeminiContents = GeminiPart[];

/**
 * Creates the prompt and image data structure for Gemini multi-modal generation.
 * Attempts to instruct the model to re-illustrate based on an original image
 * and embed specific text onto the generated image.
 */
function createGeminiIllustrationPrompt(
  input: GeminiIllustrationPromptInput
): GeminiContents {
  const { 
      artStyle, 
      storyTone, 
      pageText, 
      childName, 
      theme, 
      keyCharacters, 
      specialObjects, 
      originalImageMimeType, 
      originalImageBase64 
  } = input;

  // --- Start with the core request --- 
  let promptText = `Generate a children's picture book illustration based on the provided image, adapting its subject/composition to the following style and context.`;

  // --- Add context --- 
  promptText += `\n# Style & Context`;
  promptText += `\nArt Style: ${artStyle || 'charming cartoon'}`;
  if (storyTone) promptText += `\nTone: ${storyTone}`;
  if (theme) promptText += `\nTheme: ${theme}`;
  if (childName) promptText += `\nChild Character: ${childName}`;
  if (keyCharacters && keyCharacters.trim().length > 0) promptText += `\nKey Characters: ${keyCharacters}`; 
  if (specialObjects && specialObjects.trim().length > 0) promptText += `\nKey Objects: ${specialObjects}`;
  
  // --- Text Embedding Instruction --- 
  promptText += `\n# Text to Render`;
  if (pageText && pageText.trim().length > 0) {
      // Be very specific about rendering the exact text
      promptText += `\nIMPORTANT: Render the following text *exactly* as written, clearly and legibly onto the image, suitable for a children's book (e.g., integrated naturally or at the bottom): "${pageText.trim()}"`;
  } else {
      promptText += `\n(No text should be rendered on the image.)`;
  }
  
  // --- Explicit Output Instruction --- 
  promptText += `\n\nPlease provide the generated illustration based on these instructions and the input image.`;

  // Construct the contents array
  const contents: GeminiContents = [
    { text: promptText },
    { inlineData: { mimeType: originalImageMimeType, data: originalImageBase64 } }
  ];

  return contents;
}

// Export using CommonJS syntax
module.exports = { 
    createGeminiIllustrationPrompt, 
    // Export types if needed elsewhere, though unlikely for CJS module
    // GeminiIllustrationPromptInput, 
    // GeminiContents 
}; 