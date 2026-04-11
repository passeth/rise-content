"use client";

import { useCallback, useRef, useState } from "react";
import { useProjectStore } from "@/lib/store/project-store";
import { createClient } from "@/lib/supabase/client";
import type { AgentContext } from "@/lib/ai/copywriting-agent";

interface AgentSummaryCardProps {
  projectId: string;
}

function EditableField({
  value,
  onSave,
  className,
  placeholder,
}: {
  value: string;
  onSave: (val: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleClick = () => {
    setDraft(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleBlur = () => {
    setEditing(false);
    if (draft !== value) {
      onSave(draft);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <textarea
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        rows={2}
        className={`w-full bg-muted/60 border border-ring rounded px-2 py-1 resize-none outline-none text-foreground ${className ?? ""}`}
      />
    );
  }

  return (
    <span
      onClick={handleClick}
      title="클릭하여 편집"
      className={`cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors ${className ?? ""}`}
    >
      {value || <span className="text-muted-foreground italic">{placeholder}</span>}
    </span>
  );
}

export function AgentSummaryCard({ projectId }: AgentSummaryCardProps) {
  const { currentProject, updateAgentContext } = useProjectStore();
  const agentContext = currentProject?.agentContext as Partial<AgentContext> | undefined;

  const isEmpty =
    !agentContext?.mainCopy &&
    !agentContext?.tagline &&
    !agentContext?.designMood &&
    !agentContext?.toneAndManner &&
    (!agentContext?.usp || agentContext.usp.length === 0);

  const persist = useCallback(
    async (patch: Partial<AgentContext>) => {
      const supabase = createClient();
      const next = { ...agentContext, ...patch };
      await supabase
        .from("projects")
        .update({ agent_context: next })
        .eq("id", projectId);
    },
    [agentContext, projectId]
  );

  const handleFieldSave = useCallback(
    (field: keyof AgentContext, value: string) => {
      const patch = { [field]: value } as Partial<AgentContext>;
      updateAgentContext(patch);
      persist(patch);
    },
    [updateAgentContext, persist]
  );

  const handleUspSave = useCallback(
    (index: number, value: string) => {
      const current = agentContext?.usp ? [...agentContext.usp] : [];
      current[index] = value;
      const patch: Partial<AgentContext> = { usp: current };
      updateAgentContext(patch);
      persist(patch);
    },
    [agentContext, updateAgentContext, persist]
  );

  if (isEmpty) {
    return (
      <div className="mx-4 my-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">아직 정리된 내용이 없습니다</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          AI 에이전트 탭에서 대화 후 정리하기를 눌러주세요
        </p>
      </div>
    );
  }

  return (
    <div className="mx-4 my-3 rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
      {/* Main Copy */}
      {agentContext?.mainCopy !== undefined && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            메인 카피
          </span>
          <EditableField
            value={agentContext.mainCopy ?? ""}
            onSave={(v) => handleFieldSave("mainCopy", v)}
            className="text-lg font-bold text-foreground leading-snug"
            placeholder="메인 카피를 입력하세요"
          />
        </div>
      )}

      {/* Tagline */}
      {agentContext?.tagline !== undefined && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            태그라인
          </span>
          <EditableField
            value={agentContext.tagline ?? ""}
            onSave={(v) => handleFieldSave("tagline", v)}
            className="text-base italic text-foreground/80"
            placeholder="태그라인을 입력하세요"
          />
        </div>
      )}

      {/* USP */}
      {agentContext?.usp && agentContext.usp.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            USP
          </span>
          <ul className="flex flex-col gap-1 pl-3">
            {agentContext.usp.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-muted-foreground mt-0.5 shrink-0">•</span>
                <EditableField
                  value={item}
                  onSave={(v) => handleUspSave(i, v)}
                  className="text-sm text-foreground flex-1"
                  placeholder="USP 항목"
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Design Mood */}
      {agentContext?.designMood !== undefined && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            디자인 무드
          </span>
          <EditableField
            value={agentContext.designMood ?? ""}
            onSave={(v) => handleFieldSave("designMood", v)}
            className="text-sm text-foreground"
            placeholder="디자인 무드를 입력하세요"
          />
        </div>
      )}

      {/* Tone & Manner */}
      {agentContext?.toneAndManner !== undefined && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            톤앤매너
          </span>
          <EditableField
            value={agentContext.toneAndManner ?? ""}
            onSave={(v) => handleFieldSave("toneAndManner", v)}
            className="text-sm text-foreground"
            placeholder="톤앤매너를 입력하세요"
          />
        </div>
      )}
    </div>
  );
}
