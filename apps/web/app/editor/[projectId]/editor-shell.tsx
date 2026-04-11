"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/lib/store/editor-store";
import { useProjectStore } from "@/lib/store/project-store";
import { useAutoSave } from "@/lib/hooks/use-auto-save";
import { useCanvasLoader } from "@/lib/hooks/use-canvas-loader";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Canvas } from "@/components/editor/Canvas";
import { Toolbar } from "@/components/editor/Toolbar";
import { ComponentPalette } from "@/components/panel/ComponentPalette";
import { ProductInfoPanel } from "@/components/panel/ProductInfoPanel";
import { AgentChatPanel } from "@/components/panel/AgentChatPanel";
import { AgentSummaryCard } from "@/components/panel/AgentSummaryCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CanvasSection } from "@/lib/types/editor";

interface Project {
  id: string;
  name: string;
  brand_id: string;
  status: string;
  product_info: Record<string, string>;
  agent_context: Record<string, unknown>;
  canvas_state: { sections: CanvasSection[] };
  blueprint: Record<string, unknown> | null;
  brands: {
    id: string;
    name: string;
    slug: string;
    color_palette: Record<string, string>;
  };
}

interface EditorShellProps {
  project: Project;
}

export function EditorShell({ project }: EditorShellProps) {
  const resetEditor = useEditorStore((s) => s.resetEditor);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);

  const { isLoading } = useCanvasLoader(project.id);
  const { isSaving, lastSavedAt, saveNow } = useAutoSave(project.id);

  useEffect(() => {
    setCurrentProject({
      id: project.id,
      name: project.name,
      brandId: project.brand_id,
      status: project.status as "draft" | "in_progress" | "completed",
      productInfo: project.product_info,
      agentContext: project.agent_context,
      blueprint: project.blueprint ?? {},
    });

    return () => {
      resetEditor();
    };
  }, [project, resetEditor, setCurrentProject]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">캔버스 불러오는 중...</span>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-screen w-full overflow-hidden">
      {/* Left Panel: Component Palette */}
      <aside className="w-[280px] shrink-0 border-r border-border bg-card overflow-y-auto">
        <ComponentPalette brandId={project.brand_id} />
      </aside>

      {/* Center: Canvas */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <Toolbar
          isSaving={isSaving}
          lastSavedAt={lastSavedAt}
          onSave={saveNow}
        />

        {/* Canvas Area */}
        <Canvas brandId={project.brand_id} />
      </main>

      {/* Right Panel: Tabs */}
      <aside className="w-[360px] shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
        <Tabs defaultValue="product" className="flex flex-col h-full">
          <TabsList className="shrink-0 w-full rounded-none border-b border-border bg-card h-auto p-0 justify-start">
            <TabsTrigger value="product" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-3 py-2.5">
              제품정보
            </TabsTrigger>
            <TabsTrigger value="agent" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-3 py-2.5">
              AI 에이전트
            </TabsTrigger>
            <TabsTrigger value="image" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-3 py-2.5">
              이미지 생성
            </TabsTrigger>
            <TabsTrigger value="translate" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs px-3 py-2.5">
              번역
            </TabsTrigger>
          </TabsList>

          <TabsContent value="product" className="flex-1 overflow-y-auto mt-0">
            <ProductInfoPanel projectId={project.id} />
            <AgentSummaryCard projectId={project.id} />
          </TabsContent>

          <TabsContent value="agent" className="flex-1 overflow-hidden mt-0 flex flex-col">
            <AgentChatPanel projectId={project.id} brandName={project.brands.name} />
          </TabsContent>

          <TabsContent value="image" className="flex-1 overflow-y-auto mt-0">
            <div className="flex items-center justify-center h-full min-h-[200px] text-sm text-muted-foreground p-8 text-center">
              이미지 생성 기능은 준비 중입니다
            </div>
          </TabsContent>

          <TabsContent value="translate" className="flex-1 overflow-y-auto mt-0">
            <div className="flex items-center justify-center h-full min-h-[200px] text-sm text-muted-foreground p-8 text-center">
              번역 기능은 준비 중입니다
            </div>
          </TabsContent>
        </Tabs>
      </aside>
      </div>
    </DndProvider>
  );
}
