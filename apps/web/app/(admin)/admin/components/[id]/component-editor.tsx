"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { TextSlotTemplate, ImageSlotTemplate, TextSlotStyle } from "@/lib/types/brand";
import type { ComponentCategory, LayoutType } from "@/lib/types/brand";
import type { TextRole } from "@/lib/types/editor";

interface ComponentRow {
  id: string;
  name: string;
  category: ComponentCategory;
  layout_type: LayoutType | null;
  figma_file_key: string | null;
  figma_node_id: string | null;
  version: number;
  thumbnail_url: string | null;
  brand_id: string;
  template_data: Record<string, unknown> | null;
  text_slots: TextSlotTemplate[] | null;
  image_slots: ImageSlotTemplate[] | null;
  created_at: string;
  updated_at: string;
}

interface ComponentEditorProps {
  component: ComponentRow;
  brandName: string;
}

// ---- Slot selection type ----
type SelectedSlot =
  | { type: "text"; id: string }
  | { type: "image"; id: string }
  | null;

// ---- Constants ----
const CATEGORY_OPTIONS: { value: ComponentCategory; label: string }[] = [
  { value: "hero", label: "Hero" },
  { value: "benefit", label: "Benefit" },
  { value: "ingredient", label: "Ingredient" },
  { value: "review", label: "Review" },
  { value: "cta", label: "CTA" },
  { value: "usage", label: "Usage" },
  { value: "routine", label: "Routine" },
];

const LAYOUT_OPTIONS: { value: LayoutType; label: string }[] = [
  { value: "1-col", label: "1단" },
  { value: "2-col", label: "2단" },
  { value: "3-col", label: "3단" },
];

const TEXT_ROLE_OPTIONS: { value: TextRole; label: string }[] = [
  { value: "headline", label: "headline" },
  { value: "subheadline", label: "subheadline" },
  { value: "body", label: "body" },
  { value: "caption", label: "caption" },
  { value: "cta", label: "cta" },
];

const FONT_WEIGHT_OPTIONS = [200, 300, 400, 500, 600, 700];

