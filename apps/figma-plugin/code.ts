/// <reference types="@figma/plugin-typings" />

interface TextSlot {
  role: string;
  content: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: number;
}

interface ImageSlot {
  imageUrl?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SectionData {
  name: string;
  width: number;
  height: number;
  textSlots: TextSlot[];
  imageSlots: ImageSlot[];
}

interface FigmaExportData {
  projectName: string;
  sections: SectionData[];
}

figma.showUI(__html__, { width: 480, height: 400, title: "EVAS PDP Maker Export" });

figma.ui.onmessage = async (msg: { type: string; data?: FigmaExportData }) => {
  if (msg.type !== "import-pdp" || !msg.data) return;

  const { projectName, sections } = msg.data;

  const pageFrame = figma.createFrame();
  pageFrame.name = projectName;
  pageFrame.layoutMode = "VERTICAL";
  pageFrame.itemSpacing = 0;
  pageFrame.paddingTop = 0;
  pageFrame.paddingBottom = 0;
  pageFrame.paddingLeft = 0;
  pageFrame.paddingRight = 0;
  pageFrame.counterAxisSizingMode = "FIXED";
  pageFrame.resize(
    sections[0]?.width ?? 1080,
    sections.reduce((sum, s) => sum + s.height, 0)
  );

  let yOffset = 0;

  for (const section of sections) {
    const sectionFrame = figma.createFrame();
    sectionFrame.name = section.name;
    sectionFrame.resize(section.width, section.height);
    sectionFrame.x = 0;
    sectionFrame.y = yOffset;
    sectionFrame.clipsContent = true;

    // Create text nodes
    for (const slot of section.textSlots) {
      if (!slot.content) continue;

      const textNode = figma.createText();
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });

      textNode.characters = slot.content;
      textNode.fontSize = slot.fontSize;
      textNode.x = slot.x;
      textNode.y = slot.y;

      if (slot.fontWeight >= 700) {
        await figma.loadFontAsync({ family: "Inter", style: "Bold" });
        textNode.fontName = { family: "Inter", style: "Bold" };
      } else {
        textNode.fontName = { family: "Inter", style: "Regular" };
      }

      sectionFrame.appendChild(textNode);
    }

    // Create image placeholder rectangles
    for (const imgSlot of section.imageSlots) {
      const rect = figma.createRectangle();
      rect.name = "Image Placeholder";
      rect.resize(imgSlot.width, imgSlot.height);
      rect.x = imgSlot.x;
      rect.y = imgSlot.y;
      rect.fills = [
        {
          type: "SOLID",
          color: { r: 0.9, g: 0.9, b: 0.9 },
          opacity: 1,
        },
      ];
      sectionFrame.appendChild(rect);
    }

    pageFrame.appendChild(sectionFrame);
    yOffset += section.height;
  }

  figma.currentPage.appendChild(pageFrame);
  figma.viewport.scrollAndZoomIntoView([pageFrame]);

  figma.ui.postMessage({ type: "import-complete" });
};
