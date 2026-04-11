"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface TextSlot {
  id: string;
  role: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontWeight?: number;
  maxLength?: number;
}

type LayoutType = "1-col" | "2-col" | "3-col";

interface ComponentRow {
  id: string;
  name: string;
  category: string;
  layout_type: LayoutType | null;
  version: number;
  thumbnail_url: string | null;
  brand_id: string;
  text_slots: TextSlot[] | null;
  created_at: string;
}

interface BrandItem {
  id: string;
  name: string;
  slug: string;
}

interface ComponentsClientProps {
  components: ComponentRow[];
  brands: BrandItem[];
}

const TEXT_ROLES = ["headline", "subheadline", "body", "caption", "cta"];

const LAYOUT_TYPE_LABELS: Record<LayoutType, string> = {
  "1-col": "1단",
  "2-col": "2단",
  "3-col": "3단",
};

const LAYOUT_TYPE_OPTIONS: { value: LayoutType; label: string }[] = [
  { value: "1-col", label: "1단" },
  { value: "2-col", label: "2단" },
  { value: "3-col", label: "3단" },
];

export function ComponentsClient({
  components: initialComponents,
  brands,
}: ComponentsClientProps) {
  const router = useRouter();
  const [components, setComponents] = useState(initialComponents);

  // Import form state
  const [showImport, setShowImport] = useState(false);
  const [figmaUrl, setFigmaUrl] = useState("");
  const [importBrandId, setImportBrandId] = useState(brands[0]?.id ?? "");
  const [importing, setImporting] = useState(false);
  const [importedBlocks, setImportedBlocks] = useState<ComponentRow[]>([]);

  // Role correction state: componentId -> slotId -> role
  const [slotRoles, setSlotRoles] = useState<
    Record<string, Record<string, string>>
  >({});
  const [savingRoles, setSavingRoles] = useState<Record<string, boolean>>({});

  // Layout type editing: componentId -> LayoutType
  const [layoutEdits, setLayoutEdits] = useState<Record<string, LayoutType>>({});
  const [savingLayout, setSavingLayout] = useState<Record<string, boolean>>({});

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Group components by brand
  const byBrand: Record<string, ComponentRow[]> = {};
  for (const c of components) {
    if (!byBrand[c.brand_id]) byBrand[c.brand_id] = [];
    byBrand[c.brand_id].push(c);
  }

  function getBrandName(brandId: string) {
    return brands.find((b) => b.id === brandId)?.name ?? brandId;
  }

  function getSlotRole(componentId: string, slotId: string, original: string) {
    return slotRoles[componentId]?.[slotId] ?? original;
  }

  function updateSlotRole(componentId: string, slotId: string, role: string) {
    setSlotRoles((prev) => ({
      ...prev,
      [componentId]: { ...prev[componentId], [slotId]: role },
    }));
  }

  function getLayoutType(component: ComponentRow): LayoutType {
    return layoutEdits[component.id] ?? component.layout_type ?? "1-col";
  }

  function updateLayoutType(componentId: string, value: LayoutType) {
    setLayoutEdits((prev) => ({ ...prev, [componentId]: value }));
  }

  async function handleImport() {
    if (!figmaUrl.trim() || !importBrandId) return;
    setImporting(true);
    setImportedBlocks([]);
    try {
      const res = await fetch("/api/figma/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ figmaUrl, brandId: importBrandId, mode: "batch" }),
      });

      const data = (await res.json()) as {
        components?: ComponentRow[];
        component?: ComponentRow;
        count?: number;
        error?: string;
      };

      if (!res.ok) {
        alert(data.error ?? "Figma 가져오기에 실패했습니다.");
        return;
      }

      // Batch response
      if (data.components && data.components.length > 0) {
        setComponents((prev) => [...prev, ...data.components!]);
        setImportedBlocks(data.components);
      }
      // Fallback single response
      else if (data.component) {
        setComponents((prev) => [...prev, data.component!]);
        setImportedBlocks([data.component]);
      }
    } finally {
      setImporting(false);
    }
  }

  async function handleSaveRoles(component: ComponentRow) {
    const roleOverrides = slotRoles[component.id];
    if (!roleOverrides || Object.keys(roleOverrides).length === 0) return;

    const updatedSlots = (component.text_slots ?? []).map((slot) => ({
      ...slot,
      role: roleOverrides[slot.id] ?? slot.role,
    }));

    setSavingRoles((prev) => ({ ...prev, [component.id]: true }));
    try {
      const res = await fetch("/api/admin/components", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: component.id,
          text_slots: updatedSlots,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error ?? "저장에 실패했습니다.");
        return;
      }

      setComponents((prev) =>
        prev.map((c) =>
          c.id === component.id ? { ...c, text_slots: updatedSlots } : c
        )
      );
      setSlotRoles((prev) => {
        const next = { ...prev };
        delete next[component.id];
        return next;
      });
    } finally {
      setSavingRoles((prev) => ({ ...prev, [component.id]: false }));
    }
  }

  async function handleSaveLayoutType(component: ComponentRow) {
    const newLayout = layoutEdits[component.id];
    if (!newLayout) return;

    setSavingLayout((prev) => ({ ...prev, [component.id]: true }));
    try {
      const res = await fetch("/api/admin/components", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: component.id,
          layout_type: newLayout,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error ?? "저장에 실패했습니다.");
        return;
      }

      setComponents((prev) =>
        prev.map((c) =>
          c.id === component.id ? { ...c, layout_type: newLayout } : c
        )
      );
      setLayoutEdits((prev) => {
        const next = { ...prev };
        delete next[component.id];
        return next;
      });
    } finally {
      setSavingLayout((prev) => ({ ...prev, [component.id]: false }));
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 컴포넌트를 삭제하시겠습니까?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/components?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error ?? "삭제에 실패했습니다.");
        return;
      }
      setComponents((prev) => prev.filter((c) => c.id !== id));
      setImportedBlocks((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  // Suppress unused router warning — kept for future navigation
  void router;

  return (
    <div className="space-y-6">
      {/* Figma Import */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          총 {components.length}개의 컴포넌트
        </p>
        <button
          onClick={() => setShowImport((v) => !v)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Figma에서 가져오기
        </button>
      </div>

      {showImport && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div>
            <h2 className="text-base font-medium">Figma 컴포넌트 가져오기</h2>
            <p className="text-xs text-muted-foreground mt-1">
              페이지의 모든 자식 프레임을 개별 블록으로 가져옵니다
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Figma URL</label>
              <input
                type="text"
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
                placeholder="https://www.figma.com/design/...?node-id=..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">브랜드</label>
              <select
                value={importBrandId}
                onChange={(e) => setImportBrandId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={importing || !figmaUrl.trim() || !importBrandId}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {importing ? "가져오는 중..." : "가져오기"}
            </button>
            <button
              onClick={() => {
                setShowImport(false);
                setFigmaUrl("");
                setImportedBlocks([]);
              }}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              닫기
            </button>
          </div>

          {/* Post-import block list */}
          {importedBlocks.length > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium">
                가져온 블록:{" "}
                <span className="text-foreground">{importedBlocks.length}개</span>
              </p>
              <div className="space-y-3">
                {importedBlocks.map((block) => (
                  <div
                    key={block.id}
                    className="rounded-md border border-border bg-background p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate flex-1">
                        {block.name}
                      </span>
                      {block.layout_type && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                          [{LAYOUT_TYPE_LABELS[block.layout_type]}]
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {block.category}
                      </span>
                    </div>

                    {/* Layout type edit */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">레이아웃</span>
                      <select
                        value={getLayoutType(block)}
                        onChange={(e) =>
                          updateLayoutType(block.id, e.target.value as LayoutType)
                        }
                        className="rounded border border-border bg-background px-2 py-0.5 text-xs"
                      >
                        {LAYOUT_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {layoutEdits[block.id] && (
                        <button
                          onClick={() => handleSaveLayoutType(block)}
                          disabled={savingLayout[block.id]}
                          className="rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {savingLayout[block.id] ? "저장 중..." : "저장"}
                        </button>
                      )}
                    </div>

                    {/* Text slots */}
                    {(block.text_slots ?? []).length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">
                          텍스트 슬롯 역할 확인
                        </p>
                        {(block.text_slots ?? []).map((slot) => (
                          <div
                            key={slot.id}
                            className="flex items-center gap-3 text-xs"
                          >
                            <span className="w-24 truncate font-mono text-muted-foreground">
                              {slot.id}
                            </span>
                            <select
                              value={getSlotRole(block.id, slot.id, slot.role)}
                              onChange={(e) =>
                                updateSlotRole(block.id, slot.id, e.target.value)
                              }
                              className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
                            >
                              {TEXT_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                        {slotRoles[block.id] &&
                          Object.keys(slotRoles[block.id]).length > 0 && (
                            <button
                              onClick={() => handleSaveRoles(block)}
                              disabled={savingRoles[block.id]}
                              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                              {savingRoles[block.id] ? "저장 중..." : "역할 저장"}
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Components grouped by brand */}
      {Object.keys(byBrand).length > 0 ? (
        <div className="space-y-8">
          {Object.entries(byBrand).map(([brandId, brandComponents]) => (
            <div key={brandId}>
              <h2 className="text-base font-medium text-foreground mb-4">
                {getBrandName(brandId)}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {brandComponents.map((component) => (
                  <div
                    key={component.id}
                    className="rounded-lg border border-border bg-card overflow-hidden"
                  >
                    {/* Thumbnail */}
                    <div className="h-32 bg-muted flex items-center justify-center">
                      {component.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={component.thumbnail_url}
                          alt={component.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          썸네일 없음
                        </span>
                      )}
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm text-foreground">
                            {component.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {component.category}
                            </span>
                            {component.layout_type && (
                              <span className="text-[10px] px-1 py-px rounded bg-muted border border-border text-muted-foreground">
                                [{LAYOUT_TYPE_LABELS[component.layout_type]}]
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              v{component.version}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/admin/components/${component.id}`}
                            className="rounded px-2 py-1 text-xs border border-border text-foreground hover:bg-muted"
                          >
                            편집
                          </Link>
                          <button
                            onClick={() =>
                              handleDelete(component.id, component.name)
                            }
                            disabled={deletingId === component.id}
                            className="rounded px-2 py-1 text-xs border border-destructive text-destructive hover:bg-destructive/10 disabled:opacity-50"
                          >
                            {deletingId === component.id ? "삭제 중..." : "삭제"}
                          </button>
                        </div>
                      </div>

                      {/* Layout type edit */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">레이아웃</span>
                        <select
                          value={getLayoutType(component)}
                          onChange={(e) =>
                            updateLayoutType(component.id, e.target.value as LayoutType)
                          }
                          className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
                        >
                          {LAYOUT_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {layoutEdits[component.id] && (
                          <button
                            onClick={() => handleSaveLayoutType(component)}
                            disabled={savingLayout[component.id]}
                            className="rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            {savingLayout[component.id] ? "저장 중..." : "저장"}
                          </button>
                        )}
                      </div>

                      {/* Text slot role correction */}
                      {(component.text_slots ?? []).length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">
                            텍스트 슬롯 ({(component.text_slots ?? []).length}개)
                          </p>
                          {(component.text_slots ?? []).map((slot) => (
                            <div
                              key={slot.id}
                              className="flex items-center gap-2 text-xs"
                            >
                              <span className="truncate font-mono text-muted-foreground flex-1">
                                {slot.id}
                              </span>
                              <select
                                value={getSlotRole(
                                  component.id,
                                  slot.id,
                                  slot.role
                                )}
                                onChange={(e) =>
                                  updateSlotRole(
                                    component.id,
                                    slot.id,
                                    e.target.value
                                  )
                                }
                                className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
                              >
                                {TEXT_ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                          {slotRoles[component.id] &&
                            Object.keys(slotRoles[component.id]).length > 0 && (
                              <button
                                onClick={() => handleSaveRoles(component)}
                                disabled={savingRoles[component.id]}
                                className="mt-1 w-full rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                              >
                                {savingRoles[component.id]
                                  ? "저장 중..."
                                  : "역할 저장"}
                              </button>
                            )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !showImport && (
          <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-muted-foreground">
            등록된 컴포넌트가 없습니다. Figma에서 가져오기를 시도해보세요.
          </div>
        )
      )}
    </div>
  );
}
