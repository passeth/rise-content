import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 }) };
  }

  return { error: null };
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const serviceClient = createAdminClient();
  const { data, error: dbError } = await serviceClient
    .from("profiles")
    .select("id, full_name, email, role, gemini_api_key, created_at")
    .order("created_at", { ascending: false });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ profiles: data });
}

interface PatchBody {
  userId: string;
  role?: string;
  gemini_api_key?: string | null;
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const { userId, role, gemini_api_key } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId는 필수입니다." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (role !== undefined) patch.role = role;
  if (gemini_api_key !== undefined) patch.gemini_api_key = gemini_api_key;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "변경할 항목이 없습니다." }, { status: 400 });
  }

  const serviceClient = createAdminClient();
  const { data, error: dbError } = await serviceClient
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("id, full_name, email, role, created_at")
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
