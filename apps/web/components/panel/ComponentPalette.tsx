"use client";

import { useEffect, useState } from "react";
import { useDrag } from "react-dnd";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { BrandComponent, ComponentCategory, LayoutType } from "@/lib/types/brand";

interface ComponentPaletteProps {
  brandId: string;
}

const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  hero: "히어로",
  benefit: "베네핏",
  ingredient: "성분",
  review: "후기",
  cta: "CTA",
  usage: "사용법",
  routine: "루틴",
};

const CATEGORY_ORDER: ComponentCategory[] = [
  "hero",
  "benefit",
  "ingredient",
  "review",
  "cta",
  "usage",
  "routine",
];

const LAYOUT_LABELS: Record<LayoutType, string> = {
  "1-col": "1단",
  "2-col": "2단",
  "3-col": "3단",
};

type LayoutFilter = "all" | LayoutType;

export function ComponentPalette({ brandId }: ComponentPaletteProps) {
  const [components, setComponents] = useState<BrandComponent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [layoutFilter, setLayoutFilter] = useState<LayoutFilter>("all");

  useEffect(() => {
    const supabase = createClient();

    async function loadComponents() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("components")
        .select("*")
        .eq("brand_id", brandId)
        .order("category")
        .order("name");

      if (!error && data) {
        setComponents(data as BrandComponent[]);
      }
      setIsLoading(false);
    }

    void loadComponents();
  }, [brandId]);

  const filtered =
    layoutFilter === "all"
      ? components
      : components.filter((c) => c.layoutType === layoutFilter);

  const grouped = CATEGORY_ORDER.reduce<Record<ComponentCategory, BrandComponent[]>>(
    (acc, cat) => {
      acc[cat] = filtered.filter((c) => c.category === cat);
      return acc;
    },
    {} as Record<ComponentCategory, BrandComponent[]>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
        로딩 중...
      </div>
    );
  }

  const filterOptions: { value: LayoutFilter; label: string }[] = [
    { value: "all", label: "전체" },
    { value: "1-col", label: "1단" },
    { value: "2-col", label: "2단" },
    { value: "3-col", label: "3단" },
  ];

  return (
    <div className="flex flex-col w-[280px] max-w-[280px] h-full overflow-y-auto bg-background border-r border-border">
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs font-semibold text-foreground">컴포넌트</p>
      </div>

      {/* Layout filter */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setLayoutFilter(opt.value)}
            className={cn(
              "px-2 py-0.5 text-[11px] rounded border transition-colors",
              layoutFilter === opt.value
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:bg-accent/50"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-0">
        {CATEGORY_ORDER.map((category) => {
          const items = grouped[category];
          if (!items || items.length === 0) return null;

          return (
            <div key={category} className="flex flex-col">
              <div className="px-3 py-1.5 bg-muted/50">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  {CATEGORY_LABELS[category]}
                </span>
              </div>

              <div className="flex flex-col gap-0">
                {items.map((component) => (
                  <ComponentItem key={component.id} component={component} />
                ))}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <ImageIcon className="w-8 h-8 opacity-30" />
            <p className="text-sm">컴포넌트가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ComponentItemProps {
  component: BrandComponent;
}

function ComponentItem({ component }: ComponentItemProps) {
  const [{ isDragging }, dragRef] = useDrag({
    type: "COMPONENT",
    item: { componentId: component.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={dragRef as unknown as React.RefObject<HTMLDivElement>}
      className={cn(
        "flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing",
        "hover:bg-accent/50 transition-colors select-none",
        isDragging && "opacity-50"
      )}
    >
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-10 h-10 rounded border border-border bg-muted overflow-hidden">
        {component.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={component.thumbnailUrl}
            alt={component.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <ImageIcon className="w-4 h-4 text-muted-foreground opacity-50" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-xs font-medium text-foreground truncate">{component.name}</span>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[10px] text-muted-foreground">
            {CATEGORY_LABELS[component.category]}
          </span>
          {component.layoutType && (
            <span className="text-[10px] px-1 py-px rounded bg-muted border border-border text-muted-foreground leading-none">
              [{LAYOUT_LABELS[component.layoutType]}]
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
