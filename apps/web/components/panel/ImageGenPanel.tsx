"use client";

import { useCallback, useRef, useState } from "react";
import type { CanvasSection } from "@/lib/types/editor";
import type { ReferenceElement } from "@/lib/types/pdp";
import { useEditorStore } from "@/lib/store/editor-store";
import { SectionGallery } from "@/components/gallery/SectionGallery";

interface ImageGenPanelProps {
  projectId: string;
  selectedSectionId?: string;
  sections?: CanvasSection[];
}

type StyleOption = "studio" | "lifestyle" | "outdoor";
type ModeOption = "guide-first" | "style-first";

const REFERENCE_ELEMENTS: { key: ReferenceElement; label: string }[] = [
  { key: "color", label: "색감" },
  { key: "composition", label: "구도" },
  { key: "pose", label: "포즈" },
  { key: "lighting", label: "조명" },
  { key: "angle", label: "앵글" },
  { key: "concept", label: "컨셉" },
  { key: "props", label: "소품" },
];

interface UploadedImage {
  base64: string;
  mimeType: string;
  name: string;
  previewUrl: string;
}

function useImageUpload() {
  const [image, setImage] = useState<UploadedImage | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const base64 = result.split(",")[1] ?? result;
      setImage({
        base64,
        mimeType: file.type,
        name: file.name,
        previewUrl: result,
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const clear = useCallback(() => setImage(null), []);

  return { image, inputRef, handleDrop, handleInputChange, clear };
}

interface UploadAreaProps {
  label: string;
  image: UploadedImage | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}

function UploadArea({ label, image, inputRef, onDrop, onInputChange, onClear }: UploadAreaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div
        className="relative flex h-24 cursor-pointer items-center justify-center rounded-md border border-dashed border-border bg-muted/30 transition-colors hover:bg-muted/50"
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        {image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.previewUrl}
              alt={label}
              className="h-full w-full rounded-md object-contain p-1"
            />
            <button
              type="button"
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
            >
              x
            </button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            클릭 또는 드래그
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onInputChange}
        />
      </div>
    </div>
  );
}

