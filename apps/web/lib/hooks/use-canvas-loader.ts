"use client";

import { useEffect, useState } from "react";
import { useEditorStore } from "@/lib/store/editor-store";
import { createClient } from "@/lib/supabase/client";
import type { CanvasSection } from "@/lib/types/editor";

export function useCanvasLoader(projectId: string) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resetEditor = useEditorStore((s) => s.resetEditor);
  const loadSections = useEditorStore((s) => s.loadSections);

  useEffect(() => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from("projects")
          .select("canvas_state")
          .eq("id", projectId)
          .single();

        if (cancelled) return;

        if (fetchError) throw fetchError;

        resetEditor();

        const sections = (data?.canvas_state as { sections?: CanvasSection[] } | null)?.sections;
        if (sections && sections.length > 0) {
          loadSections(sections);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "캔버스를 불러오는 중 오류가 발생했습니다.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [projectId, resetEditor, loadSections]);

  return { isLoading, error };
}
