"use client";

import { useState } from "react";
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

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function labelClass(text: string) {
  return (
    <span className="block text-xs font-medium text-muted-foreground mb-1">
      {text}
    </span>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

const smallInputCls =
  "w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring";

const selectCls =
  "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

const smallSelectCls =
  "w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring";

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
  const [width, setWidth] = useState<string>(
    String(typeof templateData.width === "number" ? templateData.width : "")
  );
  const [height, setHeight] = useState<string>(
    String(typeof templateData.height === "number" ? templateData.height : "")
  );

  // Slots
  const [textSlots, setTextSlots] = useState<TextSlotTemplate[]>(
    component.text_slots ?? []
  );
  const [imageSlots, setImageSlots] = useState<ImageSlotTemplate[]>(
    component.image_slots ?? []
  );

  // UI state
  const [expandedStyleSlots, setExpandedStyleSlots] = useState<
    Record<string, boolean>
  >({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // --- Text slot helpers ---
  function updateTextSlot<K extends keyof TextSlotTemplate>(
    index: number,
    key: K,
    value: TextSlotTemplate[K]
  ) {
    setTextSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function updateTextSlotStyle<K extends keyof TextSlotStyle>(
    index: number,
    key: K,
    value: TextSlotStyle[K]
  ) {
    setTextSlots((prev) => {
      const next = [...prev];
      const slot = { ...next[index] };
      slot.style = { ...slot.style, [key]: value };
      next[index] = slot;
      return next;
    });
  }

  function addTextSlot() {
    setTextSlots((prev) => [
      ...prev,
      {
        id: generateId(),
        role: "body",
        x: 0,
        y: 0,
        width: 200,
        height: 60,
        fontSize: 16,
        fontWeight: 400,
      },
    ]);
  }

  function removeTextSlot(index: number) {
    setTextSlots((prev) => prev.filter((_, i) => i !== index));
  }

  // --- Image slot helpers ---
  function updateImageSlot<K extends keyof ImageSlotTemplate>(
    index: number,
    key: K,
    value: ImageSlotTemplate[K]
  ) {
    setImageSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function addImageSlot() {
    setImageSlots((prev) => [
      ...prev,
      {
        id: generateId(),
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        purpose: "",
      },
    ]);
  }

  function removeImageSlot(index: number) {
    setImageSlots((prev) => prev.filter((_, i) => i !== index));
  }

  // --- Save ---
  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const updatedTemplateData: Record<string, unknown> = {
        ...templateData,
      };
      if (width !== "") updatedTemplateData.width = Number(width);
      if (height !== "") updatedTemplateData.height = Number(height);

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

  // --- Delete ---
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

  const canvasWidth = Number(width) || 375;
  const canvasHeight = Number(height) || 400;
  // Scale preview to fit within 500px wide
  const previewScale = Math.min(1, 500 / canvasWidth);

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            <span className="font-medium text-foreground">{brandName}</span>
            {" / "}컴포넌트 편집
          </p>
          <h1 className="text-2xl font-semibold text-foreground">{component.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/components"
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            목록으로
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md border border-destructive px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            {deleting ? "삭제 중..." : "삭제"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {saveError}
        </div>
      )}

      {/* 1. Basic Info */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-medium mb-5">기본 정보</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            {labelClass("이름")}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            {labelClass("카테고리")}
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
            {labelClass("레이아웃")}
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

          <div>
            {labelClass("버전")}
            <input
              type="text"
              value={String(component.version)}
              readOnly
              className={`${inputCls} bg-muted text-muted-foreground`}
            />
          </div>

          <div>
            {labelClass("Figma 파일 키")}
            <input
              type="text"
              value={component.figma_file_key ?? "—"}
              readOnly
              className={`${inputCls} bg-muted text-muted-foreground font-mono text-xs`}
            />
          </div>

          <div>
            {labelClass("Figma 노드 ID")}
            <input
              type="text"
              value={component.figma_node_id ?? "—"}
              readOnly
              className={`${inputCls} bg-muted text-muted-foreground font-mono text-xs`}
            />
          </div>
        </div>
      </section>

      {/* 2. Preview Area */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-medium mb-5">미리보기</h2>

        <div className="flex items-center gap-4 mb-4">
          <div>
            {labelClass("너비 (px)")}
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              className={`${inputCls} w-28`}
            />
          </div>
          <div>
            {labelClass("높이 (px)")}
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className={`${inputCls} w-28`}
            />
          </div>
          <div className="self-end pb-1">
            <span className="text-xs text-muted-foreground">
              {canvasWidth} × {canvasHeight}px
            </span>
          </div>
        </div>

        <div className="overflow-auto rounded-md border border-border bg-muted/20 p-4">
          <div
            className="relative bg-white border border-border/50 mx-auto"
            style={{
              width: canvasWidth * previewScale,
              height: canvasHeight * previewScale,
            }}
          >
            {/* Text slots */}
            {textSlots.map((slot) => (
              <div
                key={slot.id}
                className="absolute border border-blue-400/60 bg-blue-50/40 flex items-center justify-center overflow-hidden"
                style={{
                  left: slot.x * previewScale,
                  top: slot.y * previewScale,
                  width: slot.width * previewScale,
                  height: slot.height * previewScale,
                  backgroundColor: slot.style?.backgroundColor
                    ? slot.style.backgroundColor + "33"
                    : undefined,
                }}
                title={`${slot.role}: ${slot.sampleText ?? ""}`}
              >
                <span
                  className="truncate px-1 text-center"
                  style={{ fontSize: Math.max(8, slot.fontSize * previewScale) }}
                >
                  {slot.sampleText || slot.role}
                </span>
              </div>
            ))}

            {/* Image slots */}
            {imageSlots.map((slot) => (
              <div
                key={slot.id}
                className="absolute border border-emerald-400/60 bg-emerald-50/40 flex items-center justify-center"
                style={{
                  left: slot.x * previewScale,
                  top: slot.y * previewScale,
                  width: slot.width * previewScale,
                  height: slot.height * previewScale,
                }}
                title={slot.purpose}
              >
                <span className="text-[9px] text-emerald-600 text-center px-1 truncate">
                  {slot.purpose || "image"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 border border-blue-400 bg-blue-50 rounded-sm" />
            텍스트 슬롯
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 border border-emerald-400 bg-emerald-50 rounded-sm" />
            이미지 슬롯
          </span>
        </div>
      </section>

      {/* 3. Text Slots Editor */}
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-medium">
            텍스트 슬롯{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({textSlots.length})
            </span>
          </h2>
        </div>

        {textSlots.length === 0 && (
          <p className="text-sm text-muted-foreground mb-4">
            텍스트 슬롯이 없습니다.
          </p>
        )}

        <div className="space-y-4">
          {textSlots.map((slot, index) => (
            <div
              key={slot.id}
              className="rounded-md border border-border bg-background p-4 space-y-4"
            >
              {/* Header row */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">
                  #{index + 1} {slot.id}
                </span>
                <button
                  onClick={() => removeTextSlot(index)}
                  className="rounded px-2 py-0.5 text-xs border border-destructive text-destructive hover:bg-destructive/10"
                >
                  X 삭제
                </button>
              </div>

              {/* Role + sampleText */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  {labelClass("역할 (role)")}
                  <select
                    value={slot.role}
                    onChange={(e) =>
                      updateTextSlot(index, "role", e.target.value as TextRole)
                    }
                    className={selectCls}
                  >
                    {TEXT_ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  {labelClass("샘플 텍스트")}
                  <textarea
                    value={slot.sampleText ?? ""}
                    onChange={(e) =>
                      updateTextSlot(index, "sampleText", e.target.value)
                    }
                    rows={2}
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </div>

              {/* Position */}
              <div>
                {labelClass("위치 (position)")}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">X</span>
                    <input
                      type="number"
                      value={slot.x}
                      onChange={(e) =>
                        updateTextSlot(index, "x", Number(e.target.value))
                      }
                      className={smallInputCls}
                    />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Y</span>
                    <input
                      type="number"
                      value={slot.y}
                      onChange={(e) =>
                        updateTextSlot(index, "y", Number(e.target.value))
                      }
                      className={smallInputCls}
                    />
                  </div>
                </div>
              </div>

              {/* Size */}
              <div>
                {labelClass("크기 (size)")}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">너비</span>
                    <input
                      type="number"
                      value={slot.width}
                      onChange={(e) =>
                        updateTextSlot(index, "width", Number(e.target.value))
                      }
                      className={smallInputCls}
                    />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">높이</span>
                    <input
                      type="number"
                      value={slot.height}
                      onChange={(e) =>
                        updateTextSlot(index, "height", Number(e.target.value))
                      }
                      className={smallInputCls}
                    />
                  </div>
                </div>
              </div>

              {/* Font */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  {labelClass("폰트 크기")}
                  <input
                    type="number"
                    value={slot.fontSize}
                    onChange={(e) =>
                      updateTextSlot(index, "fontSize", Number(e.target.value))
                    }
                    className={smallInputCls}
                  />
                </div>
                <div>
                  {labelClass("폰트 굵기")}
                  <select
                    value={slot.fontWeight}
                    onChange={(e) =>
                      updateTextSlot(index, "fontWeight", Number(e.target.value))
                    }
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
                  {labelClass("최대 글자 수")}
                  <input
                    type="number"
                    value={slot.maxLength ?? ""}
                    onChange={(e) =>
                      updateTextSlot(
                        index,
                        "maxLength",
                        e.target.value === "" ? undefined : Number(e.target.value)
                      )
                    }
                    placeholder="없음"
                    className={smallInputCls}
                  />
                </div>
              </div>

              {/* Style expandable */}
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedStyleSlots((prev) => ({
                      ...prev,
                      [slot.id]: !prev[slot.id],
                    }))
                  }
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <span>{expandedStyleSlots[slot.id] ? "▼" : "▶"}</span>
                  스타일 {expandedStyleSlots[slot.id] ? "접기" : "펼치기"}
                </button>

                {expandedStyleSlots[slot.id] && (
                  <div className="mt-3 grid grid-cols-2 gap-3 p-3 rounded-md bg-muted/30 border border-border">
                    {/* backgroundColor */}
                    <div className="col-span-2">
                      {labelClass("배경색")}
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={slot.style?.backgroundColor ?? "#ffffff"}
                          onChange={(e) =>
                            updateTextSlotStyle(
                              index,
                              "backgroundColor",
                              e.target.value
                            )
                          }
                          className="h-8 w-10 rounded border border-border cursor-pointer"
                        />
                        <input
                          type="text"
                          value={slot.style?.backgroundColor ?? ""}
                          onChange={(e) =>
                            updateTextSlotStyle(
                              index,
                              "backgroundColor",
                              e.target.value
                            )
                          }
                          placeholder="#ffffff"
                          className={`${smallInputCls} flex-1`}
                        />
                      </div>
                    </div>

                    {/* textColor */}
                    <div className="col-span-2">
                      {labelClass("텍스트 색상")}
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={slot.style?.textColor ?? "#000000"}
                          onChange={(e) =>
                            updateTextSlotStyle(index, "textColor", e.target.value)
                          }
                          className="h-8 w-10 rounded border border-border cursor-pointer"
                        />
                        <input
                          type="text"
                          value={slot.style?.textColor ?? ""}
                          onChange={(e) =>
                            updateTextSlotStyle(index, "textColor", e.target.value)
                          }
                          placeholder="#000000"
                          className={`${smallInputCls} flex-1`}
                        />
                      </div>
                    </div>

                    {/* padding */}
                    <div>
                      {labelClass("패딩")}
                      <input
                        type="text"
                        value={slot.style?.padding ?? ""}
                        onChange={(e) =>
                          updateTextSlotStyle(index, "padding", e.target.value)
                        }
                        placeholder="15px 25px"
                        className={smallInputCls}
                      />
                    </div>

                    {/* borderRadius */}
                    <div>
                      {labelClass("Border Radius")}
                      <input
                        type="text"
                        value={slot.style?.borderRadius ?? ""}
                        onChange={(e) =>
                          updateTextSlotStyle(
                            index,
                            "borderRadius",
                            e.target.value
                          )
                        }
                        placeholder="50px"
                        className={smallInputCls}
                      />
                    </div>

                    {/* border */}
                    <div>
                      {labelClass("Border")}
                      <input
                        type="text"
                        value={slot.style?.border ?? ""}
                        onChange={(e) =>
                          updateTextSlotStyle(index, "border", e.target.value)
                        }
                        placeholder="2px solid #4b1f7e"
                        className={smallInputCls}
                      />
                    </div>

                    {/* textAlign */}
                    <div>
                      {labelClass("텍스트 정렬")}
                      <select
                        value={slot.style?.textAlign ?? "left"}
                        onChange={(e) =>
                          updateTextSlotStyle(
                            index,
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
                      {labelClass("자간 (letterSpacing)")}
                      <input
                        type="text"
                        value={slot.style?.letterSpacing ?? ""}
                        onChange={(e) =>
                          updateTextSlotStyle(
                            index,
                            "letterSpacing",
                            e.target.value
                          )
                        }
                        placeholder="-0.52px"
                        className={smallInputCls}
                      />
                    </div>

                    {/* lineHeight */}
                    <div>
                      {labelClass("행간 (lineHeight)")}
                      <input
                        type="number"
                        value={slot.style?.lineHeight ?? ""}
                        onChange={(e) =>
                          updateTextSlotStyle(
                            index,
                            "lineHeight",
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value)
                          )
                        }
                        placeholder="1.5"
                        step="0.1"
                        className={smallInputCls}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addTextSlot}
          className="mt-4 w-full rounded-md border border-dashed border-border py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
        >
          + 텍스트 슬롯 추가
        </button>
      </section>

      {/* 4. Image Slots Editor */}
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-medium">
            이미지 슬롯{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({imageSlots.length})
            </span>
          </h2>
        </div>

        {imageSlots.length === 0 && (
          <p className="text-sm text-muted-foreground mb-4">
            이미지 슬롯이 없습니다.
          </p>
        )}

        <div className="space-y-4">
          {imageSlots.map((slot, index) => (
            <div
              key={slot.id}
              className="rounded-md border border-border bg-background p-4 space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">
                  #{index + 1} {slot.id}
                </span>
                <button
                  onClick={() => removeImageSlot(index)}
                  className="rounded px-2 py-0.5 text-xs border border-destructive text-destructive hover:bg-destructive/10"
                >
                  X 삭제
                </button>
              </div>

              {/* Purpose */}
              <div>
                {labelClass("용도 (purpose)")}
                <input
                  type="text"
                  value={slot.purpose}
                  onChange={(e) =>
                    updateImageSlot(index, "purpose", e.target.value)
                  }
                  placeholder="예: main-product, background"
                  className={inputCls}
                />
              </div>

              {/* Position */}
              <div>
                {labelClass("위치 (position)")}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">X</span>
                    <input
                      type="number"
                      value={slot.x}
                      onChange={(e) =>
                        updateImageSlot(index, "x", Number(e.target.value))
                      }
                      className={smallInputCls}
                    />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Y</span>
                    <input
                      type="number"
                      value={slot.y}
                      onChange={(e) =>
                        updateImageSlot(index, "y", Number(e.target.value))
                      }
                      className={smallInputCls}
                    />
                  </div>
                </div>
              </div>

              {/* Size */}
              <div>
                {labelClass("크기 (size)")}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">너비</span>
                    <input
                      type="number"
                      value={slot.width}
                      onChange={(e) =>
                        updateImageSlot(index, "width", Number(e.target.value))
                      }
                      className={smallInputCls}
                    />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">높이</span>
                    <input
                      type="number"
                      value={slot.height}
                      onChange={(e) =>
                        updateImageSlot(index, "height", Number(e.target.value))
                      }
                      className={smallInputCls}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addImageSlot}
          className="mt-4 w-full rounded-md border border-dashed border-border py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
        >
          + 이미지 슬롯 추가
        </button>
      </section>

      {/* 5. Bottom actions */}
      <div className="flex items-center gap-3 pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-md border border-destructive px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          {deleting ? "삭제 중..." : "삭제"}
        </button>
        <Link
          href="/admin/components"
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
        >
          목록으로
        </Link>
        {saveError && (
          <span className="text-sm text-destructive">{saveError}</span>
        )}
      </div>
    </div>
  );
}
