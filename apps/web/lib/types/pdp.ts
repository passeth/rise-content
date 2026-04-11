// Reference element types for image generation guidance
export type ReferenceElement =
  | "color"
  | "composition"
  | "pose"
  | "lighting"
  | "angle"
  | "concept"
  | "props";

// Scorecard item from AI analysis
export interface ScorecardItem {
  category: string;
  score: string;
  reason: string;
}

// Section blueprint — AI-generated copy + image direction for one section
export interface SectionBlueprint {
  section_id: string;
  section_name: string;
  goal: string;
  headline: string;
  headline_en: string;
  subheadline: string;
  subheadline_en: string;
  bullets: string[];
  bullets_en: string[];
  trust_or_objection_line: string;
  trust_or_objection_line_en: string;
  CTA: string;
  CTA_en: string;
  layout_notes: string;
  compliance_notes: string;
  image_id: string;
  purpose: string;
  prompt_ko: string;
  prompt_en: string;
  negative_prompt: string;
  style_guide: string;
  reference_usage: string;
  generatedImage?: string;
}

// Full landing page blueprint composed of AI-generated sections
export interface LandingPageBlueprint {
  executiveSummary: string;
  scorecard: ScorecardItem[];
  blueprintList: string[];
  sections: SectionBlueprint[];
}

// Result of an AI generation pass
export interface GeneratedResult {
  id: string;
  projectId: string;
  sectionId: string;
  slotId: string;
  type: "text" | "image";
  content: string;
  createdAt: string;
}

// Options for image generation
export interface ImageGenOptions {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  style?: string;
  seed?: number;
  referenceImageUrl?: string;
  referenceElements: ReferenceElement[];
}

// PDP analysis request/response
export interface PdpAnalyzeRequest {
  projectId: string;
  productName: string;
  productDescription: string;
  targetAudience?: string;
  brandId: string;
}

export interface PdpAnalyzeResponse {
  projectId: string;
  suggestedSections: SectionBlueprint[];
  keyMessages: string[];
  colorSuggestions: string[];
  analysisId: string;
}

// PDP image generation request/response
export interface PdpGenerateImageRequest {
  projectId: string;
  sectionId: string;
  slotId: string;
  options: ImageGenOptions;
}

export interface PdpGenerateImageResponse {
  imageId: string;
  imageUrl: string;
  prompt: string;
  width: number;
  height: number;
  createdAt: string;
}

// Error types
export type PdpErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "GENERATION_FAILED"
  | "QUOTA_EXCEEDED"
  | "INTERNAL_ERROR";

export interface PdpErrorResponse {
  code: PdpErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
