/* styleLibrary.ts
 *  └── import { STYLE_LIBRARY, createIllustrationPrompt } from "./styleLibrary";
 */

// Using CommonJS syntax as this file is within src/lib

const STYLE_LIBRARY = {
  cartoonBrights: {
    label: "Cartoon Brights",
    descriptor: [
      "bold flat shading",
      "thick 6-px clean black outlines",
      "smooth digital vector look",
      "sample all colours and overall layout directly from the reference photo"
    ].join(", ")
  },

  softWatercolor: {
    label: "Soft Watercolor",
    descriptor: [
      "loose watercolor wash on cold-press paper",
      "no hard outlines, soft edge bleeding",
      "subtle paper texture",
      "reuse the hues and composition of the reference photo"
    ].join(", ")
  },

  crayonScribble: {
    label: "Crayon Scribble",
    descriptor: [
      "wax-crayon strokes with visible grain",
      "wobbly hand-drawn outlines",
      "uneven fill, child-like energy",
      "colours should be sampled from the reference photo"
    ].join(", ")
  },

  digitalGouache: {
    label: "Digital Gouache",
    descriptor: [
      "opaque gouache strokes with dry-brush texture",
      "chunky shapes, flat perspective",
      "soft paper tooth",
      "colour choices and arrangement mirror the reference photo"
    ].join(", ")
  },

  paperCutCollage: {
    label: "Paper-Cut Collage",
    descriptor: [
      "layered coloured-paper shapes with subtle drop shadows",
      "crisp torn or scissor edges",
      "light grain, slight 3-D feel",
      "replicate the colour palette and subject placement from the reference photo"
    ].join(", ")
  },

  pixelQuest: {
    label: "Pixel Quest",
    descriptor: [
      "retro 16-bit pixel art",
      "1-pixel black outlines, visible dithering",
      "blocky 64×64 base grid then upscaled",
      "derive sprite colours and scene layout from the reference photo"
    ].join(", ")
  },

  kawaiiMinimal: {
    label: "Kawaii Minimal",
    descriptor: [
      "super-deformed cute style, big round eyes",
      "2-px pastel outlines",
      "minimal details, soft gradients",
      "take colours and object positions from the reference photo"
    ].join(", ")
  },

  chalkboard: {
    label: "Chalkboard",
    descriptor: [
      "white chalk strokes on dusty dark-green chalkboard",
      "slightly smeared edges, hand lettering feel",
      "chalk dust particles",
      "copy shapes and proportions seen in the reference photo"
    ].join(", ")
  }
} as const;

type StyleKey = keyof typeof STYLE_LIBRARY;

interface PromptOptions {
  style: StyleKey;
  theme: string | null;
  tone: string | null;
  pageText: string | null;
  bookTitle: string | null;
  isTitlePage?: boolean;
}

/** Builds the final prompt string (≤ 950 chars) */
function createIllustrationPrompt(options: PromptOptions): string {
  // Explicitly extract values and handle default for isTitlePage
  const { style, theme, tone, pageText, bookTitle } = options;
  const isTitlePage = !!options.isTitlePage;      // Coerce any truthy value to boolean

  const styleKey = style && STYLE_LIBRARY[style] ? style : 'cartoonBrights';
  const styleBlock = STYLE_LIBRARY[styleKey].descriptor;

  // **** DEBUG: Check isTitlePage value INSIDE the function ****
  console.log(`[createIllustrationPrompt] Received isTitlePage: ${isTitlePage} (Type: ${typeof isTitlePage})`);
  // ***********************************************************

  let parts: (string | null | undefined)[];

  if (isTitlePage) {
    parts = [
      "You are illustrating the TITLE PAGE for a toddler board book.",
      `Apply this exact visual language: ${styleBlock}.`,
      "Keep all colours, character poses and background layout from the provided reference photo.",
      "Set white balance to 6000 K.",
      bookTitle ? `The book title is \"${bookTitle}\". Integrate this title text (exactly) seamlessly and artistically into the illustration itself, like a real book cover.` : null,
      bookTitle ? `Ensure the title text placement is aesthetically pleasing, very legible and does not obscure any important characters or details in the main illustration.` : null,
      theme ? `Overall theme: ${theme}.` : null,
      tone ? `Mood: ${tone}.` : null,
      "Create a captivating image suitable for a cover/title page.",
      "Return a single square 1024×1024 JPG."
    ];
  } else {
    parts = [
        // ■ 0  Format & context
  "You are illustrating a toddler board book.",
  "Return ONE square 1024×1024 JPG, nothing else.",

  // ■ 1  Style block
  `Apply EXACTLY this visual language: ${styleBlock}.`,
  "Keep outlines ~6 px.",                                // consistency anchor


  // ■ 2  Reference-photo fidelity
  "Copy every face, pose, and object layout from the reference photo.",
  "Do NOT crop or reposition main subjects.",

  // ■ 3  Embedded text cloud
  "Add a single SOFT-EDGED cloud (white, 70 % opacity).",
  "Let the model decide the cloud's shape and position,",
  "but it MUST NOT cover faces or important scene elements.",
  `Inside that cloud, print this sentence **exactly once**, clear and readable:\n“${pageText?.trim() ?? ""}”`,
  "Use exactly font Comic Neue Bold, navy colour (#1A2A6B), size ≈80 pt",

  // ■ 4  Negative constraints
  "No other text, watermarks, or duplicate words.",
  "Do not invent new characters or props.",

  // ■ 5  Finish
  "Return only the image."
    ];
  }

  const prompt = parts.filter(Boolean).join("\n");
  return prompt.length > 950 ? prompt.slice(0, 947) + "…" : prompt;
}

// Export using CommonJS syntax
module.exports = {
    STYLE_LIBRARY,
    createIllustrationPrompt,
    // Export type if needed elsewhere
    // PromptOptions
}; 