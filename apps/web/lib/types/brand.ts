import type { TextRole } from "./editor";

export type ComponentCategory =
  | "hero"
  | "benefit"
  | "ingredient"
  | "review"
  | "cta"
  | "usage"
  | "routine";

export type LayoutType = "1-col" | "2-col" | "3-col";

export interface BrandColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  colorPalette: BrandColorPalette;
  protectedTerms: string[];
  createdAt: string;
}

export interface TextSlotStyle {
  backgroundColor?: string;
  textColor?: string;
  padding?: string;
  borderRadius?: string;
  border?: string;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: string;
  lineHeight?: number;
}

export interface TextSlotTemplate {
  id: string;
  role: TextRole;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: number;
  maxLength?: number;
  sampleText?: string;
  style?: TextSlotStyle;
}

export interface ImageSlotTemplate {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  purpose: string;
}

export interface BrandComponent {
  id: string;
  brandId: string;
  name: string;
  category: ComponentCategory;
  layoutType: LayoutType;
  figmaFileKey?: string;
  figmaNodeId?: string;
  version: number;
  thumbnailUrl?: string;
  templateData: Record<string, unknown>;
  textSlots: TextSlotTemplate[];
  imageSlots: ImageSlotTemplate[];
  createdAt: string;
  updatedAt: string;
}
