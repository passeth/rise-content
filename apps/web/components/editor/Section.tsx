"use client";

import { useState, useRef } from "react";
import { ChevronUp, ChevronDown, X, GripVertical, ImagePlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/store/editor-store";
import { TextEditor } from "./TextEditor";
import type { CanvasSection } from "@/lib/types/editor";

interface SectionProps {
  section: CanvasSection;
  index: number;
  total: number;
}

export function Section({ section, index, total }: SectionProps) {
  const [isHovered, setIsHovered] = useState(false);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const removeSection = useEditorStore((s) => s.removeSection);
  const updateSection = useEditorStore((s) => s.updateSection);
  const selectSection = useEditorStore((s) => s.selectSection);
  const reorderSections = useEditorStore((s) => s.reorderSections);
  const selectedSectionId = useEditorStore((s) => s.selectedSectionId);

  const isSelected = selectedSectionId === section.id;

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startHeight = section.size.height;
    resizeRef.current = { startY: e.clientY, startHeight };

    function onMouseMove(ev: MouseEvent) {
      if (!resizeRef.current) return;
      const delta = ev.clientY - resizeRef.current.startY;
      const newHeight = Math.max(100, resizeRef.current.startHeight + delta);
      const scale = newHeight / resizeRef.current.startHeight;

      // Scale all slot Y positions proportionally
      const scaledTextSlots = section.textSlots.map((s) => ({
        ...s,
        position: { x: s.position.x, y: Math.round(s.position.y * scale) },
      }));
      const scaledImageSlots = section.imageSlots.map((s) => ({
        ...s,
        position: { x: s.position.x, y: Math.round(s.position.y * scale) },
        size: { width: s.size.width, height: Math.round(s.size.height * scale) },
      }));

      updateSection(section.id, {
        size: { ...section.size, height: newHeight },
        textSlots: scaledTextSlots,
        imageSlots: scaledImageSlots,
      });
    }
    function onMouseUp() {
      resizeRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function removeTextSlot(slotId: string) {
    updateSection(section.id, {
      textSlots: section.textSlots.filter((s) => s.id !== slotId),
    });
  }

  function removeImageSlot(slotId: string) {
    updateSection(section.id, {
      imageSlots: section.imageSlots.filter((s) => s.id !== slotId),
    });
  }

  return (
    <div
      className={cn(
        "relative border-2 transition-colors bg-background",
        isSelected ? "border-blue-500" : isHovered ? "border-blue-300" : "border-border"
      )}
      style={{ width: section.size.width, height: section.size.height }}
      onClick={(e) => { e.stopPropagation(); selectSection(section.id); }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Section controls */}
      {(isHovered || isSelected) && (
        <div className="absolute -left-10 top-0 flex flex-col gap-1 z-20">
          <button
            onClick={(e) => { e.stopPropagation(); if (index > 0) reorderSections(index, index - 1); }}
            disabled={index === 0}
            className="w-7 h-7 rounded bg-card border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30"
            title="위로 이동"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <div className="w-7 h-7 rounded bg-card border border-border flex items-center justify-center text-muted-foreground">
            <GripVertical className="w-4 h-4" />
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); if (index < total - 1) reorderSections(index, index + 1); }}
            disabled={index >= total - 1}
            className="w-7 h-7 rounded bg-card border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30"
            title="아래로 이동"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); removeSection(section.id); }}
            className="w-7 h-7 rounded bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/80"
            title="삭제"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Section label */}
      {(isHovered || isSelected) && (
        <div className="absolute -top-6 left-0 text-xs text-muted-foreground bg-card px-2 py-0.5 rounded border border-border">
          섹션 {index + 1}
        </div>
      )}

      {/* Image slots — z-0 behind text */}
      {section.imageSlots.map((slot) => (
        <ImageSlot
          key={slot.id}
          sectionId={section.id}
          slot={slot}
          showControls={isHovered || isSelected}
          onDelete={() => removeImageSlot(slot.id)}
        />
      ))}

      {/* Auto-layout text slots — flow vertically with gaps */}
      {section.textSlots.some((s) => (s.layoutMode ?? "auto") === "auto") && (
        <div
          className="absolute z-10 flex flex-col"
          style={{
            left: section.textSlots.find((s) => (s.layoutMode ?? "auto") === "auto")?.position.x ?? 72,
            top: section.textSlots.find((s) => (s.layoutMode ?? "auto") === "auto")?.position.y ?? 170,
            width: section.textSlots.find((s) => (s.layoutMode ?? "auto") === "auto")?.size.width ?? 716,
            gap: 20,
          }}
        >
          {section.textSlots
            .filter((s) => (s.layoutMode ?? "auto") === "auto")
            .map((slot) => (
              <AutoTextSlot
                key={slot.id}
                sectionId={section.id}
                section={section}
                slot={slot}
                showDelete={isHovered || isSelected}
                onDelete={() => removeTextSlot(slot.id)}
              />
            ))}
        </div>
      )}

      {/* Free-positioned text slots — absolute, draggable */}
      {section.textSlots
        .filter((s) => s.layoutMode === "free")
        .map((slot) => (
          <DraggableTextSlot
            key={slot.id}
            sectionId={section.id}
            section={section}
            slot={slot}
            showDelete={isHovered || isSelected}
            onDelete={() => removeTextSlot(slot.id)}
          />
        ))}

      {/* Height resize handle */}
      {(isHovered || isSelected) && (
        <div
          className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize bg-blue-500/20 hover:bg-blue-500/40 transition-colors flex items-center justify-center z-20"
          onMouseDown={handleResizeStart}
        >
          <div className="w-8 h-1 rounded-full bg-blue-500" />
        </div>
      )}
    </div>
  );
}

