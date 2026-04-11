import type { FigmaImportResult, FigmaNode, FigmaTextNode } from "@/lib/types/figma";
import type { ImageSlotTemplate, LayoutType } from "@/lib/types/brand";
import { classifyTextSlots, type RawTextNode } from "./text-framing";

interface FigmaApiNode {
  document: FigmaNode;
  name?: string;
}

interface FigmaNodesResponse {
  nodes: Record<string, FigmaApiNode>;
}

function isTextNode(node: FigmaNode): node is FigmaTextNode {
  return node.type === "TEXT";
}

function collectTextNodes(node: FigmaNode): FigmaTextNode[] {
  const results: FigmaTextNode[] = [];
  if (isTextNode(node)) {
    results.push(node);
  }
  if (node.children) {
    for (const child of node.children) {
      results.push(...collectTextNodes(child));
    }
  }
  return results;
}

function collectImageNodes(node: FigmaNode): FigmaNode[] {
  const results: FigmaNode[] = [];
  if (node.type === "RECTANGLE" || node.type === "VECTOR" || node.type === "INSTANCE") {
    results.push(node);
  }
  if (node.children) {
    for (const child of node.children) {
      if (!isTextNode(child)) {
        results.push(...collectImageNodes(child));
      }
    }
  }
  return results;
}

function getFrameDimensions(node: FigmaNode): { width: number; height: number } {
  const n = node as FigmaNode & {
    absoluteBoundingBox?: { width: number; height: number };
    size?: { width: number; height: number };
  };
  if (n.absoluteBoundingBox) {
    return { width: n.absoluteBoundingBox.width, height: n.absoluteBoundingBox.height };
  }
  if (n.size) {
    return { width: n.size.width, height: n.size.height };
  }
  return { width: 0, height: 0 };
}

function getNodeOrigin(node: FigmaNode): { x: number; y: number } {
  const n = node as FigmaNode & {
    absoluteBoundingBox?: { x: number; y: number };
  };
  if (n.absoluteBoundingBox) {
    return { x: n.absoluteBoundingBox.x, y: n.absoluteBoundingBox.y };
  }
  return { x: 0, y: 0 };
}

type NodeWithBBox = FigmaNode & {
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
};

function groupByVerticalOverlap(nodes: NodeWithBBox[]): NodeWithBBox[][] {
  if (nodes.length === 0) return [];

  const groups: NodeWithBBox[][] = [];

  for (const node of nodes) {
    const bbox = node.absoluteBoundingBox;
    if (!bbox) continue;

    const nodeTop = bbox.y;
    const nodeBottom = bbox.y + bbox.height;

    let placed = false;
    for (const group of groups) {
      // Check if this node vertically overlaps with any node in the group
      const overlaps = group.some((g) => {
        const gb = g.absoluteBoundingBox;
        if (!gb) return false;
        const gTop = gb.y;
        const gBottom = gb.y + gb.height;
        return nodeTop < gBottom && nodeBottom > gTop;
      });

      if (overlaps) {
        group.push(node);
        placed = true;
        break;
      }
    }

    if (!placed) {
      groups.push([node]);
    }
  }

  return groups;
}

function detectLayoutType(children: FigmaNode[]): LayoutType {
  const significantChildren = (children as NodeWithBBox[]).filter(
    (c) => (c.absoluteBoundingBox?.width ?? 0) > 100
  );

  if (significantChildren.length === 0) return "1-col";

  const sortedByX = [...significantChildren].sort(
    (a, b) => (a.absoluteBoundingBox?.x ?? 0) - (b.absoluteBoundingBox?.x ?? 0)
  );

  const horizontalGroups = groupByVerticalOverlap(sortedByX);
  const maxColumnsInAnyRow = Math.max(...horizontalGroups.map((g) => g.length));

  if (maxColumnsInAnyRow >= 3) return "3-col";
  if (maxColumnsInAnyRow >= 2) return "2-col";
  return "1-col";
}

