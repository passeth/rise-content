import { createAdminClient } from "@/lib/supabase/admin";
import { UsersClient } from "./users-client";

export default async function AdminUsersPage() {
  const supabase = createAdminClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, gemini_api_key, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="px-8 py-10">
      <h1 className="text-2xl font-semibold text-foreground mb-8">
        사용자 관리
      </h1>
      <UsersClient profiles={profiles ?? []} />
    </div>
  );
}