const TEXT_ALIGN_OPTIONS: { value: "left" | "center" | "right"; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const ROLE_BADGE_COLORS: Record<TextRole, string> = {
  headline: "bg-purple-100 text-purple-700",
  subheadline: "bg-blue-100 text-blue-700",
  body: "bg-gray-100 text-gray-700",
  caption: "bg-yellow-100 text-yellow-700",
  cta: "bg-green-100 text-green-700",
};

// ---- Utilities ----
function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// ---- Style helpers ----
const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

const smallInputCls =
  "w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring";

const selectCls =
  "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

const smallSelectCls =
  "w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring";

function Label({ text }: { text: string }) {
  return (
    <span className="block text-xs font-medium text-muted-foreground mb-1">
      {text}
    </span>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border pb-4 mb-4 last:border-b-0 last:pb-0 last:mb-0">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ---- Main component ----
export function ComponentEditor({ component, brandName }: ComponentEditorProps) {
  const router = useRouter();

  // Basic info
  const [name, setName] = useState(component.name);
  const [category, setCategory] = useState<ComponentCategory>(component.category);
  const [layoutType, setLayoutType] = useState<LayoutType>(
    component.layout_type ?? "1-col"
  );

  // Template data dimensions
  const templateData = component.template_data ?? {};
  const [width, setWidth] = useState<number>(
    typeof templateData.width === "number" ? templateData.width : 375
  );
  const [height, setHeight] = useState<number>(
    typeof templateData.height === "number" ? templateData.height : 400
  );

  // Slots
  const [textSlots, setTextSlots] = useState<TextSlotTemplate[]>(
    component.text_slots ?? []
  );
  const [imageSlots, setImageSlots] = useState<ImageSlotTemplate[]>(
    component.image_slots ?? []
  );

  // UI state
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot>(null);
  const [expandedStyle, setExpandedStyle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Canvas scale: fit within 500px wide
  const CANVAS_MAX_WIDTH = 500;
  const scale = Math.min(1, CANVAS_MAX_WIDTH / width);

  // ---- Text slot helpers ----
  const updateTextSlot = useCallback(
    <K extends keyof TextSlotTemplate>(id: string, key: K, value: TextSlotTemplate[K]) => {
      setTextSlots((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [key]: value } : s))
      );
    },
    []
  );

  const updateTextSlotStyle = useCallback(
    <K extends keyof TextSlotStyle>(id: string, key: K, value: TextSlotStyle[K]) => {
      setTextSlots((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, style: { ...s.style, [key]: value } } : s
        )
      );
    },
    []
  );

  function addTextSlot() {
    const id = generateId();
    setTextSlots((prev) => [
      ...prev,
      {
        id,
        role: "body" as TextRole,
        x: Math.round(width / 2 - 100),
        y: Math.round(height / 2 - 30),
        width: 200,
        height: 60,
        fontSize: 16,
        fontWeight: 400,
        sampleText: "텍스트",
      },
    ]);
    setSelectedSlot({ type: "text", id });
  }

  function removeTextSlot(id: string) {
    setTextSlots((prev) => prev.filter((s) => s.id !== id));
    if (selectedSlot?.type === "text" && selectedSlot.id === id) {
      setSelectedSlot(null);
    }
  }

  // ---- Image slot helpers ----
  const updateImageSlot = useCallback(
    <K extends keyof ImageSlotTemplate>(id: string, key: K, value: ImageSlotTemplate[K]) => {
      setImageSlots((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [key]: value } : s))
      );
    },
    []
  );

  function addImageSlot() {
    const id = generateId();
    setImageSlots((prev) => [
      ...prev,
      {
        id,
        x: Math.round(width / 2 - 100),
        y: Math.round(height / 2 - 100),
        width: 200,
        height: 200,
        purpose: "",
      },
    ]);
    setSelectedSlot({ type: "image", id });
  }

  function removeImageSlot(id: string) {
    setImageSlots((prev) => prev.filter((s) => s.id !== id));
    if (selectedSlot?.type === "image" && selectedSlot.id === id) {
      setSelectedSlot(null);
    }
  }

  // ---- Save ----
  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const updatedTemplateData: Record<string, unknown> = {
        ...templateData,
        width,
        height,
      };

      const res = await fetch("/api/admin/components", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: component.id,
          name,
          category,
          layout_type: layoutType,
          template_data: updatedTemplateData,
          text_slots: textSlots,
          image_slots: imageSlots,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setSaveError(data.error ?? "저장에 실패했습니다.");
        return;
      }

      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  // ---- Delete ----
  async function handleDelete() {
    if (
      !confirm(
        `"${name}" 컴포넌트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/components?id=${component.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error ?? "삭제에 실패했습니다.");
        return;
      }

      router.push("/admin/components");
    } finally {
      setDeleting(false);
    }
  }

  // Resolve current selected slot data
  const selectedTextSlot =
    selectedSlot?.type === "text"
      ? textSlots.find((s) => s.id === selectedSlot.id) ?? null
      : null;

  const selectedImageSlot =
    selectedSlot?.type === "image"
      ? imageSlots.find((s) => s.id === selectedSlot.id) ?? null
      : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
        <div>
          <p className="text-sm text-muted-foreground mb-0.5">
            <span className="font-medium text-foreground">{brandName}</span>
            {" / "}컴포넌트 편집
          </p>
          <h1 className="text-xl font-semibold text-foreground">{component.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/components"
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            목록으로
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md border border-destructive px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            {deleting ? "삭제 중..." : "삭제"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive mb-4">
          {saveError}
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex gap-6 flex-1 min-h-0">
        {/* ── LEFT: Visual Canvas (60%) ── */}
        <div className="flex-[3] flex flex-col min-w-0">
          <div
            className="flex-1 rounded-lg border border-border overflow-auto p-4"
            style={{
              background:
                "repeating-conic-gradient(#e5e7eb 0% 25%, #f9fafb 0% 50%) 0 0 / 16px 16px",
            }}
            onClick={() => setSelectedSlot(null)}
          >
            {/* Canvas container — scaled */}
            <div
              className="relative mx-auto bg-white shadow-md"
              style={{
                width: width * scale,
                height: height * scale,
                transformOrigin: "top left",
              }}
            >
              {/* Image slots — behind text */}
              {imageSlots.map((slot) => (
                <CanvasImageSlot
                  key={slot.id}
                  slot={slot}
                  scale={scale}
                  isSelected={selectedSlot?.type === "image" && selectedSlot.id === slot.id}
                  onSelect={() => setSelectedSlot({ type: "image", id: slot.id })}
                  onDelete={() => removeImageSlot(slot.id)}
                  onUpdate={updateImageSlot}
                />
              ))}

              {/* Text slots */}
              {textSlots.map((slot) => (
                <CanvasTextSlot
                  key={slot.id}
                  slot={slot}
                  scale={scale}
                  isSelected={selectedSlot?.type === "text" && selectedSlot.id === slot.id}
                  onSelect={() => setSelectedSlot({ type: "text", id: slot.id })}
                  onDelete={() => removeTextSlot(slot.id)}
                  onUpdate={updateTextSlot}
                  canvasWidth={width}
                  canvasHeight={height}
                />
              ))}

              {/* Height resize handle */}
              <CanvasResizeHandle
                scale={scale}
                height={height}
                onHeightChange={(newHeight) => {
                  const ratio = newHeight / height;
                  setHeight(newHeight);
                  setTextSlots((prev) =>
                    prev.map((s) => ({ ...s, y: Math.round(s.y * ratio) }))
                  );
                  setImageSlots((prev) =>
                    prev.map((s) => ({
                      ...s,
                      y: Math.round(s.y * ratio),
                      height: Math.round(s.height * ratio),
                    }))
                  );
                }}
              />
            </div>
          </div>

          {/* Add slot buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={addTextSlot}
              className="flex-1 rounded-md border border-dashed border-border py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              + 텍스트 추가
            </button>
            <button
              onClick={addImageSlot}
              className="flex-1 rounded-md border border-dashed border-border py-2 text-sm text-muted-foreground hover:border-emerald-500 hover:text-emerald-600 transition-colors"
            >
              + 이미지 추가
            </button>
          </div>

          {/* Canvas size indicator */}
          <p className="text-xs text-muted-foreground text-center mt-2">
            {width} × {height}px
            {scale < 1 && ` (${Math.round(scale * 100)}% 축소)`}
          </p>
        </div>

        {/* ── RIGHT: Property Panel (40%) ── */}
        <div className="flex-[2] overflow-y-auto space-y-0 min-w-0 max-h-[calc(100vh-10rem)]">
          <div className="rounded-lg border border-border bg-card p-4 space-y-0">
            {/* Section 1: 기본 정보 */}
            <PanelSection title="기본 정보">
              <div className="space-y-3">
                <div>
                  <Label text="이름" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label text="카테고리" />
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ComponentCategory)}
                      className={selectCls}
                    >
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label text="레이아웃" />
                    <select
                      value={layoutType}
                      onChange={(e) => setLayoutType(e.target.value as LayoutType)}
                      className={selectCls}
                    >
                      {LAYOUT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label text="캔버스 크기" />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(Number(e.target.value))}
                      className={`${smallInputCls} flex-1`}
                      placeholder="가로"
                    />
                    <span className="text-xs text-muted-foreground">×</span>
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                      className={`${smallInputCls} flex-1`}
                      placeholder="세로"
                    />
                    <span className="text-xs text-muted-foreground">px</span>
                  </div>
                </div>
              </div>
            </PanelSection>

            {/* Section 2: Selected slot properties */}
            {selectedTextSlot && (
              <PanelSection title="텍스트 슬롯 속성">
                <TextSlotPanel
                  slot={selectedTextSlot}
                  expandedStyle={expandedStyle}
                  onToggleStyle={() => setExpandedStyle((v) => !v)}
                  onUpdate={updateTextSlot}
                  onUpdateStyle={updateTextSlotStyle}
                />
              </PanelSection>
            )}

            {selectedImageSlot && (
              <PanelSection title="이미지 슬롯 속성">
                <ImageSlotPanel
                  slot={selectedImageSlot}
                  onUpdate={updateImageSlot}
                />
              </PanelSection>
            )}

            {!selectedSlot && (
              <PanelSection title="슬롯 속성">
                <p className="text-xs text-muted-foreground">
                  캔버스에서 슬롯을 클릭하면 속성이 표시됩니다.
                </p>
              </PanelSection>
            )}

            {/* Section 3: Slot list */}
            <PanelSection title="슬롯 목록">
              {textSlots.length === 0 && imageSlots.length === 0 && (
                <p className="text-xs text-muted-foreground">슬롯이 없습니다.</p>
              )}
              {textSlots.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    텍스트 ({textSlots.length})
                  </p>
                  <div className="space-y-1">
                    {textSlots.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlot({ type: "text", id: slot.id })}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                          selectedSlot?.type === "text" && selectedSlot.id === slot.id
                            ? "bg-blue-50 border border-blue-300"
                            : "hover:bg-muted border border-transparent"
                        }`}
                      >
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            ROLE_BADGE_COLORS[slot.role]
                          }`}
                        >
                          {slot.role}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {slot.sampleText || "(빈 텍스트)"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {imageSlots.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    이미지 ({imageSlots.length})
                  </p>
                  <div className="space-y-1">
                    {imageSlots.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlot({ type: "image", id: slot.id })}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                          selectedSlot?.type === "image" && selectedSlot.id === slot.id
                            ? "bg-emerald-50 border border-emerald-300"
                            : "hover:bg-muted border border-transparent"
                        }`}
                      >
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">
                          img
                        </span>
                        <span className="truncate text-muted-foreground">
                          {slot.purpose || "(용도 없음)"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </PanelSection>

            {/* Section 4: Actions */}
            <PanelSection title="저장 / 삭제">
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full rounded-md border border-destructive py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  {deleting ? "삭제 중..." : "삭제"}
                </button>
                <Link
                  href="/admin/components"
                  className="block w-full text-center rounded-md border border-border py-2 text-sm hover:bg-muted"
                >
                  목록으로
                </Link>
                {saveError && (
                  <p className="text-xs text-destructive">{saveError}</p>
                )}
              </div>
            </PanelSection>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// Canvas: Text Slot
// ──────────────────────────────────────────
function CanvasTextSlot({
  slot,
  scale,
  isSelected,
  onSelect,
  onDelete,
  onUpdate,
  canvasWidth,
  canvasHeight,
}: {
  slot: TextSlotTemplate;
  scale: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdate: <K extends keyof TextSlotTemplate>(id: string, key: K, value: TextSlotTemplate[K]) => void;
  canvasWidth: number;
  canvasHeight: number;
}) {
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  function handleGripMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: slot.x,
      origY: slot.y,
    };

    function onMouseMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const dx = (ev.clientX - dragRef.current.startX) / scale;
      const dy = (ev.clientY - dragRef.current.startY) / scale;
      const newX = Math.round(
        Math.max(0, Math.min(canvasWidth - slot.width, dragRef.current.origX + dx))
      );
      const newY = Math.round(
        Math.max(0, Math.min(canvasHeight - slot.height, dragRef.current.origY + dy))
      );
      onUpdate(slot.id, "x", newX);
      onUpdate(slot.id, "y", newY);
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

  function handleContentBlur() {
    const el = contentRef.current;
    if (!el) return;
    const text = el.innerText;
    onUpdate(slot.id, "sampleText", text);
  }

  function handleContentKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      contentRef.current?.blur();
    }
  }

  const s = slot.style;
  const showControls = isHovered || isSelected;

  return (
    <div
      className={`absolute group/ts ${isDragging ? "opacity-80" : ""}`}
      style={{
        left: slot.x * scale,
        top: slot.y * scale,
        width: slot.width * scale,
        minHeight: slot.height * scale,
        zIndex: isSelected ? 20 : 10,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Drag handle bar */}
      {showControls && (
        <div
          className="absolute -top-5 left-0 right-0 h-5 flex items-center justify-center gap-1 z-30"
          style={{ pointerEvents: "none" }}
        >
          <div
            className="flex items-center gap-0.5 bg-card border border-border rounded px-1.5 py-0.5 cursor-grab active:cursor-grabbing shadow-sm"
            style={{ pointerEvents: "all" }}
            onMouseDown={handleGripMouseDown}
          >
            <svg
              className="w-3 h-3 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="9" cy="5" r="1" fill="currentColor" />
              <circle cx="9" cy="12" r="1" fill="currentColor" />
              <circle cx="9" cy="19" r="1" fill="currentColor" />
              <circle cx="15" cy="5" r="1" fill="currentColor" />
              <circle cx="15" cy="12" r="1" fill="currentColor" />
              <circle cx="15" cy="19" r="1" fill="currentColor" />
            </svg>
            <span
              className={`text-[9px] font-medium px-1 rounded ${ROLE_BADGE_COLORS[slot.role]}`}
            >
              {slot.role}
            </span>
          </div>
        </div>
      )}

      {/* Selection / hover border */}
      <div
        className={`absolute inset-0 rounded pointer-events-none transition-colors ${
          isSelected
            ? "ring-2 ring-blue-500"
            : isHovered
            ? "ring-1 ring-blue-300"
            : ""
        }`}
      />

      {/* Editable text content */}
      <div
        ref={contentRef}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleContentBlur}
        onKeyDown={handleContentKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="outline-none w-full h-full cursor-text whitespace-pre-wrap break-words"
        style={{
          fontSize: slot.fontSize * scale,
          fontWeight: slot.fontWeight,
          lineHeight: s?.lineHeight ?? 1.4,
          color: s?.textColor ?? "#1a1a1a",
          backgroundColor: s?.backgroundColor ?? "transparent",
          padding: s?.padding
            ? s.padding
                .split(" ")
                .map((v) => {
                  const n = parseFloat(v);
                  const unit = v.replace(/[\d.]/g, "");
                  return isNaN(n) ? v : `${n * scale}${unit}`;
                })
                .join(" ")
            : `${4 * scale}px`,
          borderRadius: s?.borderRadius ?? "0",
          border: s?.border ?? "none",
          textAlign: s?.textAlign ?? "left",
          letterSpacing: s?.letterSpacing ?? "normal",
        }}
        dangerouslySetInnerHTML={{ __html: slot.sampleText ?? slot.role }}
      />

      {/* Delete button */}
      {showControls && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center z-30 hover:bg-destructive/80"
          title="삭제"
        >
          <svg
            className="w-2.5 h-2.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// Canvas: Image Slot
// ──────────────────────────────────────────
function CanvasImageSlot({
  slot,
  scale,
  isSelected,
  onSelect,
  onDelete,
  onUpdate,
}: {
  slot: ImageSlotTemplate;
  scale: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdate: <K extends keyof ImageSlotTemplate>(id: string, key: K, value: ImageSlotTemplate[K]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  const showControls = isHovered || isSelected;

  return (
    <div
      className={`absolute group/img ${
        !previewUrl ? "border-2 border-dashed border-emerald-400 bg-emerald-50/40" : ""
      }`}
      style={{
        left: slot.x * scale,
        top: slot.y * scale,
        width: slot.width * scale,
        height: slot.height * scale,
        zIndex: isSelected ? 15 : 5,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Selection border */}
      {isSelected && (
        <div className="absolute inset-0 ring-2 ring-emerald-500 pointer-events-none rounded z-10" />
      )}

      {previewUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={slot.purpose}
            className="w-full h-full object-cover"
          />
          {showControls && (
            <div className="absolute bottom-1 right-1 z-10 flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fileRef.current?.click();
                }}
                className="w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                title="이미지 변경"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>
          )}
        </>
      ) : (
        <div
          className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-emerald-50/80 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
            fileRef.current?.click();
          }}
        >
          <svg
            className="w-5 h-5 text-emerald-500 mb-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span
            className="text-emerald-600 text-center px-1 truncate"
            style={{ fontSize: Math.max(9, 11 * scale) }}
          >
            {slot.purpose || "이미지"}
          </span>
        </div>
      )}

      {/* Delete button */}
      {showControls && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center z-20 hover:bg-destructive/80"
          title="삭제"
        >
          <svg
            className="w-2.5 h-2.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// Canvas: Height Resize Handle
// ──────────────────────────────────────────
function CanvasResizeHandle({
  scale,
  height,
  onHeightChange,
}: {
  scale: number;
  height: number;
  onHeightChange: (newHeight: number) => void;
}) {
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeRef.current = { startY: e.clientY, startHeight: height };

    function onMouseMove(ev: MouseEvent) {
      if (!resizeRef.current) return;
      const delta = (ev.clientY - resizeRef.current.startY) / scale;
      const newHeight = Math.max(100, Math.round(resizeRef.current.startHeight + delta));
      onHeightChange(newHeight);
    }

    function onMouseUp() {
      setIsResizing(false);
      resizeRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 flex items-center justify-center cursor-ns-resize z-30 transition-colors ${
        isResizing ? "bg-blue-500/30" : "bg-blue-500/10 hover:bg-blue-500/25"
      }`}
      style={{ height: Math.max(6, 10 * scale) }}
      onMouseDown={handleMouseDown}
    >
      <div
        className="rounded-full bg-blue-500"
        style={{ width: Math.max(16, 32 * scale), height: Math.max(2, 3 * scale) }}
      />
    </div>
  );
}

// ──────────────────────────────────────────
// Panel: Text Slot Properties
// ──────────────────────────────────────────
function TextSlotPanel({
  slot,
  expandedStyle,
  onToggleStyle,
  onUpdate,
  onUpdateStyle,
}: {
  slot: TextSlotTemplate;
  expandedStyle: boolean;
  onToggleStyle: () => void;
  onUpdate: <K extends keyof TextSlotTemplate>(id: string, key: K, value: TextSlotTemplate[K]) => void;
  onUpdateStyle: <K extends keyof TextSlotStyle>(id: string, key: K, value: TextSlotStyle[K]) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Role */}
      <div>
        <Label text="역할 (role)" />
        <select
          value={slot.role}
          onChange={(e) => onUpdate(slot.id, "role", e.target.value as TextRole)}
          className={selectCls}
        >
          {TEXT_ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Position */}
      <div>
        <Label text="위치" />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-muted-foreground">X</span>
            <input
              type="number"
              value={slot.x}
              onChange={(e) => onUpdate(slot.id, "x", Number(e.target.value))}
              className={smallInputCls}
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground">Y</span>
            <input
              type="number"
              value={slot.y}
              onChange={(e) => onUpdate(slot.id, "y", Number(e.target.value))}
              className={smallInputCls}
            />
          </div>
        </div>
      </div>

      {/* Size */}
      <div>
        <Label text="크기" />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-muted-foreground">너비</span>
            <input
              type="number"
              value={slot.width}
              onChange={(e) => onUpdate(slot.id, "width", Number(e.target.value))}
              className={smallInputCls}
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground">높이</span>
            <input
              type="number"
              value={slot.height}
              onChange={(e) => onUpdate(slot.id, "height", Number(e.target.value))}
              className={smallInputCls}
            />
          </div>
        </div>
      </div>

      {/* Font */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label text="폰트 크기" />
          <input
            type="number"
            value={slot.fontSize}
            onChange={(e) => onUpdate(slot.id, "fontSize", Number(e.target.value))}
            className={smallInputCls}
          />
        </div>
        <div>
          <Label text="굵기" />
          <select
            value={slot.fontWeight}
            onChange={(e) => onUpdate(slot.id, "fontWeight", Number(e.target.value))}
            className={smallSelectCls}
          >
            {FONT_WEIGHT_OPTIONS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label text="최대 글자" />
          <input
            type="number"
            value={slot.maxLength ?? ""}
            onChange={(e) =>
              onUpdate(
                slot.id,
                "maxLength",
                e.target.value === "" ? undefined : Number(e.target.value)
              )
            }
            placeholder="없음"
            className={smallInputCls}
          />
        </div>
      </div>

      {/* Sample text */}
      <div>
        <Label text="샘플 텍스트" />
        <textarea
          value={slot.sampleText ?? ""}
          onChange={(e) => onUpdate(slot.id, "sampleText", e.target.value)}
          rows={2}
          className={`${inputCls} resize-none`}
        />
      </div>

      {/* Style collapsible */}
      <div>
        <button
          type="button"
          onClick={onToggleStyle}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <span>{expandedStyle ? "▼" : "▶"}</span>
          스타일 {expandedStyle ? "접기" : "펼치기"}
        </button>

        {expandedStyle && (
          <div className="mt-2 space-y-2 p-3 rounded-md bg-muted/30 border border-border">
            {/* backgroundColor */}
            <div>
              <Label text="배경색" />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={slot.style?.backgroundColor ?? "#ffffff"}
                  onChange={(e) =>
                    onUpdateStyle(slot.id, "backgroundColor", e.target.value)
                  }
                  className="h-7 w-8 rounded border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={slot.style?.backgroundColor ?? ""}
                  onChange={(e) =>
                    onUpdateStyle(slot.id, "backgroundColor", e.target.value)
                  }
                  placeholder="#ffffff"
                  className={`${smallInputCls} flex-1`}
                />
              </div>
            </div>

            {/* textColor */}
            <div>
              <Label text="텍스트 색상" />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={slot.style?.textColor ?? "#000000"}
                  onChange={(e) =>
                    onUpdateStyle(slot.id, "textColor", e.target.value)
                  }
                  className="h-7 w-8 rounded border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={slot.style?.textColor ?? ""}
                  onChange={(e) =>
                    onUpdateStyle(slot.id, "textColor", e.target.value)
                  }
                  placeholder="#000000"
                  className={`${smallInputCls} flex-1`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* padding */}
              <div>
                <Label text="패딩" />
                <input
                  type="text"
                  value={slot.style?.padding ?? ""}
                  onChange={(e) => onUpdateStyle(slot.id, "padding", e.target.value)}
                  placeholder="15px 25px"
                  className={smallInputCls}
                />
              </div>

              {/* borderRadius */}
              <div>
                <Label text="Border Radius" />
                <input
                  type="text"
                  value={slot.style?.borderRadius ?? ""}
                  onChange={(e) =>
                    onUpdateStyle(slot.id, "borderRadius", e.target.value)
                  }
                  placeholder="50px"
                  className={smallInputCls}
                />
              </div>

              {/* border */}
              <div>
                <Label text="Border" />
                <input
                  type="text"
                  value={slot.style?.border ?? ""}
                  onChange={(e) => onUpdateStyle(slot.id, "border", e.target.value)}
                  placeholder="2px solid #000"
                  className={smallInputCls}
                />
              </div>

              {/* textAlign */}
              <div>
                <Label text="정렬" />
                <select
                  value={slot.style?.textAlign ?? "left"}
                  onChange={(e) =>
                    onUpdateStyle(
                      slot.id,
                      "textAlign",
                      e.target.value as "left" | "center" | "right"
                    )
                  }
                  className={smallSelectCls}
                >
                  {TEXT_ALIGN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* letterSpacing */}
              <div>
                <Label text="자간" />
                <input
                  type="text"
                  value={slot.style?.letterSpacing ?? ""}
                  onChange={(e) =>
                    onUpdateStyle(slot.id, "letterSpacing", e.target.value)
                  }
                  placeholder="-0.52px"
                  className={smallInputCls}
                />
              </div>

              {/* lineHeight */}
              <div>
                <Label text="행간" />
                <input
                  type="number"
                  value={slot.style?.lineHeight ?? ""}
                  onChange={(e) =>
                    onUpdateStyle(
                      slot.id,
                      "lineHeight",
                      e.target.value === "" ? undefined : Number(e.target.value)
                    )
                  }
                  placeholder="1.5"
                  step="0.1"
                  className={smallInputCls}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// Panel: Image Slot Properties
// ──────────────────────────────────────────
function ImageSlotPanel({
  slot,
  onUpdate,
}: {
  slot: ImageSlotTemplate;
  onUpdate: <K extends keyof ImageSlotTemplate>(id: string, key: K, value: ImageSlotTemplate[K]) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label text="용도 (purpose)" />
        <input
          type="text"
          value={slot.purpose}
          onChange={(e) => onUpdate(slot.id, "purpose", e.target.value)}
          placeholder="예: main-product, background"
          className={inputCls}
        />
      </div>

      {/* Position */}
      <div>
        <Label text="위치" />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-muted-foreground">X</span>
            <input
              type="number"
              value={slot.x}
              onChange={(e) => onUpdate(slot.id, "x", Number(e.target.value))}
              className={smallInputCls}
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground">Y</span>
            <input
              type="number"
              value={slot.y}
              onChange={(e) => onUpdate(slot.id, "y", Number(e.target.value))}
              className={smallInputCls}
            />
          </div>
        </div>
      </div>

      {/* Size */}
      <div>
        <Label text="크기" />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-muted-foreground">너비</span>
            <input
              type="number"
              value={slot.width}
              onChange={(e) => onUpdate(slot.id, "width", Number(e.target.value))}
              className={smallInputCls}
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground">높이</span>
            <input
              type="number"
              value={slot.height}
              onChange={(e) => onUpdate(slot.id, "height", Number(e.target.value))}
              className={smallInputCls}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
