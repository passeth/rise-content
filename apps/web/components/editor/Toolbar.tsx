"use client";

import React from "react";
import { Undo2, Redo2, ZoomIn, ZoomOut, Save, ImageDown, Figma } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/store/editor-store";
import { useProjectStore } from "@/lib/store/project-store";
import { Button } from "@/components/ui/button";
import { exportSectionsAsJpg } from "@/lib/export/jpg-export";
import { prepareFigmaExportData, generateFigmaPluginMessage } from "@/lib/export/figma-export";

interface ToolbarProps {
  isSaving?: boolean;
  lastSavedAt?: Date | null;
  onSave?: () => void;
  canvasRef?: React.RefObject<HTMLElement>;
}

export function Toolbar({ isSaving, lastSavedAt, onSave, canvasRef }: ToolbarProps) {
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const setZoom = useEditorStore((s) => s.setZoom);
  const zoom = useEditorStore((s) => s.zoom);
  const isDirty = useEditorStore((s) => s.isDirty);
  const previousStates = useEditorStore((s) => s.previousStates);
  const futureStates = useEditorStore((s) => s.futureStates);
  const sections = useEditorStore((s) => s.sections);
  const currentProject = useProjectStore((s) => s.currentProject);

  const canUndo = previousStates.length > 0;
  const canRedo = futureStates.length > 0;

  const projectName = currentProject?.name ?? "pdp-export";

  async function handleJpgExport() {
    const container = canvasRef?.current ?? document.querySelector<HTMLElement>("[data-canvas-container]");
    if (!container) {
      alert("캔버스를 찾을 수 없습니다.");
      return;
    }
    try {
      await exportSectionsAsJpg(container, projectName);
    } catch (err) {
      alert(err instanceof Error ? err.message : "내보내기 오류가 발생했습니다.");
    }
  }

  function handleFigmaExport() {
    const data = prepareFigmaExportData(sections, projectName);
    const message = generateFigmaPluginMessage(data);
    navigator.clipboard.writeText(message).then(() => {
      alert("클립보드에 복사됨. Figma 플러그인에 붙여넣기 하세요.");
    }).catch(() => {
      alert("클립보드 복사 실패. 콘솔에서 데이터를 확인하세요.");
      console.log(message);
    });
  }

  function handleZoomOut() {
    setZoom(Math.max(0.5, parseFloat((zoom - 0.1).toFixed(1))));
  }

  function handleZoomIn() {
    setZoom(Math.min(2, parseFloat((zoom + 0.1).toFixed(1))));
  }

  function formatLastSaved(date: Date) {
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  }

  const saveLabel = isSaving
    ? "저장 중..."
    : isDirty
    ? "저장 안 됨"
    : lastSavedAt
    ? `저장됨 ${formatLastSaved(lastSavedAt)}`
    : "저장됨";

  return (
    <div className="flex items-center gap-1 h-12 px-3 border-b border-border bg-card shrink-0">
      {/* Undo / Redo */}
      <Button
        variant="ghost"
        size="icon"
        onClick={undo}
        disabled={!canUndo}
        title="실행 취소"
        className="h-8 w-8"
      >
        <Undo2 className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={redo}
        disabled={!canRedo}
        title="다시 실행"
        className="h-8 w-8"
      >
        <Redo2 className="w-4 h-4" />
      </Button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Zoom controls */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleZoomOut}
        disabled={zoom <= 0.5}
        title="축소"
        className="h-8 w-8"
      >
        <ZoomOut className="w-4 h-4" />
      </Button>

      <span className="text-xs font-medium text-foreground w-12 text-center tabular-nums">
        {Math.round(zoom * 100)}%
      </span>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleZoomIn}
        disabled={zoom >= 2}
        title="확대"
        className="h-8 w-8"
      >
        <ZoomIn className="w-4 h-4" />
      </Button>

      <div className="flex-1" />

      {/* Export buttons */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleJpgExport}
        title="JPG 내보내기"
        className="h-8 gap-1.5 text-xs"
      >
        <ImageDown className="w-3.5 h-3.5" />
        JPG 내보내기
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleFigmaExport}
        title="Figma 내보내기"
        className="h-8 gap-1.5 text-xs"
      >
        <Figma className="w-3.5 h-3.5" />
        Figma 내보내기
      </Button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Save status + manual save button */}
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs px-2 py-1 rounded",
          isSaving
            ? "text-blue-500"
            : isDirty
            ? "text-amber-600"
            : "text-muted-foreground"
        )}
      >
        <span
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            isSaving
              ? "bg-blue-400 animate-pulse"
              : isDirty
              ? "bg-amber-500"
              : "bg-green-500"
          )}
        />
        <span>{saveLabel}</span>
      </div>

      {onSave && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onSave}
          disabled={isSaving}
          title="지금 저장"
          className="h-8 w-8"
        >
          <Save className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
