"use client";

import { useState } from "react";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  gemini_api_key: string | null;
  created_at: string;
}

interface UsersClientProps {
  profiles: Profile[];
}

type EditState = {
  role: string;
  apiKey: string;
  showApiKey: boolean;
  saving: boolean;
};

const ROLES = ["admin", "editor", "viewer"];

export function UsersClient({ profiles }: UsersClientProps) {
  const [editStates, setEditStates] = useState<Record<string, EditState>>(
    () => {
      const init: Record<string, EditState> = {};
      for (const p of profiles) {
        init[p.id] = {
          role: p.role ?? "viewer",
          apiKey: p.gemini_api_key ?? "",
          showApiKey: false,
          saving: false,
        };
      }
      return init;
    }
  );

  function update(id: string, patch: Partial<EditState>) {
    setEditStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleSave(profile: Profile) {
    const state = editStates[profile.id];
    if (!state) return;
    update(profile.id, { saving: true });

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.id,
          role: state.role,
          gemini_api_key: state.apiKey || null,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error ?? "저장에 실패했습니다.");
      }
    } finally {
      update(profile.id, { saving: false });
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              이름
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              이메일
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              역할
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              API 키
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              가입일
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              저장
            </th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile) => {
            const state = editStates[profile.id];
            if (!state) return null;
            return (
              <tr
                key={profile.id}
                className="border-b border-border last:border-0 hover:bg-muted/30"
              >
                <td className="px-4 py-3 text-foreground">
                  {profile.full_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {profile.email ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={state.role}
                    onChange={(e) =>
                      update(profile.id, { role: e.target.value })
                    }
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      type={state.showApiKey ? "text" : "password"}
                      value={state.apiKey}
                      onChange={(e) =>
                        update(profile.id, { apiKey: e.target.value })
                      }
                      placeholder="API 키 없음"
                      className="w-48 rounded-md border border-border bg-background px-2 py-1 text-sm font-mono"
                    />
                    <button
                      onClick={() =>
                        update(profile.id, { showApiKey: !state.showApiKey })
                      }
                      className="rounded px-2 py-1 text-xs text-muted-foreground border border-border hover:bg-muted"
                    >
                      {state.showApiKey ? "숨기기" : "보기"}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {new Date(profile.created_at).toLocaleDateString("ko-KR")}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleSave(profile)}
                    disabled={state.saving}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {state.saving ? "저장 중..." : "저장"}
                  </button>
                </td>
              </tr>
            );
          })}
          {profiles.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                사용자가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
