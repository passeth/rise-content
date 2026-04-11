"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FolderOpen, Plus, Clock } from "lucide-react";

interface ProjectItem {
  id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  brands: Array<{ id: string; name: string; slug: string }> | null;
}

interface BrandItem {
  id: string;
  name: string;
  slug: string;
}

interface ProjectsClientProps {
  projects: ProjectItem[];
  brands: BrandItem[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: "초안",
  in_progress: "작업 중",
  completed: "완료",
};

export function ProjectsClient({ projects, brands }: ProjectsClientProps) {
  const router = useRouter();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBrandId, setNewBrandId] = useState(brands[0]?.id ?? "");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!newName.trim() || !newBrandId) return;
    setCreating(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: newName.trim(),
        brand_id: newBrandId,
        user_id: user.id,
      })
      .select("id")
      .single();

    if (data && !error) {
      router.push(`/editor/${data.id}`);
    }
    setCreating(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">내 프로젝트</h1>
          <button
            onClick={() => setShowNewDialog(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            새 프로젝트
          </button>
        </div>

        {/* New Project Dialog */}
        {showNewDialog && (
          <div className="mt-6 rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-medium mb-4">새 프로젝트 만들기</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">프로젝트 이름</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예: 세라클리닉 세라마이드 크림 상세페이지"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">브랜드</label>
                <select
                  value={newBrandId}
                  onChange={(e) => setNewBrandId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {creating ? "생성 중..." : "만들기"}
                </button>
                <button
                  onClick={() => setShowNewDialog(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Project List */}
        {projects.length > 0 ? (
          <div className="mt-8 grid gap-4">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => router.push(`/editor/${project.id}`)}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 text-left hover:bg-accent/50 transition-colors"
              >
                <div className="rounded-md bg-muted p-2">
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{project.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {project.brands?.[0]?.name ?? ""}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {STATUS_LABELS[project.status] ?? project.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(project.updated_at).toLocaleDateString("ko-KR")}
                </div>
              </button>
            ))}
          </div>
        ) : (
          !showNewDialog && (
            <div className="mt-16 flex flex-col items-center justify-center text-center">
              <div className="rounded-full bg-muted p-6">
                <FolderOpen className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="mt-4 text-base font-medium text-foreground">
                아직 프로젝트가 없습니다.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                새 프로젝트를 만들어 상세페이지 제작을 시작하세요.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
