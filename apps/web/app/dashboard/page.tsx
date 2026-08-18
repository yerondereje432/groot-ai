import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { DashboardClient } from "./dashboard-client";

/**
 * DashboardPage — server component.
 * Updated to match the Prisma/Production schema (users table, Int grades).
 */
export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  // Fetch from 'users' table (Prisma model) instead of 'profiles'
  const { data: userData } = await supabase
    .from("users")
    .select("fullName, grade")
    .eq("id", user.id)
    .single();

  // If the user hasn't completed signup/onboarding, send them to signin
  if (!userData?.grade) {
    redirect("/signup"); 
  }

  // Fetch subjects for this student's grade (Including SLUG to satisfy TypeScript)
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, slug")
    .eq("grade", userData.grade)
    .order("name");

  // Fetch recent tutor sessions with subject name join
  const { data: recentSessionsRaw } = await supabase
    .from("tutor_sessions")
    .select("id, createdAt, subjects(name)")
    .eq("userId", user.id)
    .order("createdAt", { ascending: false })
    .limit(5);

  return (
    <DashboardClient
      studentName={userData.fullName ?? "Student"}
      gradeLabel={`Grade ${userData.grade}`}
      subjects={subjects ?? []}
      recentSessions={(recentSessionsRaw ?? []).map((s: any) => ({
        id: s.id,
        title: `Session in ${s.subjects?.name ?? 'General'}`,
        updated_at: s.createdAt,
        subjectName: s.subjects?.name ?? 'General'
      }))}
    />
  );
}
