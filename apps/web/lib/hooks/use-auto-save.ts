"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/lib/store/editor-store";
import { createClient } from "@/lib/supabase/client";

export function useAutoSave(projectId: string, debounceMs: number = 3000) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty = useEditorStore((s) => s.isDirty);
  const sections = useEditorStore((s) => s.sections);
  const setDirty = useEditorStore((s) => s.setDirty);

  const saveNow = useCallback(async () => {
    if (!projectId) return;
    setIsSaving(true);
    try {
      const supabase = createClient();
      const canvasState = { sections };
      const { error } = await supabase
        .from("projects")
        .update({ canvas_state: canvasState, updated_at: new Date().toISOString() })
        .eq("id", projectId);
      if (error) throw error;
      setDirty(false);
      setLastSavedAt(new Date());
    } catch (err) {
      console.error("[useAutoSave] save failed:", err);
    } finally {
      setIsSaving(false);
    }
  }, [projectId, sections, setDirty]);

  useEffect(() => {
    if (!isDirty) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      void saveNow();
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isDirty, saveNow, debounceMs]);

  return { isSaving, lastSavedAt, saveNow };
}