function buildImportResult(rootNode: FigmaNode): FigmaImportResult {
  const componentName = rootNode.name || "Untitled Component";
  const { width, height } = getFrameDimensions(rootNode);
  const origin = getNodeOrigin(rootNode);

  const figmaTextNodes = collectTextNodes(rootNode);
  const rawTextNodes: RawTextNode[] = figmaTextNodes.map((n) => ({
    id: n.id,
    characters: n.characters,
    fontSize: n.style.fontSize,
    fontWeight: n.style.fontWeight,
    x: n.absoluteBoundingBox.x - origin.x,
    y: n.absoluteBoundingBox.y - origin.y,
    width: n.absoluteBoundingBox.width,
    height: n.absoluteBoundingBox.height,
  }));

  const textSlots = classifyTextSlots(rawTextNodes);

  const imageNodes = collectImageNodes(rootNode).filter(
    (n) => n.type === "RECTANGLE" || n.type === "INSTANCE"
  );

  const imageSlots: ImageSlotTemplate[] = imageNodes.map((n) => {
    const imageNode = n as NodeWithBBox;
    const bbox = imageNode.absoluteBoundingBox;
    return {
      id: n.id,
      x: bbox ? bbox.x - origin.x : 0,
      y: bbox ? bbox.y - origin.y : 0,
      width: bbox?.width ?? 0,
      height: bbox?.height ?? 0,
      purpose: n.name || "image",
    };
  });

  const layoutType = detectLayoutType(rootNode.children ?? []);

  return {
    componentName,
    textSlots,
    imageSlots,
    width,
    height,
    layoutType,
  };
}

export async function fetchFigmaNodes(
  fileKey: string,
  nodeId: string,
  token: string
): Promise<FigmaImportResult> {
  const encodedNodeId = encodeURIComponent(nodeId);
  const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodedNodeId}`;

  const response = await fetch(url, {
    headers: {
      "X-Figma-Token": token,
    },
  });

  if (!response.ok) {
    throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
  }

  const data: FigmaNodesResponse = await response.json() as FigmaNodesResponse;

  const nodeKey = Object.keys(data.nodes)[0];
  if (!nodeKey) {
    throw new Error("No nodes returned from Figma API");
  }

  const apiNode = data.nodes[nodeKey];
  if (!apiNode) {
    throw new Error(`Node ${nodeId} not found in Figma response`);
  }

  return buildImportResult(apiNode.document);
}

export async function fetchFigmaPageBlocks(
  fileKey: string,
  nodeId: string,
  token: string
): Promise<FigmaImportResult[]> {
  const encodedNodeId = encodeURIComponent(nodeId);
  const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodedNodeId}`;

  const response = await fetch(url, {
    headers: {
      "X-Figma-Token": token,
    },
  });

  if (!response.ok) {
    throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
  }

  const data: FigmaNodesResponse = await response.json() as FigmaNodesResponse;

  const nodeKey = Object.keys(data.nodes)[0];
  if (!nodeKey) {
    throw new Error("No nodes returned from Figma API");
  }

  const apiNode = data.nodes[nodeKey];
  if (!apiNode) {
    throw new Error(`Node ${nodeId} not found in Figma response`);
  }

  const rootNode = apiNode.document;
  const blockTypes = new Set(["FRAME", "COMPONENT", "INSTANCE"]);

  const childFrames = (rootNode.children ?? []).filter((child) =>
    blockTypes.has(child.type)
  );

  // If no child frames found, treat the root node itself as a single block
  if (childFrames.length === 0) {
    return [buildImportResult(rootNode)];
  }

  return childFrames.map((child) => buildImportResult(child));
}

/**
 * Fetch thumbnail images for specific node IDs from Figma Images API.
 * Returns a map of nodeId → imageUrl.
 */
export async function fetchFigmaThumbnails(
  fileKey: string,
  nodeIds: string[],
  token: string
): Promise<Record<string, string>> {
  if (nodeIds.length === 0) return {};
  const ids = nodeIds.map((id) => encodeURIComponent(id)).join(",");
  const url = `https://api.figma.com/v1/images/${fileKey}?ids=${ids}&format=png&scale=0.5`;
  const response = await fetch(url, {
    headers: { "X-Figma-Token": token },
  });
  if (!response.ok) return {};
  const data = (await response.json()) as { images?: Record<string, string> };
  return data.images ?? {};
}

export function parseFigmaUrl(url: string): { fileKey: string; nodeId?: string } | null {
  try {
    const parsed = new URL(url);
    // Match: figma.com/design/:fileKey/...
    const match = parsed.pathname.match(/\/design\/([^/]+)/);
    if (!match) return null;

    const fileKey = match[1];
    if (!fileKey) return null;

    const rawNodeId = parsed.searchParams.get("node-id");
    const nodeId = rawNodeId ? rawNodeId.replace(/-/g, ":") : undefined;

    return { fileKey, nodeId };
  } catch {
    return null;
  }
}
