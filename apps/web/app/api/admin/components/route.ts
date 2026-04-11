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

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get("brand_id");

  const serviceClient = createAdminClient();
  let query = serviceClient
    .from("components")
    .select(
      "id, name, category, version, thumbnail_url, brand_id, text_slots, image_slots, created_at, updated_at"
    )
    .order("brand_id")
    .order("name");

  if (brandId) {
    query = query.eq("brand_id", brandId);
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ components: data });
}

interface PatchBody {
  id: string;
  name?: string;
  category?: string;
  text_slots?: unknown[];
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

  const { id, ...patch } = body;

  if (!id) {
    return NextResponse.json({ error: "id는 필수입니다." }, { status: 400 });
  }

  const serviceClient = createAdminClient();
  const { data, error: dbError } = await serviceClient
    .from("components")
    .update(patch)
    .eq("id", id)
    .select(
      "id, name, category, version, thumbnail_url, brand_id, text_slots, created_at"
    )
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ component: data });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id는 필수입니다." }, { status: 400 });
  }

  const serviceClient = createAdminClient();
  const { error: dbError } = await serviceClient
    .from("components")
    .delete()
    .eq("id", id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
