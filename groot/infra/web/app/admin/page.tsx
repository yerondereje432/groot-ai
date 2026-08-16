"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell, TopNav, GrootMark, PageContainer, Glass, Badge, Eyebrow } from "@/components/ui";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

interface Textbook { id: string; title: string; publisher: string | null; edition_year: number | null; ingestion_status: string; grades: any; subjects: any; }
interface Analytics { total_questions_answered: number; average_retrieval_confidence: number | null; low_confidence_answer_count: number; event_counts: Record<string, number>; }

export default function AdminDashboard() {
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(()=>{(async()=>{
    try {
      const [tRes, aRes] = await Promise.all([fetch(`${BACKEND_URL}/admin/textbooks`), fetch(`${BACKEND_URL}/admin/analytics/overview`)]);
      if (!tRes.ok || !aRes.ok) throw new Error();
      setTextbooks(await tRes.json());
      setAnalytics(await aRes.json());
    } catch { setError(`Couldn't reach ${BACKEND_URL}`); }
    finally { setLoading(false); }
  })()}, []);

  const labelFrom = (f:any,key:string)=> !f ? "—" : (Array.isArray(f) ? f[0] : f)?.[key] ?? "—";

  return (
    <Shell>
      <TopNav left={<GrootMark />} right={<Link href="/dashboard" className="text-[13px] text-ink-soft hover:text-ink">Student view →</Link>} />
      <PageContainer>
        <Eyebrow>SEDECIA Admin</Eyebrow>
        <h1 className="font-display text-[32px] text-ink tracking-tight mt-2 mb-1">Textbook ingestion & usage</h1>
        <p className="text-[14px] text-ink-soft mb-7">FastAPI admin endpoints · gate behind role-check middleware.</p>
        {error && <div className="bg-[rgba(255,107,107,0.07)] border border-[rgba(255,107,107,0.25)] text-danger text-[12.5px] rounded-[14px] px-3 py-2.5 mb-6">{error}</div>}
        {loading ? <div className="text-[13px] text-ink-faint">Loading…</div> : <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              ["Questions answered", analytics?.total_questions_answered ?? 0],
              ["Avg. retrieval", analytics?.average_retrieval_confidence != null ? analytics.average_retrieval_confidence.toFixed(2) : "—"],
              ["Low-confidence", analytics?.low_confidence_answer_count ?? 0],
              ["Quizzes completed", analytics?.event_counts?.["quiz_completed"] ?? 0],
            ].map(([label,val])=>(
              <Glass key={label as string}>
                <div className="text-[11px] text-ink-faint uppercase tracking-wider mb-1 font-mono">{label}</div>
                <div className="font-display text-[28px] text-ink">{val as any}</div>
              </Glass>
            ))}
          </div>
          <Glass padding={false}>
            <div className="px-5 pt-5 pb-3 border-b border-glassline"><h2 className="font-display text-[18px] text-ink">Textbooks</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13.5px]">
                <thead>
                  <tr className="text-[11px] text-ink-faint uppercase tracking-wider font-mono border-b border-glassline">
                    <th className="px-5 py-3 font-medium">Title</th>
                    <th className="px-5 py-3 font-medium">Grade</th>
                    <th className="px-5 py-3 font-medium">Subject</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {textbooks.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-ink-faint">No textbooks registered yet.</td></tr>}
                  {textbooks.map(tb=>(
                    <tr key={tb.id} className="border-t border-glassline/65">
                      <td className="px-5 py-3.5 font-medium text-ink">{tb.title}</td>
                      <td className="px-5 py-3.5 text-ink-soft font-mono text-[12px]">{labelFrom(tb.grades,"label")}</td>
                      <td className="px-5 py-3.5 text-ink-soft font-mono text-[12px]">{labelFrom(tb.subjects,"name")}</td>
                      <td className="px-5 py-3.5"><Badge tone={tb.ingestion_status==="ready" ? "verdigris" : "neutral"}>{tb.ingestion_status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Glass>
        </>}
      </PageContainer>
    </Shell>
  );
}
