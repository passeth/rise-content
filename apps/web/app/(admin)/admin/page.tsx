import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();

  const [
    { count: usersCount },
    { count: projectsCount },
    { count: brandsCount },
    { count: componentsCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase.from("brands").select("*", { count: "exact", head: true }),
    supabase.from("components").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "전체 사용자", value: usersCount ?? 0 },
    { label: "전체 프로젝트", value: projectsCount ?? 0 },
    { label: "전체 브랜드", value: brandsCount ?? 0 },
    { label: "전체 컴포넌트", value: componentsCount ?? 0 },
  ];

  return (
    <div className="px-8 py-10">
      <h1 className="text-2xl font-semibold text-foreground mb-8">
        관리자 대시보드
      </h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-card p-6"
          >
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
