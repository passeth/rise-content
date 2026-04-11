"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface GeneratedImage {
  id: string;
  image_url: string;
  prompt: string;
  is_selected: boolean;
  created_at: string;
}

interface SectionGalleryProps {
  projectId: string;
  sectionId: string;
  onSelect: (imageUrl: string, imageId: string) => void;
}

export function SectionGallery({ projectId, sectionId, onSelect }: SectionGalleryProps) {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchImages = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("generated_images")
      .select("id, image_url, prompt, is_selected, created_at")
      .eq("project_id", projectId)
      .eq("section_id", sectionId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setImages(data as GeneratedImage[]);
    }
    setIsLoading(false);
  }, [projectId, sectionId]);

  useEffect(() => {
    void fetchImages();
  }, [fetchImages]);

  const handleSelect = useCallback(
    async (imageId: string, imageUrl: string) => {
      const supabase = createClient();

      // Optimistic update
      setImages((prev) =>
        prev.map((img) => ({ ...img, is_selected: img.id === imageId }))
      );

      // Update DB: deselect all in section, then select clicked
      await supabase
        .from("generated_images")
        .update({ is_selected: false })
        .eq("project_id", projectId)
        .eq("section_id", sectionId);

      await supabase
        .from("generated_images")
        .update({ is_selected: true })
        .eq("id", imageId);

      onSelect(imageUrl, imageId);
    },
    [projectId, sectionId, onSelect]
  );

  if (isLoading) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground">
        불러오는 중...
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground">
        생성된 이미지가 없습니다
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">갤러리</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
          {images.length}장 생성됨
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {images.map((img) => (
          <button
            key={img.id}
            type="button"
            className="flex flex-col gap-1 focus:outline-none"
            onClick={() => void handleSelect(img.id, img.image_url)}
          >
            <div
              className={cn(
                "aspect-square w-full overflow-hidden rounded",
                img.is_selected && "ring-2 ring-blue-500 ring-offset-1"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.image_url}
                alt={img.prompt.slice(0, 50)}
                className="h-full w-full object-cover"
              />
            </div>
            <p className="line-clamp-1 text-left text-[10px] text-muted-foreground">
              {img.prompt.length > 50 ? img.prompt.slice(0, 50) + "…" : img.prompt}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
