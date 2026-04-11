import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  TranslationService,
  type TranslationInput,
  type TranslationOutput,
} from "@/lib/ai/translation-service";
import type { CanvasSection, TextSlotInstance } from "@/lib/types/editor";

interface TranslateRequestBody {
  projectId: string;
  targetLanguage: string;
  // Optional: caller supplies already-edited translation to save directly
  overrideTranslation?: TranslationOutput;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TranslateRequestBody;
    const { projectId, targetLanguage, overrideTranslation } = body;

    if (!projectId || !targetLanguage) {
      return NextResponse.json(
        { error: "projectId와 targetLanguage는 필수입니다." },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    // Get gemini_api_key from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("gemini_api_key")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.gemini_api_key) {
      return NextResponse.json(
        { error: "관리자에게 API 키 배정을 요청해주세요." },
        { status: 403 }
      );
    }

    // Get project canvas + brand info
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("canvas_sections, brand_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "프로젝트를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // Get protected terms from brand
    let protectedTerms: string[] = [];
    if (project.brand_id) {
      const { data: brand } = await supabase
        .from("brands")
        .select("protected_terms")
        .eq("id", project.brand_id)
        .single();

      if (brand?.protected_terms && Array.isArray(brand.protected_terms)) {
        protectedTerms = brand.protected_terms as string[];
      }
    }

    let translation: TranslationOutput;

    if (overrideTranslation) {
      // Caller is saving manually-edited translation — skip AI call
      translation = overrideTranslation;
    } else {
      // Build TranslationInput from canvas sections
      const canvasSections = (project.canvas_sections ?? []) as CanvasSection[];

      const input: TranslationInput = {
        sections: canvasSections.map((section: CanvasSection) => ({
          sectionId: section.id,
          texts: section.textSlots.map((slot: TextSlotInstance) => ({
            role: slot.role,
            content: slot.content,
            // contentEn is not on TextSlotInstance — omit (service falls back to content)
          })),
        })),
        protectedTerms,
      };

      const service = new TranslationService();
      translation = await service.translate({
        input,
        targetLanguage,
        geminiApiKey: profile.gemini_api_key as string,
      });
    }

    // Upsert to translations table by project_id + language
    const { error: upsertError } = await supabase
      .from("translations")
      .upsert(
        {
          project_id: projectId,
          language: targetLanguage,
          content: translation,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,language" }
      );

    if (upsertError) {
      console.error("[translate] upsert error:", upsertError);
      // Non-fatal: still return result to client
    }

    return NextResponse.json({ ok: true, translation, protectedTerms });
  } catch (err) {
    console.error("[translate] error:", err);
    const message =
      err instanceof Error ? err.message : "서버 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
