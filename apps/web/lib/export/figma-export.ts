import type { CanvasSection } from "@/lib/types/editor";

export interface FigmaExportData {
  projectName: string;
  sections: Array<{
    name: string;
    width: number;
    height: number;
    textSlots: Array<{
      role: string;
      content: string;
      x: number;
      y: number;
      fontSize: number;
      fontWeight: number;
    }>;
    imageSlots: Array<{
      imageUrl?: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  }>;
}

export function prepareFigmaExportData(
  sections: CanvasSection[],
  projectName: string
): FigmaExportData {
  const sorted = [...sections].sort((a, b) => a.order - b.order);

  return {
    projectName,
    sections: sorted.map((section, index) => ({
      name: `Section ${index + 1}`,
      width: section.size.width,
      height: section.size.height,
      textSlots: section.textSlots.map((slot) => ({
        role: slot.role,
        content: slot.content,
        x: slot.position.x,
        y: slot.position.y,
        fontSize: slot.fontSize,
        fontWeight: slot.fontWeight,
      })),
      imageSlots: section.imageSlots.map((slot) => ({
        imageUrl: slot.imageUrl,
        x: slot.position.x,
        y: slot.position.y,
        width: slot.size.width,
        height: slot.size.height,
      })),
    })),
  };
}

export function generateFigmaPluginMessage(data: FigmaExportData): string {
  return JSON.stringify(data, null, 2);
}
