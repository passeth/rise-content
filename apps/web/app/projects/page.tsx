import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectsClient } from "./projects-client";

export default async function ProjectsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, created_at, updated_at, brands(id, name, slug)")
    .order("updated_at", { ascending: false });

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, slug")
    .order("name");

  return (
    <ProjectsClient
      projects={projects ?? []}
      brands={brands ?? []}
    />
  );
}
