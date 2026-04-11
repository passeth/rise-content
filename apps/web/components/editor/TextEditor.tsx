"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/store/editor-store";
import type { TextSlotInstance } from "@/lib/types/editor";

interface TextEditorProps {
  sectionId: string;
  slot: TextSlotInstance;
}

const PLACEHOLDERS: Record<TextSlotInstance["role"], string> = {
  headline: "제목을 입력하세요",
  subheadline: "부제목을 입력하세요",
  body: "설명을 입력하세요",
  caption: "캡션을 입력하세요",
  cta: "버튼 텍스트",
};

export function TextEditor({ sectionId, slot }: TextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const updateTextSlot = useEditorStore((s) => s.updateTextSlot);
  const selectSlot = useEditorStore((s) => s.selectSlot);
  const selectedSlotId = useEditorStore((s) => s.selectedSlotId);

  const isSelected = selectedSlotId === slot.id;
  const charCount = slot.content.length;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = slot.content.replace(/\n/g, "<br>");
    if (el.innerHTML !== html) {
      el.innerHTML = html;
    }
  }, [slot.content]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const br = document.createElement("br");
      range.insertNode(br);
      range.setStartAfter(br);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function handleBlur() {
    const el = ref.current;
    if (!el) return;
    const content = el.innerHTML.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    updateTextSlot(sectionId, slot.id, content);
  }

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    selectSlot(sectionId, slot.id);
  }

  const isEmpty = !slot.content;
  const s = slot.style;

  return (
    <div className="relative w-full h-full">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onClick={handleClick}
        className={cn(
          "outline-none cursor-text whitespace-pre-wrap break-words",
          isSelected && "ring-2 ring-blue-400 ring-offset-1",
          isEmpty && "before:content-[attr(data-placeholder)] before:text-muted-foreground/50 before:pointer-events-none"
        )}
        style={{
          fontSize: `${slot.fontSize}px`,
          fontWeight: slot.fontWeight,
          lineHeight: s?.lineHeight ?? 1.4,
          color: s?.textColor ?? "inherit",
          backgroundColor: s?.backgroundColor ?? "transparent",
          padding: s?.padding ?? "0",
          borderRadius: s?.borderRadius ?? "0",
          border: s?.border ?? "none",
          textAlign: s?.textAlign ?? "left",
          letterSpacing: s?.letterSpacing ?? "normal",
          width: "100%",
          minHeight: "1em",
          height: "auto",
          overflow: "visible",
        }}
        data-placeholder={PLACEHOLDERS[slot.role]}
      />
      {/* Character count as guide only — no enforcement */}
      {slot.maxLength !== undefined && isSelected && (
        <span
          className={cn(
            "absolute -bottom-4 right-0 text-[10px] select-none z-20",
            charCount > slot.maxLength ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {charCount}/{slot.maxLength}
        </span>
      )}
    </div>
  );
}
