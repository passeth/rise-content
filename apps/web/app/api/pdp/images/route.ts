import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ImageService } from "@/lib/ai/image-service";
import type { SectionBlueprint, ImageGenOptions } from "@/lib/types/pdp";

interface ImageGenRequestBody {
  sectionBlueprint?: SectionBlueprint;
  sectionId?: string;
  projectId: string;
  originalImageBase64: string;
  originalImageMimeType?: string;
  aspectRatio?: string;
  options: ImageGenOptions & {
    guidePriorityMode?: "guide-first" | "style-first";
    withModel?: boolean;
    referenceModelImageBase64?: string;
    referenceModelImageMimeType?: string;
    referenceImageDescription?: string;
    headline?: string;
    subheadline?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ImageGenRequestBody;
    const { projectId, originalImageBase64, originalImageMimeType, aspectRatio, options } = body;

    if (!projectId || !originalImageBase64) {
      return NextResponse.json(
        { ok: false, error: "projectId와 originalImageBase64는 필수입니다." },
        { status: 400 }
      );
    }

    // Auth
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
    }

    // Get gemini_api_key from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("gemini_api_key")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.gemini_api_key) {
      return NextResponse.json(
        {
          ok: false,
          error: "설정 메뉴에서 Gemini API 키를 입력해 주세요.",
        },
        { status: 422 }
      );
    }

    // Resolve sectionBlueprint
    let sectionBlueprint = body.sectionBlueprint;

    if (!sectionBlueprint && body.sectionId) {
      // Attempt to build a minimal blueprint from the section ID for cases
      // where the caller only passes sectionId instead of the full blueprint
      sectionBlueprint = {
        section_id: body.sectionId,
        section_name: body.sectionId,
        goal: "",
        headline: "",
        headline_en: "",
        subheadline: "",
        subheadline_en: "",
        bullets: [],
        bullets_en: [],
        trust_or_objection_line: "",
        trust_or_objection_line_en: "",
        CTA: "",
        CTA_en: "",
        layout_notes: "",
        compliance_notes: "",
        image_id: "",
        purpose: "",
        prompt_ko: "",
        prompt_en: "",
        negative_prompt: "",
        style_guide: "",
        reference_usage: "",
      };
    }

    if (!sectionBlueprint) {
      return NextResponse.json(
        { ok: false, error: "sectionBlueprint 또는 sectionId가 필요합니다." },
        { status: 400 }
      );
    }

    // Generate image
    const imageService = new ImageService();
    const { base64, mimeType } = await imageService.generateImage({
      section: sectionBlueprint,
      originalImageBase64,
      originalImageMimeType,
      aspectRatio,
      geminiApiKey: profile.gemini_api_key as string,
      options: {
        ...options,
        guidePriorityMode: options.guidePriorityMode ?? "guide-first",
      },
    });

    // Save to Supabase Storage (generated-images bucket)
    const admin = createAdminClient();
    const timestamp = Date.now();
    const storagePath = `${user.id}/${projectId}/${timestamp}.jpg`;

    const imageBuffer = Buffer.from(base64, "base64");
    const { error: uploadError } = await admin.storage
      .from("generated-images")
      .upload(storagePath, imageBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      // Return image data even if storage upload fails
      return NextResponse.json({
        ok: true,
        imageUrl: null,
        imageBase64: base64,
        mimeType,
      });
    }

    const { data: urlData } = admin.storage
      .from("generated-images")
      .getPublicUrl(storagePath);

    const imageUrl = urlData.publicUrl;

    // Insert generated_images record
    const { data: insertedImage, error: dbError } = await admin
      .from("generated_images")
      .insert({
        project_id: projectId,
        section_id: body.sectionId ?? "",
        image_url: imageUrl,
        prompt: options.prompt,
        prompt_options: {
          width: options.width,
          height: options.height,
          style: options.style,
        },
      })
      .select("id")
      .single();

    if (dbError) {
      // Non-fatal: log but don't fail the request
      console.error("DB insert error for generated_images:", dbError);
    }

    return NextResponse.json({
      ok: true,
      imageId: insertedImage?.id ?? null,
      imageUrl,
      imageBase64: base64,
      mimeType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "이미지 생성 중 오류가 발생했습니다.";
    console.error("POST /api/pdp/images error:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
