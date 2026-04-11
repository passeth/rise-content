import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchFigmaNodes, fetchFigmaPageBlocks, fetchFigmaThumbnails, parseFigmaUrl } from "@/lib/figma/import";
import type { ComponentCategory, LayoutType } from "@/lib/types/brand";

interface ImportRequestBody {
  figmaUrl: string;
  brandId: string;
  category?: ComponentCategory;
  figmaToken?: string;
  mode?: "single" | "batch";
}

function detectCategory(name: string): ComponentCategory {
  const lower = name.toLowerCase();
  if (/hero|intro|\ud788\uc5b4\ub85c|\uc778\ud2b8\ub85c/.test(lower)) return "hero";
  if (/benefit|\ubca0\ub124\ud54f|\uc7a5\uc810|\ud2b9\uc7a5\uc810/.test(lower)) return "benefit";
  if (/ingredient|\uc131\ubd84|\uc6d0\ub8cc/.test(lower)) return "ingredient";
  if (/review|\ud6c4\uae30|\ub9ac\ubdf0/.test(lower)) return "review";
  if (/cta|\uad6c\ub9e4|\uc8fc\ubb38/.test(lower)) return "cta";
  if (/usage|\uc0ac\uc6a9|how/.test(lower)) return "usage";
  if (/routine|\ub8e8\ud2f4/.test(lower)) return "routine";
  return "benefit";
}

export async function POST(request: NextRequest) {
  // Authenticate the requesting user
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check admin role
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  // Parse request body
  let body: ImportRequestBody;
  try {
    body = (await request.json()) as ImportRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { figmaUrl, brandId, category, figmaToken, mode = "batch" } = body;

  if (!figmaUrl || !brandId) {
    return NextResponse.json(
      { error: "figmaUrl and brandId are required" },
      { status: 400 }
    );
  }

  const parsed = parseFigmaUrl(figmaUrl);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid Figma URL" }, { status: 400 });
  }

  if (!parsed.nodeId) {
    return NextResponse.json(
      { error: "Figma URL must include a node-id parameter" },
      { status: 400 }
    );
  }

  const token = figmaToken ?? process.env.FIGMA_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Figma access token is not configured" },
      { status: 500 }
    );
  }

  const serviceClient = createAdminClient();

  if (mode === "single") {
    // Backward compatible single-node import
    let importResult;
    try {
      importResult = await fetchFigmaNodes(parsed.fileKey, parsed.nodeId, token);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Figma API request failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const resolvedCategory = category ?? detectCategory(importResult.componentName);

    const { data: component, error: insertError } = await serviceClient
      .from("components")
      .insert({
        brand_id: brandId,
        name: importResult.componentName,
        category: resolvedCategory,
        layout_type: importResult.layoutType,
        figma_file_key: parsed.fileKey,
        figma_node_id: parsed.nodeId,
        version: 1,
        thumbnail_url: importResult.thumbnailUrl ?? null,
        template_data: {
          width: importResult.width,
          height: importResult.height,
        },
        text_slots: importResult.textSlots,
        image_slots: importResult.imageSlots,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ component }, { status: 201 });
  }

  // Batch mode: import all child frames as individual blocks
  let blocks;
  try {
    blocks = await fetchFigmaPageBlocks(parsed.fileKey, parsed.nodeId, token);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Figma API request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Fetch thumbnail for the parent node from Figma Images API
  let thumbnailMap: Record<string, string> = {};
  try {
    thumbnailMap = await fetchFigmaThumbnails(parsed.fileKey, [parsed.nodeId!], token);
  } catch {
    // Thumbnails are optional, continue without them
  }

  const rows = blocks.map((block) => ({
    brand_id: brandId,
    name: block.componentName,
    category: category ?? detectCategory(block.componentName),
    layout_type: block.layoutType as LayoutType,
    figma_file_key: parsed.fileKey,
    figma_node_id: parsed.nodeId,
    version: 1,
    thumbnail_url: thumbnailMap[parsed.nodeId!] ?? block.thumbnailUrl ?? null,
    template_data: {
      width: block.width,
      height: block.height,
    },
    text_slots: block.textSlots,
    image_slots: block.imageSlots,
  }));

  const { data: components, error: insertError } = await serviceClient
    .from("components")
    .insert(rows)
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ components, count: components?.length ?? 0 }, { status: 201 });
}
