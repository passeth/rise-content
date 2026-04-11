"use client";

import { useCallback } from "react";
import { useDrop } from "react-dnd";
import { v4 as uuidv4 } from "uuid";
import { useEditorStore } from "@/lib/store/editor-store";
import { createClient } from "@/lib/supabase/client";
import { Section } from "./Section";
import type { BrandComponent } from "@/lib/types/brand";
import type { CanvasSection } from "@/lib/types/editor";

interface CanvasProps {
  brandId: string;
}

interface DragItem {
  componentId: string;
}

function CanvasDropArea({ brandId }: CanvasProps) {
  const sections = useEditorStore((s) => s.sections);
  const addSection = useEditorStore((s) => s.addSection);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const zoom = useEditorStore((s) => s.zoom);

  const handleDrop = useCallback(
    async (item: DragItem) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("components")
        .select("*")
        .eq("id", item.componentId)
        .single();

      if (error || !data) return;

      const raw = data as Record<string, unknown>;
      const textSlots = (typeof raw.text_slots === "string" ? JSON.parse(raw.text_slots) : raw.text_slots ?? []) as BrandComponent["textSlots"];
      const imageSlots = (typeof raw.image_slots === "string" ? JSON.parse(raw.image_slots) : raw.image_slots ?? []) as BrandComponent["imageSlots"];
      const templateData = (typeof raw.template_data === "string" ? JSON.parse(raw.template_data) : raw.template_data ?? {}) as Record<string, unknown>;

      const maxOrder = sections.reduce(
        (max, s) => (s.order > max ? s.order : max),
        -1
      );

      const sectionWidth = (templateData.width as number) ?? imageSlots[0]?.width ?? 860;
      const sectionHeight = (templateData.height as number) ??
        Math.max(
          ...textSlots.map((s) => s.y + s.height),
          ...imageSlots.map((s) => s.y + s.height),
          400
        );

      const newSection: CanvasSection = {
        id: uuidv4(),
        componentId: raw.id as string,
        position: { x: 0, y: maxOrder >= 0 ? (maxOrder + 1) * 200 : 0 },
        size: {
          width: sectionWidth,
          height: sectionHeight,
        },
        textSlots: textSlots.map((t) => ({
          id: uuidv4(),
          role: t.role,
          content: t.sampleText ?? "",
          position: { x: t.x, y: t.y },
          size: { width: t.width, height: t.height },
          fontSize: t.fontSize,
          fontWeight: t.fontWeight,
          maxLength: t.maxLength,
        })),
        imageSlots: imageSlots.map((img) => ({
          id: uuidv4(),
          purpose: img.purpose,
          position: { x: img.x, y: img.y },
          size: { width: img.width, height: img.height },
        })),
        order: maxOrder + 1,
      };

      addSection(newSection);
    },
    [sections, addSection]
  );

  const [{ isOver, canDrop }, dropRef] = useDrop<
    DragItem,
    void,
    { isOver: boolean; canDrop: boolean }
  >({
    accept: "COMPONENT",
    drop: (item) => {
      void handleDrop(item);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  return (
    <div
      className="flex-1 overflow-auto bg-muted/30"
      onClick={() => clearSelection()}
    >
      <div
        className="mx-auto py-8 px-8"
        style={{ width: "100%", minHeight: "100%" }}
      >
        <div
          ref={dropRef as unknown as React.RefObject<HTMLDivElement>}
          className="mx-auto bg-background rounded-lg border border-border shadow-sm relative"
          style={{
            maxWidth: 860,
            minHeight: 600,
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {isOver && canDrop && (
            <div className="absolute inset-0 border-2 border-dashed border-blue-400 rounded-lg bg-blue-50/30 z-50 pointer-events-none flex items-center justify-center">
              <span className="text-blue-500 text-sm font-medium">
                여기에 놓으세요
              </span>
            </div>
          )}

          {sortedSections.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[400px] text-muted-foreground text-sm">
              컴포넌트를 드래그하여 상세페이지를 구성하세요
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-4 pl-10">
              {sortedSections.map((section, index) => (
                <Section key={section.id} section={section} index={index} total={sortedSections.length} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Canvas({ brandId }: CanvasProps) {
  return <CanvasDropArea brandId={brandId} />;
}