export function ImageGenPanel({
  projectId,
  selectedSectionId,
  sections = [],
}: ImageGenPanelProps) {
  const [activeSectionId, setActiveSectionId] = useState(selectedSectionId ?? "");
  const [style, setStyle] = useState<StyleOption>("studio");
  const [mode, setMode] = useState<ModeOption>("guide-first");
  const [activeElements, setActiveElements] = useState<Set<ReferenceElement>>(new Set());
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedImageId, setGeneratedImageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateImageSlot = useEditorStore((s) => s.updateImageSlot);
  const selectedSlotId = useEditorStore((s) => s.selectedSlotId);

  const productUpload = useImageUpload();
  const modelUpload = useImageUpload();
  const referenceUpload = useImageUpload();

  const toggleElement = useCallback((el: ReferenceElement) => {
    setActiveElements((prev) => {
      const next = new Set(prev);
      if (next.has(el)) next.delete(el);
      else next.add(el);
      return next;
    });
  }, []);

  const handleGeneratePrompt = useCallback(async () => {
    if (!activeSectionId) {
      setError("섹션을 먼저 선택해 주세요.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/pdp/images/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: activeSectionId,
          projectId,
          style,
          mode,
          referenceElements: [...activeElements],
          referenceImageDescription: referenceUpload.image ? "uploaded reference" : "",
        }),
      });
      const data = (await res.json()) as { prompt?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "프롬프트 생성 실패");
      setPrompt(data.prompt ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [activeSectionId, projectId, style, mode, activeElements, referenceUpload.image]);

  const handleImprovePrompt = useCallback(async () => {
    if (!prompt.trim()) {
      setError("개선할 프롬프트를 먼저 생성해 주세요.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/pdp/images/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: activeSectionId,
          projectId,
          style,
          mode,
          referenceElements: [...activeElements],
          referenceImageDescription: referenceUpload.image ? "uploaded reference" : "",
          existingPrompt: prompt,
          improve: true,
        }),
      });
      const data = (await res.json()) as { prompt?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "프롬프트 개선 실패");
      setPrompt(data.prompt ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [prompt, activeSectionId, projectId, style, mode, activeElements, referenceUpload.image]);

  const handleGenerate = useCallback(async () => {
    if (!productUpload.image) {
      setError("제품 이미지를 업로드해 주세요.");
      return;
    }
    if (!activeSectionId) {
      setError("섹션을 먼저 선택해 주세요.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setGeneratedImageUrl(null);
    setGeneratedImageId(null);

    try {
      const res = await fetch("/api/pdp/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: activeSectionId,
          projectId,
          originalImageBase64: productUpload.image.base64,
          originalImageMimeType: productUpload.image.mimeType,
          options: {
            prompt,
            width: 1024,
            height: 1024,
            style,
            referenceElements: [...activeElements],
            guidePriorityMode: mode,
            withModel: Boolean(modelUpload.image),
            referenceModelImageBase64: modelUpload.image?.base64,
            referenceModelImageMimeType: modelUpload.image?.mimeType,
            referenceImageUrl: referenceUpload.image?.previewUrl,
            referenceImageDescription: referenceUpload.image ? "uploaded reference" : "",
          },
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        imageId?: string;
        imageUrl?: string;
        imageBase64?: string;
        mimeType?: string;
        error?: string;
      };

      if (!res.ok || !data.ok) throw new Error(data.error ?? "이미지 생성 실패");

      if (data.imageId) setGeneratedImageId(data.imageId);

      if (data.imageBase64 && data.mimeType) {
        setGeneratedImageUrl(`data:${data.mimeType};base64,${data.imageBase64}`);
      } else if (data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [
    productUpload.image,
    modelUpload.image,
    referenceUpload.image,
    activeSectionId,
    projectId,
    prompt,
    style,
    mode,
    activeElements,
  ]);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Section selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">섹션 선택</label>
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={activeSectionId}
          onChange={(e) => setActiveSectionId(e.target.value)}
        >
          <option value="">섹션을 선택하세요</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.componentId} (#{s.order + 1})
            </option>
          ))}
        </select>
      </div>

      {/* Upload areas */}
      <div className="flex flex-col gap-3">
        <UploadArea
          label="제품 이미지"
          image={productUpload.image}
          inputRef={productUpload.inputRef}
          onDrop={productUpload.handleDrop}
          onInputChange={productUpload.handleInputChange}
          onClear={productUpload.clear}
        />
        <UploadArea
          label="모델 이미지 (선택)"
          image={modelUpload.image}
          inputRef={modelUpload.inputRef}
          onDrop={modelUpload.handleDrop}
          onInputChange={modelUpload.handleInputChange}
          onClear={modelUpload.clear}
        />
        <UploadArea
          label="레퍼런스 이미지 (선택)"
          image={referenceUpload.image}
          inputRef={referenceUpload.inputRef}
          onDrop={referenceUpload.handleDrop}
          onInputChange={referenceUpload.handleInputChange}
          onClear={referenceUpload.clear}
        />
      </div>

      {/* Reference elements */}
      {referenceUpload.image && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">레퍼런스 요소</label>
          <div className="flex flex-wrap gap-1.5">
            {REFERENCE_ELEMENTS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleElement(key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  activeElements.has(key)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Style radio */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">스타일</label>
        <div className="flex gap-4">
          {(["studio", "lifestyle", "outdoor"] as StyleOption[]).map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="style"
                value={s}
                checked={style === s}
                onChange={() => setStyle(s)}
                className="accent-primary"
              />
              {s === "studio" ? "스튜디오" : s === "lifestyle" ? "라이프스타일" : "아웃도어"}
            </label>
          ))}
        </div>
      </div>

      {/* Mode radio */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">모드</label>
        <div className="flex gap-4">
          {(["guide-first", "style-first"] as ModeOption[]).map((m) => (
            <label key={m} className="flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="mode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
                className="accent-primary"
              />
              {m === "guide-first" ? "가이드 우선" : "스타일 우선"}
            </label>
          ))}
        </div>
      </div>

      {/* Prompt textarea */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">생성 프롬프트</label>
        <textarea
          rows={5}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="프롬프트를 생성하거나 직접 입력하세요"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={handleGeneratePrompt}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            프롬프트 생성
          </button>
          <button
            type="button"
            disabled={isLoading || !prompt.trim()}
            onClick={handleImprovePrompt}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            프롬프트 개선
          </button>
        </div>
        <button
          type="button"
          disabled={isLoading || !productUpload.image}
          onClick={handleGenerate}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? "생성 중..." : "이미지 생성"}
        </button>
      </div>

      {/* Generated image */}
      {generatedImageUrl && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">생성된 이미지</label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={generatedImageUrl}
            alt="generated"
            className="w-full rounded-md border border-border object-contain"
          />
          <a
            href={generatedImageUrl}
            download="generated.jpg"
            className="text-center text-xs text-primary underline hover:no-underline"
          >
            다운로드
          </a>
        </div>
      )}

      {/* Gallery */}
      {activeSectionId && (
        <SectionGallery
          projectId={projectId}
          sectionId={activeSectionId}
          onSelect={(imageUrl, imageId) => {
            setGeneratedImageUrl(imageUrl);
            setGeneratedImageId(imageId);
            if (selectedSlotId) {
              updateImageSlot(activeSectionId, selectedSlotId, imageUrl, imageId);
            }
          }}
        />
      )}
    </div>
  );
}
