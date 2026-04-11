import { createAdminClient } from "@/lib/supabase/admin";
import { BrandsClient } from "./brands-client";

export default async function AdminBrandsPage() {
  const supabase = createAdminClient();

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, slug, color_palette, protected_terms, created_at")
    .order("name");

  return (
    <div className="px-8 py-10">
      <h1 className="text-2xl font-semibold text-foreground mb-8">
        브랜드 관리
      </h1>
      <BrandsClient brands={brands ?? []} />
    </div>
  );
}
