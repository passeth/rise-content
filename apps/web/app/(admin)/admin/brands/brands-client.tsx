"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface BrandRow {
  id: string;
  name: string;
  slug: string;
  color_palette: Record<string, string> | null;
  protected_terms: string[] | null;
  created_at: string;
}

interface BrandsClientProps {
  brands: BrandRow[];
}

interface FormState {
  name: string;
  slug: string;
  colorPaletteJson: string;
  protectedTerms: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  slug: "",
  colorPaletteJson: JSON.stringify(
    { primary: "#000000", secondary: "#ffffff", accent: "#cccccc", background: "#f5f5f5", text: "#333333" },
    null,
    2
  ),
  protectedTerms: "",
};

function ColorDots({ palette }: { palette: Record<string, string> | null }) {
  if (!palette) return <span className="text-xs text-muted-foreground">—</span>;
  const colors = Object.values(palette).slice(0, 5);
  return (
    <div className="flex items-center gap-1">
      {colors.map((color, i) => (
        <span
          key={i}
          className="inline-block h-4 w-4 rounded-full border border-border"
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}
    </div>
  );
}

function TermsTags({ terms }: { terms: string[] | null }) {
  if (!terms || terms.length === 0)
    return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {terms.slice(0, 4).map((term) => (
        <span
          key={term}
          className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
        >
          {term}
        </span>
      ))}
      {terms.length > 4 && (
        <span className="text-xs text-muted-foreground">+{terms.length - 4}</span>
      )}
    </div>
  );
}

export function BrandsClient({ brands: initialBrands }: BrandsClientProps) {
  const router = useRouter();
  const [brands, setBrands] = useState(initialBrands);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(brand: BrandRow) {
    setEditingId(brand.id);
    setForm({
      name: brand.name,
      slug: brand.slug,
      colorPaletteJson: brand.color_palette
        ? JSON.stringify(brand.color_palette, null, 2)
        : EMPTY_FORM.colorPaletteJson,
      protectedTerms: brand.protected_terms?.join(", ") ?? "",
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.slug.trim()) return;

    let colorPalette: Record<string, string> | null = null;
    try {
      colorPalette = JSON.parse(form.colorPaletteJson) as Record<string, string>;
    } catch {
      alert("색상 팔레트 JSON 형식이 올바르지 않습니다.");
      return;
    }

    const protectedTerms = form.protectedTerms
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const isEdit = editingId !== null;
      const res = await fetch("/api/admin/brands", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEdit ? { id: editingId } : {}),
          name: form.name.trim(),
          slug: form.slug.trim(),
          color_palette: colorPalette,
          protected_terms: protectedTerms,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error ?? "저장에 실패했습니다.");
        return;
      }

      router.refresh();
      cancelForm();

      // Optimistic update
      const data = (await res.json()) as { brand: BrandRow };
      if (isEdit) {
        setBrands((prev) =>
          prev.map((b) => (b.id === editingId ? data.brand : b))
        );
      } else {
        setBrands((prev) => [...prev, data.brand]);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 브랜드를 삭제하시겠습니까?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/brands?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error ?? "삭제에 실패했습니다.");
        return;
      }
      setBrands((prev) => prev.filter((b) => b.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          총 {brands.length}개의 브랜드
        </p>
        <button
          onClick={openCreate}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          브랜드 추가
        </button>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h2 className="text-base font-medium">
            {editingId ? "브랜드 수정" : "새 브랜드 추가"}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">브랜드명</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="세라클리닉"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">슬러그</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="seraclinic"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              색상 팔레트 (JSON)
            </label>
            <textarea
              value={form.colorPaletteJson}
              onChange={(e) =>
                setForm((f) => ({ ...f, colorPaletteJson: e.target.value }))
              }
              rows={5}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              보호 용어 (쉼표로 구분)
            </label>
            <input
              type="text"
              value={form.protectedTerms}
              onChange={(e) =>
                setForm((f) => ({ ...f, protectedTerms: e.target.value }))
              }
              placeholder="세라마이드, 히알루론산, ..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={saving || !form.name.trim() || !form.slug.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "저장 중..." : editingId ? "수정하기" : "추가하기"}
            </button>
            <button
              onClick={cancelForm}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Brand Cards */}
      {brands.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <div
              key={brand.id}
              className="rounded-lg border border-border bg-card p-5 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-foreground">{brand.name}</p>
                  <p className="text-xs text-muted-foreground">{brand.slug}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(brand)}
                    className="rounded px-2 py-1 text-xs border border-border text-muted-foreground hover:bg-muted"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(brand.id, brand.name)}
                    disabled={deletingId === brand.id}
                    className="rounded px-2 py-1 text-xs border border-destructive text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {deletingId === brand.id ? "삭제 중..." : "삭제"}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">색상</p>
                <ColorDots palette={brand.color_palette} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">보호 용어</p>
                <TermsTags terms={brand.protected_terms} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-muted-foreground">
            등록된 브랜드가 없습니다.
          </div>
        )
      )}
    </div>
  );
}
