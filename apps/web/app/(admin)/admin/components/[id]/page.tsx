import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ComponentEditor } from "./component-editor";
import type { TextSlotTemplate, ImageSlotTemplate } from "@/lib/types/brand";
import type { ComponentCategory, LayoutType } from "@/lib/types/brand";

interface ComponentRow {
  id: string;
  name: string;
  category: ComponentCategory;
  layout_type: LayoutType | null;
  figma_file_key: string | null;
  figma_node_id: string | null;
  version: number;
  thumbnail_url: string | null;
  brand_id: string;
  template_data: Record<string, unknown> | null;
  text_slots: TextSlotTemplate[] | null;
  image_slots: ImageSlotTemplate[] | null;
  created_at: string;
  updated_at: string;
}

interface BrandRow {
  id: string;
  name: string;
  slug: string;
}

export default async function ComponentEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createAdminClient();

  const [{ data: component }, { data: brands }] = await Promise.all([
    supabase
      .from("components")
      .select(
        "id, name, category, layout_type, figma_file_key, figma_node_id, version, thumbnail_url, brand_id, template_data, text_slots, image_slots, created_at, updated_at"
      )
      .eq("id", params.id)
      .single<ComponentRow>(),
    supabase.from("brands").select("id, name, slug").order("name"),
  ]);

  if (!component) {
    notFound();
  }

  const brandName =
    (brands ?? []).find((b: BrandRow) => b.id === component.brand_id)?.name ??
    component.brand_id;

  return (
    <div className="px-8 py-10">
      <ComponentEditor component={component} brandName={brandName} />
    </div>
  );
}
