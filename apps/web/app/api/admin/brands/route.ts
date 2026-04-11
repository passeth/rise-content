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
    .from("brands")
    .select("id, name, slug, color_palette, protected_terms, created_at")
    .order("name");

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ brands: data });
}

interface BrandBody {
  id?: string;
  name: string;
  slug: string;
  color_palette?: Record<string, string> | null;
  protected_terms?: string[];
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: BrandBody;
  try {
    body = (await req.json()) as BrandBody;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const { name, slug, color_palette, protected_terms } = body;

  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json(
      { error: "name과 slug는 필수입니다." },
      { status: 400 }
    );
  }

  const serviceClient = createAdminClient();
  const { data, error: dbError } = await serviceClient
    .from("brands")
    .insert({ name: name.trim(), slug: slug.trim(), color_palette, protected_terms })
    .select("id, name, slug, color_palette, protected_terms, created_at")
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ brand: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: BrandBody;
  try {
    body = (await req.json()) as BrandBody;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const { id, name, slug, color_palette, protected_terms } = body;

  if (!id) {
    return NextResponse.json({ error: "id는 필수입니다." }, { status: 400 });
  }

  const serviceClient = createAdminClient();
  const { data, error: dbError } = await serviceClient
    .from("brands")
    .update({ name: name?.trim(), slug: slug?.trim(), color_palette, protected_terms })
    .eq("id", id)
    .select("id, name, slug, color_palette, protected_terms, created_at")
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ brand: data });
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
    .from("brands")
    .delete()
    .eq("id", id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
