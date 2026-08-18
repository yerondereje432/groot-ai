"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";
import { SubjectGrid, type Subject } from "@/components/SubjectGrid";
import { Shell, TopNav, GrootMark, PageContainer, Glass, Badge, GhostButton, Eyebrow, I } from "@/components/ui";

interface RecentSession {
  id: string; 
  title: string | null; 
  updated_at: string;
  subjectName: string;
}

export function DashboardClient({
  studentName, gradeLabel, subjects, recentSessions,
}: {
  studentName: string; gradeLabel: string; subjects: Subject[]; recentSessions: RecentSession[];
}) {
  const router = useRouter();
  const supabase = createClient();

  async function handleSelectSubject(subject: Subject) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Fetch student's grade from the 'users' table
    const { data: userData } = await supabase.from("users").select("grade").eq("id", user.id).single();
    if (!userData?.grade) return;

    // 2. Create a new tutor session (matches Prisma model 'TutorSession')
    const { data: session, error } = await supabase.from("tutor_sessions")
      .insert({ 
        userId: user.id, 
        subjectId: subject.id, 
        grade: userData.grade,
        locale: 'en' // Default locale
      })
      .select("id").single();
    
    if (error) {
      console.error("Session Create Error:", error);
      return;
    }

    if (session) router.push(`/chat/${session.id}`);
  }

  async function signOut() { await supabase.auth.signOut(); router.push("/signin"); router.refresh(); }

  const firstName = studentName.split(" ")[0];

  return (
    <Shell>
      <TopNav
        left={<GrootMark />}
        right={
          <>
            <span className="hidden sm:inline text-[12.5px] text-ink-soft mr-1">{studentName}</span>
            <Badge tone="verdigris">{gradeLabel}</Badge>
            <GhostButton onClick={signOut}>Sign out</GhostButton>
          </>
        }
      />
      <PageContainer>
        {/* hero lab bar */}
        <div className="mb-9 fade-up">
          <Eyebrow>Study deck · {gradeLabel}</Eyebrow>
          <h1 className="font-display text-[36px] sm:text-[44px] tracking-tight text-ink leading-[1.05] mt-2">
            Good to see you, <span className="text-verdigris-bright">{firstName}</span>.
          </h1>
          <p className="text-[14.5px] text-ink-soft mt-3 max-w-xl">
            Pick a subject to start a curriculum-grounded tutoring session. Every answer is cited from your {gradeLabel} textbook.
          </p>
        </div>

        {/* subjects */}
        <div className="mb-10">
          <div className="flex items-end justify-between mb-4">
            <div>
              <Eyebrow>Subjects</Eyebrow>
              <h2 className="font-display text-[26px] text-ink mt-1">Choose a subject</h2>
            </div>
            <span className="text-[11px] text-ink-faint font-mono hidden sm:block">RAG · grade-locked</span>
          </div>
          <SubjectGrid subjects={subjects} onSelect={handleSelectSubject} />
        </div>

        {/* recent + tools */}
        <div className="grid lg:grid-cols-[1.38fr_.88fr] gap-4">
          <Glass>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-[20px] text-ink">Recent sessions</h3>
              <span className="text-[11px] text-ink-faint font-mono">{recentSessions.length} total</span>
            </div>
            {recentSessions.length === 0 ? (
              <div className="py-8 text-center text-[13.5px] text-ink-soft">No sessions yet. Select a subject above.</div>
            ) : (
              <div className="space-y-2.5">
                {recentSessions.map((session) => (
                  <button key={session.id} onClick={() => router.push(`/chat/${session.id}`)}
                    className="w-full flex items-center justify-between rounded-[16px] border border-glassline bg-white/[0.022] px-4 py-3.5 text-left hover:bg-white/[0.042] hover:border-glassline2 transition-all group">
                    <div>
                      <div className="text-[14px] font-medium text-ink">{session.title}</div>
                      <div className="text-[12px] text-ink-soft mt-0.5">{session.subjectName} · {new Date(session.updated_at).toLocaleDateString("en-US", { month:"short", day:"numeric"})}</div>
                    </div>
                    <span className="text-ink-faint group-hover:text-ink-soft"><I.arrowRight /></span>
                  </button>
                ))}
              </div>
            )}
          </Glass>

          <div className="space-y-4">
            <Glass>
              <div className="flex items-center gap-2 text-verdigris-bright mb-2"><I.flask /><Eyebrow>Study tools</Eyebrow></div>
              <h3 className="font-display text-[19px] text-ink mb-1">Quiz generator</h3>
              <p className="text-[13px] text-ink-soft mb-3 leading-relaxed">Chapter-scoped MCQs pulled from your textbook chunks.</p>
              {subjects[0] && (
                <Link href={`/quiz/${subjects[0].id}/${gradeLabel.replace('Grade ', '')}`} className="text-[13px] text-verdigris-bright font-medium hover:text-verdigris">Browse quizzes →</Link>
              )}
            </Glass>
            <Glass className="bg-white/[0.022]">
              <div className="flex items-center gap-2 text-amber mb-2"><I.book /><Eyebrow>How Groot works</Eyebrow></div>
              <ul className="text-[12.5px] text-ink-soft space-y-1.5 leading-relaxed">
                <li>• Grade + subject filter runs <em className="text-ink-soft">before</em> vector search</li>
                <li>• Every answer cites chapter & section</li>
                <li>• No open-web fallback</li>
                <li>• Supabase RLS isolates student data</li>
              </ul>
            </Glass>
          </div>
        </div>
      </PageContainer>
    </Shell>
  );
}
