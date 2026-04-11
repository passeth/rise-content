import type { TextSlotTemplate, ImageSlotTemplate, LayoutType } from "./brand";

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
}

export interface FigmaTextNode extends FigmaNode {
  type: "TEXT";
  characters: string;
  style: {
    fontSize: number;
    fontWeight: number;
    textAlignHorizontal: string;
  };
  absoluteBoundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FigmaImportResult {
  componentName: string;
  textSlots: TextSlotTemplate[];
  imageSlots: ImageSlotTemplate[];
  width: number;
  height: number;
  thumbnailUrl?: string;
  layoutType: LayoutType;
}

export interface FigmaBlockImportResult {
  blocks: FigmaImportResult[];
}
