import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import type { SectionBlueprint, ImageGenOptions, ReferenceElement } from "@/lib/types/pdp";

const ANALYZE_MODEL = "gemini-3.1-pro-preview";
const IMAGE_MODEL = "gemini-3-pro-image-preview";
const DEFAULT_IMAGE_MIME = "image/jpeg";
export const REFERENCE_MODEL_MAX_ATTEMPTS = 3;

export type ReferenceModelProfile = {
  genderPresentation: string;
  ageImpression: string;
  faceShape: string;
  hairstyle: string;
  skinTone: string;
  eyeDetails: string;
  browDetails: string;
  lipDetails: string;
  overallVibe: string;
  distinctiveFeatures: string[];
  keepTraits: string[];
  flexibleTraits: string[];
};

export type GeneratedImageValidation = {
  isSamePerson: boolean;
  genderPresentationPreserved: boolean;
  styleMatch: boolean;
  confidence: "high" | "medium" | "low";
  reason: string;
  correctionFocus: string[];
};

type GeneratedImagePayload = {
  base64: string;
  mimeType: string;
};

type NormalizedReferenceModelImage = {
  base64: string;
  mimeType: string;
};

type InternalImageGenOptions = ImageGenOptions & {
  guidePriorityMode: "guide-first" | "style-first";
  referenceModelImageBase64?: string;
  referenceModelImageMimeType?: string;
  referenceModelProfile?: ReferenceModelProfile | null;
  retryDirective?: string;
  withModel?: boolean;
  headline?: string;
  subheadline?: string;
  isRegeneration?: boolean;
  referenceImageDescription?: string;
};

// ────────────────────────────────────────────────
// Prompt builders (ported from reference service)
// ────────────────────────────────────────────────

