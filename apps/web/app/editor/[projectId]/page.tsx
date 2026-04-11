import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditorShell } from "./editor-shell";

interface EditorPageProps {
  params: { projectId: string };
}

export default async function EditorPage({ params }: EditorPageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*, brands(*)")
    .eq("id", params.projectId)
    .single();

  if (!project) {
    redirect("/projects");
  }

  return <EditorShell project={project} />;
}