function AutoTextSlot({
  sectionId,
  section,
  slot,
  showDelete,
  onDelete,
}: {
  sectionId: string;
  section: CanvasSection;
  slot: CanvasSection["textSlots"][number];
  showDelete: boolean;
  onDelete: () => void;
}) {
  const updateSection = useEditorStore((s) => s.updateSection);

  function switchToFree() {
    const updatedSlots = section.textSlots.map((s) =>
      s.id === slot.id ? { ...s, layoutMode: "free" as const } : s
    );
    updateSection(sectionId, { textSlots: updatedSlots });
  }

  return (
    <div className="relative group/slot">
      {/* Handle bar */}
      <div className="absolute -top-5 left-0 right-0 h-5 flex items-center justify-center gap-1 opacity-0 group-hover/slot:opacity-100 transition-opacity z-30">
        <div
          className="flex items-center gap-0.5 bg-card border border-border rounded px-2 py-0.5 cursor-grab active:cursor-grabbing shadow-sm"
          onMouseDown={(e) => { e.preventDefault(); switchToFree(); }}
          title="드래그하여 자유 배치로 전환"
        >
          <GripVertical className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground select-none">{slot.role}</span>
        </div>
      </div>

      <div className="group-hover/slot:outline group-hover/slot:outline-1 group-hover/slot:outline-blue-300 rounded">
        <TextEditor sectionId={sectionId} slot={slot} />
      </div>

      {showDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity z-30"
          title="텍스트 삭제"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function DraggableTextSlot({
  sectionId,
  section,
  slot,
  showDelete,
  onDelete,
}: {
  sectionId: string;
  section: CanvasSection;
  slot: CanvasSection["textSlots"][number];
  showDelete: boolean;
  onDelete: () => void;
}) {
  const updateSection = useEditorStore((s) => s.updateSection);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).isContentEditable) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: slot.position.x, origY: slot.position.y };

    function onMouseMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const updatedSlots = section.textSlots.map((s) =>
        s.id === slot.id
          ? { ...s, position: { x: dragRef.current!.origX + dx, y: dragRef.current!.origY + dy } }
          : s
      );
      updateSection(sectionId, { textSlots: updatedSlots });
    }
    function onMouseUp() {
      setIsDragging(false);
      dragRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div
      className={cn(
        "absolute z-10 group/slot",
        isDragging && "opacity-80"
      )}
      style={{
        left: slot.position.x,
        top: slot.position.y,
        width: slot.size.width,
        minHeight: slot.size.height,
        height: "auto",
      }}
    >
      {/* Drag handle bar — visible on hover */}
      <div
        className={cn(
          "absolute -top-5 left-0 right-0 h-5 flex items-center justify-center gap-1 opacity-0 group-hover/slot:opacity-100 transition-opacity z-30",
          isDragging && "opacity-100"
        )}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-1 bg-card border border-border rounded px-2 py-0.5 cursor-grab active:cursor-grabbing shadow-sm">
          <GripVertical className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground select-none">{slot.role}</span>
          <button
            className="text-[10px] text-blue-500 hover:text-blue-700 ml-1"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const updatedSlots = section.textSlots.map((s) =>
                s.id === slot.id ? { ...s, layoutMode: "auto" as const } : s
              );
              updateSection(sectionId, { textSlots: updatedSlots });
            }}
            title="오토레이아웃으로 되돌리기"
          >
            auto
          </button>
        </div>
      </div>

      {/* Hover border indicator */}
      <div className="absolute inset-0 border border-transparent group-hover/slot:border-blue-300 rounded pointer-events-none transition-colors" />

      <TextEditor sectionId={sectionId} slot={slot} />
      {showDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity z-30"
          title="텍스트 삭제"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function ImageSlot({
  sectionId,
  slot,
  showControls,
  onDelete,
}: {
  sectionId: string;
  slot: CanvasSection["imageSlots"][number];
  showControls: boolean;
  onDelete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const updateImageSlot = useEditorStore((s) => s.updateImageSlot);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateImageSlot(sectionId, slot.id, reader.result as string, "local");
    };
    reader.readAsDataURL(file);
  }

  return (
    <div
      className={cn(
        "absolute z-0 flex items-center justify-center rounded group/img",
        !slot.imageUrl && "border-2 border-dashed border-border bg-muted/30"
      )}
      style={{
        left: slot.position.x,
        top: slot.position.y,
        width: slot.size.width,
        height: slot.size.height,
      }}
    >
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {slot.imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slot.imageUrl} alt={slot.purpose} className="w-full h-full object-cover" />
          {/* Upload button — only way to change image, no accidental clicks */}
          {showControls && (
            <div className="absolute bottom-2 right-2 z-10 flex gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                title="이미지 변경"
              >
                <ImagePlus className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="w-8 h-8 rounded-full bg-destructive/80 text-white flex items-center justify-center hover:bg-destructive"
                title="이미지 슬롯 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div
          className="flex flex-col items-center gap-2 cursor-pointer hover:bg-muted/50 w-full h-full justify-center transition-colors"
          onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
        >
          <ImagePlus className="w-6 h-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground text-center px-2">{slot.purpose}</span>
        </div>
      )}
    </div>
  );
}
