import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { DashboardClient } from "./dashboard-client";

/**
 * DashboardPage — server component. Loads the student's profile, enrolled
 * subjects, and recent chat sessions in one pass before render, so the
 * dashboard never shows a loading skeleton for data RLS already scopes
 * to this exact student.
 */
export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, current_grade_id, grades(label, curriculum_id)")
    .eq("id", user.id)
    .single();

  if (!profile?.current_grade_id) {
    redirect("/onboarding");
  }

  const curriculumId = (profile.grades as any)?.curriculum_id;

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, slug")
    .eq("curriculum_id", curriculumId)
    .order("name");

  const { data: recentSessions } = await supabase
    .from("chat_sessions")
    .select("id, title, updated_at, subjects(name)")
    .eq("student_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(5);

  return (
    <DashboardClient
      studentName={profile.full_name ?? "Student"}
      gradeLabel={(profile.grades as any)?.label ?? ""}
      subjects={subjects ?? []}
      recentSessions={recentSessions ?? []}
    />
  );
}
