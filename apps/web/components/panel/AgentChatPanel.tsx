"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SUMMARIZE_PROMPT, type AgentContext } from "@/lib/ai/copywriting-agent";
import { useProjectStore } from "@/lib/store/project-store";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

interface AgentChatPanelProps {
  projectId: string;
  brandName: string;
}

export function AgentChatPanel({ projectId, brandName }: AgentChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateAgentContext = useProjectStore((s) => s.updateAgentContext);

  const assistantMessageCount = messages.filter((m) => m.role === "assistant").length;

  // Load existing chat history on mount
  useEffect(() => {
    async function loadHistory() {
      const supabase = createClient();
      const { data } = await supabase
        .from("chat_histories")
        .select("id, role, content, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        setMessages(
          data.map((row) => ({
            id: row.id as string,
            role: row.role as "user" | "assistant",
            content: row.content as string,
            createdAt: row.created_at as string,
          }))
        );
      }
    }
    loadHistory();
  }, [projectId]);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSummarize = useCallback(async () => {
    if (isSummarizing || isLoading) return;
    setSummarizeError(null);
    setIsSummarizing(true);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          message: SUMMARIZE_PROMPT,
          history,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setSummarizeError((err as { error?: string }).error ?? "오류가 발생했습니다.");
        setIsSummarizing(false);
        return;
      }

      // Collect streamed response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              fullContent += data;
            }
          }
        }
      }

      // Extract JSON from response (handle markdown code fences)
      const jsonMatch = fullContent.match(/```(?:json)?\s*([\s\S]*?)```/) ||
        fullContent.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : fullContent.trim();

      let parsed: AgentContext;
      try {
        parsed = JSON.parse(jsonStr) as AgentContext;
      } catch {
        setSummarizeError("AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.");
        setIsSummarizing(false);
        return;
      }

      // Validate required fields
      if (!parsed.mainCopy || !parsed.tagline) {
        setSummarizeError("정리된 내용이 올바르지 않습니다. 대화를 더 진행 후 시도해주세요.");
        setIsSummarizing(false);
        return;
      }

      // Update store — cast through unknown to satisfy index signature of store's AgentContext
      updateAgentContext(parsed as unknown as Record<string, unknown>);

      // Persist to Supabase
      const supabase = createClient();
      await supabase
        .from("projects")
        .update({ agent_context: parsed })
        .eq("id", projectId);

    } catch {
      setSummarizeError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSummarizing(false);
    }
  }, [isSummarizing, isLoading, messages, projectId, updateAgentContext]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Build history for API (exclude the message we just added)
    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          message: trimmed,
          history,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: (err as { error?: string }).error ?? "오류가 발생했습니다.",
        };
        setMessages((prev) => [...prev, errMsg]);
        setIsLoading(false);
        return;
      }

      // Stream response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      const assistantId = crypto.randomUUID();
      let fullContent = "";

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          // Parse SSE lines
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              fullContent += data;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: fullContent }
                    : m
                )
              );
            }
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "네트워크 오류가 발생했습니다. 다시 시도해주세요.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, projectId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm font-medium text-foreground">
          {brandName} 브랜드 전문가
        </p>
        <p className="text-xs text-muted-foreground">
          상세페이지 컨셉 및 카피라이팅을 도와드립니다
        </p>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground text-center px-8">
              제품 정보를 입력하셨나요?
              <br />
              브랜드 전문가에게 질문해보세요.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-muted text-foreground rounded-tl-sm"
              )}
            >
              {msg.content === "" && msg.role === "assistant" ? (
                <LoadingDots />
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
            </div>
          </div>
        ))}

        {isLoading &&
          messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5">
                <LoadingDots />
              </div>
            </div>
          )}

        <div ref={bottomRef} />
      </div>

      {/* Summarize action */}
      <div className="px-4 py-2 border-t border-border flex flex-col gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSummarize}
          disabled={isSummarizing || isLoading || assistantMessageCount < 3}
          className="w-full text-xs"
        >
          {isSummarizing ? "정리 중..." : "✨ 정리하기"}
        </Button>
        {summarizeError && (
          <p className="text-xs text-destructive text-center">{summarizeError}</p>
        )}
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)"
          rows={2}
          disabled={isLoading}
          className="flex-1 resize-none"
        />
        <Button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          size="sm"
          className="mb-0.5 shrink-0"
        >
          전송
        </Button>
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <span className="inline-flex gap-1 items-center h-4">
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce" />
    </span>
  );
}
