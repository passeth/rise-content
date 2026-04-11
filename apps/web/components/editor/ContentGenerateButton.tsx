"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/lib/store/editor-store";
import { useProjectStore } from "@/lib/store/project-store";
import { placeContentOnCanvas } from "@/lib/ai/content-placer";
import type { LandingPageBlueprint } from "@/lib/types/pdp";
import type { LayoutConstraint } from "@/lib/ai/pdp-service";

interface ContentGenerateButtonProps {
  /** base64-encoded product image to analyze */
  imageBase64?: string;
  /** MIME type of the product image, e.g. "image/jpeg" */
  mimeType?: string;
}

export function ContentGenerateButton({
  imageBase64,
  mimeType = "image/jpeg",
}: ContentGenerateButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sections = useEditorStore((s) => s.sections);
  const loadSections = useEditorStore((s) => s.loadSections);
  const updateBlueprint = useProjectStore((s) => s.updateBlueprint);
  const currentProject = useProjectStore((s) => s.currentProject);

  const projectId = currentProject?.id;
  const productInfo = currentProject?.productInfo;
  const agentContext = currentProject?.agentContext;

  // Build layout constraints from current canvas sections
  function buildLayoutConstraints(): LayoutConstraint[] {
    const sorted = [...sections].sort((a, b) => a.order - b.order);

    return sorted.map((section) => ({
      sectionId: section.id,
      sectionName: section.componentId,
      textSlots: section.textSlots.map((slot) => ({
        role: slot.role,
        maxLength: slot.maxLength ?? 100,
      })),
    }));
  }

  // Validate preconditions before triggering generation
  function getValidationError(): string | null {
    if (!imageBase64) {
      return "제품 이미지를 먼저 업로드해주세요.";
    }
    if (!projectId) {
      return "프로젝트가 로드되지 않았습니다.";
    }
    if (sections.length === 0) {
      return "캔버스에 섹션을 먼저 추가해주세요.";
    }
    const hasProductInfo =
      productInfo &&
      Object.values(productInfo).some(
        (v) => v !== undefined && v !== null && String(v).trim() !== ""
      );
    if (!hasProductInfo) {
      return "제품 정보를 먼저 입력해주세요.";
    }
    return null;
  }

  async function handleGenerate() {
    const validationError = getValidationError();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const layoutConstraints = buildLayoutConstraints();

      const response = await fetch("/api/pdp/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          projectId,
          additionalInfo: productInfo?.description
            ? String(productInfo.description)
            : undefined,
          desiredTone: agentContext?.toneAndManner
            ? String(agentContext.toneAndManner)
            : undefined,
          layoutConstraints,
        }),
      });

      const data = (await response.json()) as
        | { ok: true; blueprint: LandingPageBlueprint }
        | { error: string };

      if (!response.ok || !("ok" in data)) {
        const errMsg =
          "error" in data ? data.error : "컨텐츠 생성에 실패했습니다.";
        setError(errMsg);
        return;
      }

      // Place generated content onto canvas sections
      const updatedSections = placeContentOnCanvas(data.blueprint, sections);
      loadSections(updatedSections);

      // Persist blueprint to project store
      updateBlueprint(data.blueprint as unknown as Record<string, unknown>);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        onClick={handleGenerate}
        disabled={isLoading}
        variant="default"
        size="sm"
        className="gap-2"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {isLoading ? "컨텐츠 생성 중..." : "컨텐츠 생성"}
      </Button>

      {error && (
        <p className="text-xs text-destructive leading-tight">{error}</p>
      )}
    </div>
  );
}
