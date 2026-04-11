import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PdpService } from "@/lib/ai/pdp-service";
import type { LayoutConstraint } from "@/lib/ai/pdp-service";

interface AnalyzeRequestBody {
  imageBase64: string;
  mimeType: string;
  projectId: string;
  additionalInfo?: string;
  desiredTone?: string;
  layoutConstraints?: LayoutConstraint[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyzeRequestBody;
    const {
      imageBase64,
      mimeType,
      projectId,
      additionalInfo,
      desiredTone,
      layoutConstraints,
    } = body;

    if (!imageBase64 || !mimeType || !projectId) {
      return NextResponse.json(
        { error: "imageBase64, mimeType, projectId는 필수입니다." },
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

    // Get agentContext from project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("agent_context")
      .eq("id", projectId)
      .single();

    if (projectError) {
      return NextResponse.json(
        { error: "프로젝트를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const agentContext =
      (project?.agent_context as Record<string, unknown>) ?? {};

    // Run PDP analysis
    const service = new PdpService();
    const { blueprint } = await service.analyzeProduct({
      imageBase64,
      mimeType,
      additionalInfo,
      desiredTone,
      agentContext,
      layoutConstraints,
      geminiApiKey: profile.gemini_api_key as string,
    });

    // Save blueprint to projects.blueprint
    const { error: updateError } = await supabase
      .from("projects")
      .update({ blueprint })
      .eq("id", projectId);

    if (updateError) {
      console.error("[pdp/analyze] blueprint save error:", updateError);
      // Non-fatal: still return the blueprint to the client
    }

    return NextResponse.json({ ok: true, blueprint });
  } catch (err) {
    console.error("[pdp/analyze] error:", err);
    const message =
      err instanceof Error ? err.message : "서버 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
