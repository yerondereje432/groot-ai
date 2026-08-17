"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";
import { QuizView } from "@/components/QuizView";
import { Shell, TopNav, GrootMark, PageContainer, Glass, Badge, Eyebrow } from "@/components/ui";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
interface Chapter { id: string; chapter_number: number; title: string; }
interface QuizQuestion { question_text: string; question_type: "multiple_choice" | "short_answer"; options: string[] | null; correct_answer: string; explanation: string; source_chunk_id: string; }

export default function QuizPage({ params }: { params: { subjectId: string; gradeId: string } }) {
  const router = useRouter(); const supabase = createClient();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [quiz, setQuiz] = useState<{ title: string; questions: QuizQuestion[] } | null>(null);
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);

  useEffect(()=>{(async()=>{
    const { data: textbooks } = await supabase.from("textbooks").select("id")
      .eq("subject_id", params.subjectId).eq("grade_id", params.gradeId).eq("ingestion_status","ready");
    if (!textbooks || textbooks.length===0) { setChapters([]); return; }
    const { data } = await supabase.from("chapters").select("id, chapter_number, title")
      .in("textbook_id", textbooks.map(t=>t.id)).order("chapter_number");
    setChapters(data ?? []);
  })()}, [params.subjectId, params.gradeId]);

  async function handleGenerateQuiz(chapter: Chapter) {
    setSelectedChapter(chapter); setLoading(true); setError(null); setQuiz(null);
    const { data:{ user } } = await supabase.auth.getUser();
    if (!user) { router.push("/signin"); return; }
    try {
      const res = await fetch(`${BACKEND_URL}/quiz/generate`, { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ student_id: user.id, grade_id: params.gradeId, subject_id: params.subjectId, chapter_id: chapter.id, question_count:5 })
      });
      if (!res.ok) { const body = await res.json().catch(()=>null); throw new Error(body?.detail ?? "Quiz generation failed"); }
      const data = await res.json(); setQuiz({ title: data.title, questions: data.questions });
    } catch(err) { setError(err instanceof Error ? err.message : "Quiz generation failed"); }
    finally { setLoading(false); }
  }

  if (quiz) return (
    <Shell>
      <TopNav left={<Link href="/dashboard"><GrootMark /></Link>} right={<Link href="/dashboard" className="text-[13px] text-ink-soft hover:text-ink">Dashboard</Link>} />
      <QuizView title={quiz.title} questions={quiz.questions} onRetake={()=> selectedChapter && handleGenerateQuiz(selectedChapter)} />
    </Shell>
  );

  return (
    <Shell>
      <TopNav left={<Link href="/dashboard"><GrootMark /></Link>} right={<Badge tone="verdigris">Chapter-scoped</Badge>} />
      <PageContainer narrow>
        <Eyebrow>Quiz generator</Eyebrow>
        <h1 className="font-display text-[32px] text-ink tracking-tight mb-1 mt-2">Choose a chapter</h1>
        <p className="text-[14px] text-ink-soft mb-6">Quizzes generated from ingested textbook content only.</p>
        {chapters.length===0 && !loading && <Glass><p className="text-[13.5px] text-ink-soft">No ingested chapters yet for this subject.</p></Glass>}
        <div className="space-y-2.5">
          {chapters.map(ch=>(
            <button key={ch.id} onClick={()=>handleGenerateQuiz(ch)} disabled={loading}
              className="w-full text-left glass glass-hover px-4 py-4 disabled:opacity-50">
              <span className="font-mono text-[11px] text-ink-faint mr-2">Ch. {ch.chapter_number}</span>
              <span className="text-[14px] font-medium text-ink">{ch.title}</span>
            </button>
          ))}
        </div>
        {loading && <p className="text-[13px] text-ink-faint mt-4">Building your quiz from {selectedChapter?.title}…</p>}
        {error && <div className="mt-4 bg-[rgba(255,107,107,0.07)] border border-[rgba(255,107,107,0.25)] text-danger text-[12.5px] rounded-[14px] px-3 py-2.5">{error}</div>}
      </PageContainer>
    </Shell>
  );
}
