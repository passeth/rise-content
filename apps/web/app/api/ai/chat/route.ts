import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import {
  BRAND_EXPERT_SYSTEM_PROMPT,
  buildChatMessages,
} from "@/lib/ai/copywriting-agent";

interface ChatRequestBody {
  projectId: string;
  message: string;
  history: { role: string; content: string }[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const { projectId, message, history } = body;

    if (!projectId || !message) {
      return NextResponse.json(
        { error: "projectId와 message는 필수입니다." },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get authenticated user
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

    // Get user's gemini_api_key from profiles
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

    // Get product info from project for context
    const { data: project } = await supabase
      .from("projects")
      .select("product_info")
      .eq("id", projectId)
      .single();

    const productInfo = (project?.product_info as Record<string, string>) ?? {};

    // Build chat messages
    const chatMessages = buildChatMessages(history, productInfo, message);

    // Initialize GoogleGenAI
    const ai = new GoogleGenAI({ apiKey: profile.gemini_api_key as string });

    // Convert to Gemini content format (skip the last user message — sent as current turn)
    const historyForChat = chatMessages.slice(0, -1).map((m) => ({
      role: m.role as "user" | "model",
      parts: [{ text: m.content }],
    }));

    const chat = ai.chats.create({
      model: "gemini-2.0-flash",
      config: {
        systemInstruction: BRAND_EXPERT_SYSTEM_PROMPT,
      },
      history: historyForChat,
    });

    // Stream response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullResponse = "";

        try {
          const streamResponse = await chat.sendMessageStream({
            message: message,
          });

          for await (const chunk of streamResponse) {
            const text = chunk.text ?? "";
            if (text) {
              fullResponse += text;
              controller.enqueue(encoder.encode(`data: ${text}\n\n`));
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err) {
          const errMsg =
            err instanceof Error ? err.message : "AI 응답 생성 실패";
          controller.enqueue(
            encoder.encode(`data: ${errMsg}\n\n`)
          );
        } finally {
          controller.close();

          // Save assistant response to chat_histories
          if (fullResponse) {
            const supabaseForSave = createClient();
            await supabaseForSave.from("chat_histories").insert([
              {
                project_id: projectId,
                role: "user",
                content: message,
              },
              {
                project_id: projectId,
                role: "assistant",
                content: fullResponse,
              },
            ]);
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[chat/route] error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
