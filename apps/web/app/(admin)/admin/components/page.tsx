import { createAdminClient } from "@/lib/supabase/admin";
import { ComponentsClient } from "./components-client";

export default async function AdminComponentsPage() {
  const supabase = createAdminClient();

  const [{ data: components }, { data: brands }] = await Promise.all([
    supabase
      .from("components")
      .select(
        "id, name, category, layout_type, version, thumbnail_url, brand_id, text_slots, created_at"
      )
      .order("brand_id")
      .order("name"),
    supabase.from("brands").select("id, name, slug").order("name"),
  ]);

  return (
    <div className="px-8 py-10">
      <h1 className="text-2xl font-semibold text-foreground mb-8">
        컴포넌트 관리
      </h1>
      <ComponentsClient
        components={components ?? []}
        brands={brands ?? []}
      />
    </div>
  );
}