export function buildReferenceModelProfilePrompt(profile: ReferenceModelProfile): string {
  const stableTraits = uniqueStrings(profile.keepTraits).join(", ");
  const flexibleTraits = uniqueStrings(profile.flexibleTraits).join(", ");
  const distinctiveFeatures = uniqueStrings(profile.distinctiveFeatures).join(", ");

  return [
    "Reference identity profile:",
    `gender presentation ${profile.genderPresentation};`,
    `age impression ${profile.ageImpression};`,
    `face shape ${profile.faceShape};`,
    `hairstyle ${profile.hairstyle};`,
    `skin tone ${profile.skinTone};`,
    `eye details ${profile.eyeDetails};`,
    `brow details ${profile.browDetails};`,
    `lip details ${profile.lipDetails};`,
    `overall vibe ${profile.overallVibe}.`,
    stableTraits ? `Keep fixed: ${stableTraits}.` : "",
    distinctiveFeatures ? `Identifying markers: ${distinctiveFeatures}.` : "",
    flexibleTraits ? `May vary: ${flexibleTraits}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildImageStyleInstructions(options?: InternalImageGenOptions): string {
  if (!options) return "";

  let instructions = "";

  if (options.style === "studio") {
    instructions +=
      "- Setting: Professional studio lighting, seamless paper or premium studio set, controlled backdrop, and no lived-in domestic context unless explicitly required.\n";
    instructions +=
      "- Composition: Avoid a default chest-up portrait. Prefer a mix of product-centric wide frames, half-body frames, seated or standing full-figure compositions, tabletop layouts, hand interactions, and close detail inserts depending on the section goal.\n";
    instructions +=
      "- Art Direction: Crisp controlled light, subtle shadows, refined color balance, and a clearly designed studio set that feels intentional rather than empty.\n";
    instructions +=
      "- Scene Guardrail: If any lifestyle or outdoor guidance conflicts, keep the result unmistakably studio-led.\n";
  } else if (options.style === "lifestyle") {
    instructions +=
      "- Setting: Authentic, aspirational lifestyle environment with natural lighting, lived-in textures, and everyday context that feels believable.\n";
    instructions +=
      "- Composition: Use candid moments, on-location interaction, room context, hands using the product, and gentle movement. Vary distance between environmental wide shots, medium shots, and close usage details.\n";
    instructions +=
      "- Art Direction: Warm, human, relatable, and editorial, with enough context to explain why the product fits into daily life.\n";
    instructions +=
      "- Scene Guardrail: Do not collapse the result into a blank studio set unless guide priority explicitly demands it.\n";
  } else if (options.style === "outdoor") {
    instructions +=
      "- Setting: Beautiful outdoor environment with cinematic natural lighting, location depth, airiness, and scene-based storytelling.\n";
    instructions +=
      "- Composition: Use wide scenic frames, dynamic movement, environmental close-ups, and product-in-use storytelling that feels active and open.\n";
    instructions +=
      "- Art Direction: Fresh, expansive, airy, and energetic, with the location helping explain the product mood or usage context.\n";
    instructions +=
      "- Scene Guardrail: Keep the result clearly outdoors, not a studio imitation or an indoor lifestyle room.\n";
  }

  if (options.withModel) {
    if (options.referenceModelImageBase64) {
      instructions +=
        "- Subject: MUST feature the exact same person shown in the attached reference model image.\n";
      instructions +=
        "- Identity Lock: Preserve the face, hairstyle, skin tone, gender presentation, and overall appearance of that same person while adapting pose, styling, and composition to the scene.\n";
      instructions +=
        "- Casting Rule: Never swap to another person. Never reinterpret the reference as a different male or female model.\n";
      if (options.referenceModelProfile) {
        instructions += `- Stable Traits: ${options.referenceModelProfile.keepTraits.join(", ")}.\n`;
        instructions += `- Flexible Traits: ${options.referenceModelProfile.flexibleTraits.join(", ")}.\n`;
      }
    } else {
      instructions +=
        "- Subject: MUST feature an attractive, professional model posing with and interacting naturally with the product.\n";
    }
  } else {
    instructions +=
      "- Subject: Do NOT include any people or models. Focus entirely on the product and background.\n";
  }

  return instructions;
}

export function buildGuidePriorityInstructions(
  section: SectionBlueprint,
  options?: InternalImageGenOptions
): string {
  const mode = options?.guidePriorityMode ?? "guide-first";
  const purpose = (section as unknown as Record<string, unknown>).purpose as string | undefined;
  const layoutNotes = (section as unknown as Record<string, unknown>).layout_notes as
    | string
    | undefined;
  const styleGuide = (section as unknown as Record<string, unknown>).style_guide as
    | string
    | undefined;

  if (mode === "guide-first") {
    return [
      "Design Guide Priority: ON.",
      purpose ? `Image Purpose: ${purpose}.` : "",
      layoutNotes ? `Layout Notes: ${layoutNotes}.` : "",
      styleGuide ? `Style Guide: ${styleGuide}.` : "",
      "If the selected shot type and guide conflict, respect the guide first and use the shot type as a supporting constraint.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    "Design Guide Priority: OFF.",
    purpose ? `Image Purpose: ${purpose}.` : "",
    "Ignore Layout Notes and Style Guide whenever they conflict with the selected shot type.",
    "Use the selected shot type as the main scene-defining instruction.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildValidationPrompt(
  profile: ReferenceModelProfile,
  expectedStyle: NonNullable<ImageGenOptions["style"]>
): string {
  return `
You will compare two images.
- image 1: the uploaded reference person image
- image 2: the newly generated candidate image

Judge whether image 2 preserves the same identifiable person from image 1 while allowing new pose, styling, framing, and environment.

Reference person profile:
- gender presentation: ${profile.genderPresentation}
- age impression: ${profile.ageImpression}
- face shape: ${profile.faceShape}
- hairstyle: ${profile.hairstyle}
- skin tone: ${profile.skinTone}
- eye details: ${profile.eyeDetails}
- brow details: ${profile.browDetails}
- lip details: ${profile.lipDetails}
- overall vibe: ${profile.overallVibe}
- keep traits: ${profile.keepTraits.join(", ")}
- distinctive features: ${profile.distinctiveFeatures.join(", ")}

Expected shot type: ${getStyleLabel(expectedStyle)}.

Return JSON only with:
- isSamePerson: boolean
- genderPresentationPreserved: boolean
- styleMatch: boolean
- confidence: high | medium | low
- reason: short explanation
- correctionFocus: array of short phrases explaining what must be corrected
`.trim();
}

export function buildRetryDirective(
  validation: GeneratedImageValidation,
  profile: ReferenceModelProfile,
  expectedStyle: NonNullable<ImageGenOptions["style"]>
): string {
  return [
    `The previous attempt did not pass identity/style validation: ${validation.reason}.`,
    `Keep the same person using these fixed traits: ${uniqueStrings(profile.keepTraits).join(", ")}.`,
    `Preserve these identifying markers: ${uniqueStrings(profile.distinctiveFeatures).join(", ")}.`,
    validation.correctionFocus.length
      ? `Correct these issues: ${validation.correctionFocus.join(", ")}.`
      : "",
    `The retried image must clearly read as a ${getStyleLabel(expectedStyle)} scene.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildReferenceElementPrompt(
  elements: ReferenceElement[],
  referenceImageDescription: string
): string {
  if (!elements.length) return "";

  const elementInstructions: Record<ReferenceElement, string> = {
    color: "Match the color palette and tonal range of the reference image",
    composition: "Follow the same compositional structure and framing",
    pose: "Replicate the pose and body positioning",
    lighting: "Match the lighting direction, quality, and mood",
    angle: "Use the same camera angle and perspective",
    concept: "Capture the same conceptual theme and narrative",
    props: "Include similar props, accessories, and set dressing",
  };

  const lines = elements.map((el) => `- ${elementInstructions[el]}`);

  return [
    `Reference Image Context: ${referenceImageDescription}`,
    "Apply the following from the reference image:",
    ...lines,
  ].join("\n");
}

export function buildImagePrompt(
  section: SectionBlueprint,
  options?: InternalImageGenOptions
): string {
  const sectionExt = section as unknown as Record<string, unknown>;
  const promptEn = sectionExt.prompt_en as string | undefined;
  const layoutNotes = sectionExt.layout_notes as string | undefined;
  const styleGuide = sectionExt.style_guide as string | undefined;
  const referenceUsage = sectionExt.reference_usage as string | undefined;

  const mode = options?.guidePriorityMode ?? "guide-first";

  const baseSceneDirection =
    mode === "guide-first"
      ? [promptEn, layoutNotes, styleGuide, referenceUsage].filter(Boolean).join(" ")
      : [
          `Communicate this purpose clearly: ${(sectionExt.purpose as string | undefined) ?? "product photography"}.`,
          "Build a fresh scene from the selected shot type.",
          "Do not inherit conflicting layout or style-guide assumptions from the section metadata.",
        ].join(" ");

  let enhancedPrompt =
    "Create a high-end, conversion-optimized commercial advertising photograph. ";

  if (options?.headline) {
    enhancedPrompt += `Context: The image should visually represent the advertising headline "${options.headline}"`;
    if (options.subheadline) {
      enhancedPrompt += ` and subheadline "${options.subheadline}"`;
    }
    enhancedPrompt += ". ";
  }

  if (options?.withModel && options.referenceModelImageBase64) {
    enhancedPrompt +=
      "Reference Inputs: image 1 is the original product reference and must preserve the exact product. image 2 is the mandatory model identity reference. ";
    enhancedPrompt +=
      "The final image MUST use the same person from image 2. Do not switch to a different model, do not change gender, and do not drift to a generic portrait face. ";
    if (options.referenceModelProfile) {
      enhancedPrompt += buildReferenceModelProfilePrompt(options.referenceModelProfile);
    }
  }

  if (options?.isRegeneration) {
    enhancedPrompt +=
      "\n[USER OVERRIDE INSTRUCTIONS - STRICTLY FOLLOW THESE OVER ANY CONFLICTING BASE INSTRUCTIONS]\n";
    enhancedPrompt += buildImageStyleInstructions(options);
    enhancedPrompt += "[END USER OVERRIDE INSTRUCTIONS]\n\n";
  } else {
    enhancedPrompt += "\nBase Instructions: ";
  }

  if (options?.withModel && options.referenceModelImageBase64) {
    enhancedPrompt += `Using image 1 as the exact product reference and image 2 as the exact person reference, create a new commercial scene based on this direction: ${baseSceneDirection}. `;
    enhancedPrompt +=
      "The person in the final image must be the same person from image 2, with the same face, gender presentation, hairstyle, skin tone, and overall identity. ";
    enhancedPrompt +=
      "Do not replace the person with a different model, do not masculinize or feminize them differently, and do not drift to a generic fashion face. Treat this as the same person in a new pose, new framing, and new environment. ";
  } else {
    enhancedPrompt += `Keep the product exactly as is. Build the scene from this direction: ${baseSceneDirection}. `;
  }

  enhancedPrompt += buildGuidePriorityInstructions(section, options);

  if (options?.retryDirective) {
    enhancedPrompt += ` Retry correction: ${options.retryDirective} `;
  }

  // Reference element instructions (new addition)
  if (options?.referenceElements?.length && options.referenceImageDescription) {
    enhancedPrompt +=
      "\n" +
      buildReferenceElementPrompt(options.referenceElements, options.referenceImageDescription) +
      "\n";
  }

  enhancedPrompt += "\nComposition Rules: ";
  enhancedPrompt +=
    "use a varied, intentional camera distance that matches the scene instead of defaulting to a chest-up portrait. ";
  enhancedPrompt +=
    "Depending on the section, use wide shots, medium shots, tabletop/product detail shots, hands-in-frame moments, over-the-shoulder angles, seated scenes, or environment-led framing when they improve product storytelling. ";
  enhancedPrompt +=
    "Keep the product readable, prominent, and beautifully lit, but allow the frame to breathe with negative space, props, and surrounding context when useful. ";
  enhancedPrompt +=
    "\nCRITICAL: The final image must look like a top-tier magazine advertisement or a premium brand's landing page hero shot. ";
  enhancedPrompt +=
    "It should be highly attractive and induce purchase conversion. IMPORTANT: Do NOT include any text, words, letters, typography, or logos in the generated image.";

  return enhancedPrompt;
}

// ────────────────────────────────────────────────
// Response parsers
// ────────────────────────────────────────────────

function parseReferenceModelProfileResponse(text: string): ReferenceModelProfile {
  const parsed = JSON.parse(extractResponseText(text)) as Partial<ReferenceModelProfile>;
  return {
    genderPresentation: asString(parsed.genderPresentation) || "same as reference image",
    ageImpression: asString(parsed.ageImpression) || "same age impression as reference image",
    faceShape: asString(parsed.faceShape) || "same face shape as reference image",
    hairstyle: asString(parsed.hairstyle) || "same hairstyle impression as reference image",
    skinTone: asString(parsed.skinTone) || "same skin tone as reference image",
    eyeDetails: asString(parsed.eyeDetails) || "same eye shape and gaze impression",
    browDetails: asString(parsed.browDetails) || "same brow shape and thickness",
    lipDetails: asString(parsed.lipDetails) || "same lip shape and expression impression",
    overallVibe: asString(parsed.overallVibe) || "same overall vibe as the reference person",
    distinctiveFeatures: asStringArray(parsed.distinctiveFeatures),
    keepTraits: asStringArray(parsed.keepTraits),
    flexibleTraits: asStringArray(parsed.flexibleTraits),
  };
}

function parseGeneratedImageValidationResponse(text: string): GeneratedImageValidation {
  const parsed = JSON.parse(extractResponseText(text)) as Partial<GeneratedImageValidation>;
  return {
    isSamePerson: Boolean(parsed.isSamePerson),
    genderPresentationPreserved: Boolean(parsed.genderPresentationPreserved),
    styleMatch: Boolean(parsed.styleMatch),
    confidence:
      parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low",
    reason: asString(parsed.reason) || "identity validation failed",
    correctionFocus: asStringArray(parsed.correctionFocus),
  };
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

function extractResponseText(text: string): string {
  let t = text.trim();
  if (t.startsWith("```json")) t = t.slice(7);
  else if (t.startsWith("```")) t = t.slice(3);
  if (t.endsWith("```")) t = t.slice(0, -3);
  const normalized = t.trim().replace(/^\uFEFF/, "");
  return extractJsonCandidate(normalized) ?? normalized;
}

function extractJsonCandidate(input: string): string | null {
  if (!input) return null;
  const objectStart = input.indexOf("{");
  const arrayStart = input.indexOf("[");
  const candidates = [objectStart, arrayStart].filter((v) => v >= 0);
  if (!candidates.length) return null;
  const startIndex = Math.min(...candidates);
  for (let endIndex = input.length; endIndex > startIndex; endIndex--) {
    const candidate = input.slice(startIndex, endIndex).trim();
    if (!candidate) continue;
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function buildHighResolutionInlinePart(mimeType: string, data: string) {
  return {
    inlineData: { mimeType, data },
    mediaResolution: { level: "media_resolution_high" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function extractGeneratedImage(response: {
  candidates?: Array<{
    content?: {
      parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }>;
    };
  }>;
}): GeneratedImagePayload | null {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data && part.inlineData.mimeType) {
      return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType };
    }
  }
  return null;
}

function sanitizeBase64Payload(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/^data:[^;]+;base64,(.+)$/);
  return (match ? match[1] : trimmed).replace(/\s/g, "");
}

function normalizeMimeType(mimeType: string): string {
  return mimeType.trim().toLowerCase();
}

function normalizeReferenceModelImage(
  base64?: string,
  mimeType?: string
): NormalizedReferenceModelImage | null {
  if (!base64?.trim()) return null;
  if (!mimeType?.trim()) return null;
  return { base64: sanitizeBase64Payload(base64), mimeType: normalizeMimeType(mimeType) };
}

function getStyleLabel(style: NonNullable<ImageGenOptions["style"]>): string {
  if (style === "lifestyle") return "lifestyle shot";
  if (style === "outdoor") return "outdoor shot";
  return "studio shot";
}

function uniqueStrings(arr: string[]): string[] {
  return [...new Set(arr)];
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  return "";
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asString).filter(Boolean);
  return [];
}

// ────────────────────────────────────────────────
// ImageService class
// ────────────────────────────────────────────────

export class ImageService {
  async generateImage(params: {
    section: SectionBlueprint;
    originalImageBase64: string;
    originalImageMimeType?: string;
    aspectRatio?: string;
    options?: Partial<InternalImageGenOptions>;
    geminiApiKey: string;
  }): Promise<{ base64: string; mimeType: string }> {
    const client = new GoogleGenAI({ apiKey: params.geminiApiKey, apiVersion: "v1alpha" });

    const originalBase64 = sanitizeBase64Payload(params.originalImageBase64);
    const normalizedRefModel = normalizeReferenceModelImage(
      params.options?.referenceModelImageBase64,
      params.options?.referenceModelImageMimeType
    );

    const withModel = params.options?.withModel ?? false;

    const referenceModelProfile =
      normalizedRefModel && withModel
        ? await this.extractReferenceModelProfile(client, normalizedRefModel.base64, normalizedRefModel.mimeType)
        : null;

    const options: InternalImageGenOptions = {
      prompt: params.options?.prompt ?? "",
      negativePrompt: params.options?.negativePrompt,
      width: params.options?.width ?? 1024,
      height: params.options?.height ?? 1024,
      style: params.options?.style ?? "studio",
      seed: params.options?.seed,
      referenceImageUrl: params.options?.referenceImageUrl,
      referenceElements: params.options?.referenceElements ?? [],
      guidePriorityMode: params.options?.guidePriorityMode ?? "guide-first",
      withModel,
      headline: params.options?.headline,
      subheadline: params.options?.subheadline,
      isRegeneration: params.options?.isRegeneration,
      referenceModelImageBase64: normalizedRefModel?.base64,
      referenceModelImageMimeType: normalizedRefModel?.mimeType,
      referenceModelProfile,
      retryDirective: params.options?.retryDirective,
      referenceImageDescription: params.options?.referenceImageDescription,
    };

    const maxAttempts = normalizedRefModel && withModel ? REFERENCE_MODEL_MAX_ATTEMPTS : 1;
    let lastGeneratedImage: GeneratedImagePayload | null = null;
    let retryDirective = options.retryDirective;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const prompt = buildImagePrompt(params.section, {
        ...options,
        isRegeneration: options.isRegeneration || attempt > 0,
        retryDirective,
      });

      const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [
        {
          inlineData: {
            mimeType: params.originalImageMimeType ?? DEFAULT_IMAGE_MIME,
            data: originalBase64,
          },
        },
      ];

      if (normalizedRefModel && withModel) {
        parts.push({
          inlineData: { mimeType: normalizedRefModel.mimeType, data: normalizedRefModel.base64 },
        });
      }

      parts.push({ text: prompt });

      const response = await client.models.generateContent({
        model: IMAGE_MODEL,
        contents: { parts },
        config: params.aspectRatio ? { imageConfig: { aspectRatio: params.aspectRatio } } : {},
      });

      const generatedImage = extractGeneratedImage(response);

      if (!generatedImage) {
        throw new Error("Image generation failed: Gemini did not return inline image data.");
      }

      lastGeneratedImage = generatedImage;

      if (!normalizedRefModel || !withModel || !referenceModelProfile) {
        return generatedImage;
      }

      const validation = await this.validateGeneratedImage(client, {
        generatedImage,
        referenceModelImage: normalizedRefModel,
        referenceModelProfile,
        expectedStyle: options.style ?? "studio",
      });

      if (
        validation.isSamePerson &&
        validation.genderPresentationPreserved &&
        validation.styleMatch
      ) {
        return generatedImage;
      }

      retryDirective = buildRetryDirective(
        validation,
        referenceModelProfile,
        options.style ?? "studio"
      );
    }

    if (!lastGeneratedImage) {
      throw new Error("Image generation failed: No image produced during retry loop.");
    }

    return lastGeneratedImage;
  }

  async extractReferenceModelProfile(
    client: GoogleGenAI,
    imageBase64: string,
    mimeType: string
  ): Promise<ReferenceModelProfile> {
    const response = await client.models.generateContent({
      model: ANALYZE_MODEL,
      contents: [
        {
          parts: [
            {
              text: "Analyze the uploaded reference person image and describe the same identifiable person for future commercial image generation. Focus on stable visual identity traits, not styling suggestions. Return JSON only.",
            },
            buildHighResolutionInlinePart(mimeType, imageBase64),
          ],
        },
      ] as never,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            genderPresentation: { type: Type.STRING },
            ageImpression: { type: Type.STRING },
            faceShape: { type: Type.STRING },
            hairstyle: { type: Type.STRING },
            skinTone: { type: Type.STRING },
            eyeDetails: { type: Type.STRING },
            browDetails: { type: Type.STRING },
            lipDetails: { type: Type.STRING },
            overallVibe: { type: Type.STRING },
            distinctiveFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
            keepTraits: { type: Type.ARRAY, items: { type: Type.STRING } },
            flexibleTraits: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    });

    const text = (response as unknown as { text?: string }).text ?? "";
    return parseReferenceModelProfileResponse(text);
  }

  private async validateGeneratedImage(
    client: GoogleGenAI,
    input: {
      generatedImage: GeneratedImagePayload;
      referenceModelImage: NormalizedReferenceModelImage;
      referenceModelProfile: ReferenceModelProfile;
      expectedStyle: NonNullable<ImageGenOptions["style"]>;
    }
  ): Promise<GeneratedImageValidation> {
    const response = await client.models.generateContent({
      model: ANALYZE_MODEL,
      contents: [
        {
          parts: [
            { text: buildValidationPrompt(input.referenceModelProfile, input.expectedStyle) },
            buildHighResolutionInlinePart(
              input.referenceModelImage.mimeType,
              input.referenceModelImage.base64
            ),
            buildHighResolutionInlinePart(
              input.generatedImage.mimeType,
              input.generatedImage.base64
            ),
          ],
        },
      ] as never,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSamePerson: { type: Type.BOOLEAN },
            genderPresentationPreserved: { type: Type.BOOLEAN },
            styleMatch: { type: Type.BOOLEAN },
            confidence: { type: Type.STRING },
            reason: { type: Type.STRING },
            correctionFocus: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    });

    const text = (response as unknown as { text?: string }).text ?? "";
    return parseGeneratedImageValidationResponse(text);
  }
}
