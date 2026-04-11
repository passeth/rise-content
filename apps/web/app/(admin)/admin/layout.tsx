import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium text-foreground">
            관리자 권한이 필요합니다
          </p>
          <Link
            href="/projects"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            프로젝트 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: "/admin/users", label: "사용자 관리" },
    { href: "/admin/brands", label: "브랜드 관리" },
    { href: "/admin/components", label: "컴포넌트 관리" },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border bg-card flex flex-col">
        <div className="px-6 py-5 border-b border-border">
          <Link href="/admin" className="text-sm font-semibold text-foreground">
            EVAS Admin
          </Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-border">
          <Link
            href="/projects"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← 프로젝트 목록
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
