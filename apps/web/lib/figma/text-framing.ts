import type { TextSlotTemplate } from "@/lib/types/brand";
import type { TextRole } from "@/lib/types/editor";

export interface RawTextNode {
  id: string;
  characters: string;
  fontSize: number;
  fontWeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function estimateMaxLength(width: number, fontSize: number): number {
  return Math.floor(width / (fontSize * 0.6));
}

export function classifyTextSlots(textNodes: RawTextNode[]): TextSlotTemplate[] {
  if (textNodes.length === 0) return [];

  // Sort descending by fontSize for ranking
  const sorted = [...textNodes].sort((a, b) => b.fontSize - a.fontSize);

  const sizes = sorted.map((n) => n.fontSize);
  const maxSize = sizes[0];
  const uniqueSizes = [...new Set(sizes)].sort((a, b) => b - a);

  // Smallest 20% threshold for caption
  const captionThreshold =
    uniqueSizes.length > 1
      ? uniqueSizes[Math.floor(uniqueSizes.length * 0.8)] ?? uniqueSizes[uniqueSizes.length - 1]
      : -1;

  // Determine the bottom-most Y for CTA detection
  const maxY = Math.max(...textNodes.map((n) => n.y + n.height));
  const bottomZoneThreshold = maxY * 0.85;

  function getRole(node: RawTextNode, rankIndex: number): TextRole {
    // CTA: near bottom, short text, bold
    if (
      node.y + node.height >= bottomZoneThreshold &&
      node.characters.length < 10 &&
      node.fontWeight >= 700
    ) {
      return "cta";
    }

    // Caption: smallest 20% by fontSize
    if (captionThreshold > 0 && node.fontSize <= captionThreshold) {
      return "caption";
    }

    const sizeRank = uniqueSizes.indexOf(node.fontSize);

    if (node.fontSize === maxSize) return "headline";
    if (sizeRank === 1) return "subheadline";
    return "body";
  }

  return sorted.map((node, index) => {
    const role = getRole(node, index);
    return {
      id: node.id,
      role,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      fontSize: node.fontSize,
      fontWeight: node.fontWeight,
      maxLength: estimateMaxLength(node.width, node.fontSize),
    };
  });
}
