export type TextRole = "headline" | "subheadline" | "body" | "caption" | "cta";

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

export type LayoutMode = "auto" | "free";

export interface TextSlotInstance {
  id: string;
  role: TextRole;
  content: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  fontSize: number;
  fontWeight: number;
  maxLength?: number;
  style?: TextSlotStyle;
  layoutMode?: LayoutMode;
}

export interface ImageSlotInstance {
  id: string;
  purpose: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  selectedImageId?: string;
  imageUrl?: string;
}

export interface CanvasSection {
  id: string;
  componentId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  textSlots: TextSlotInstance[];
  imageSlots: ImageSlotInstance[];
  order: number;
}

export interface EditorState {
  projectId: string;
  sections: CanvasSection[];
  selectedSectionId?: string;
  selectedSlotId?: string;
  zoom: number;
  isDirty: boolean;
}
