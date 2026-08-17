"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { Shell, GrootMark, Glass, Field, Select, PrimaryButton, Eyebrow } from "@/components/ui";

interface CurriculumOption { id: string; name: string; }
interface GradeOption { id: string; level: number; label: string; curriculum_id: string; }

const DEFAULT_CURRICULA: CurriculumOption[] = [
  { id: "ethiopian-national", name: "Ethiopian National Curriculum" }
];

const DEFAULT_GRADES: GradeOption[] = [
  { id: "g9", level: 9, label: "Grade 9", curriculum_id: "ethiopian-national" },
  { id: "g10", level: 10, label: "Grade 10", curriculum_id: "ethiopian-national" },
  { id: "g11", level: 11, label: "Grade 11", curriculum_id: "ethiopian-national" },
  { id: "g12", level: 12, label: "Grade 12", curriculum_id: "ethiopian-national" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [curricula, setCurricula] = useState<CurriculumOption[]>(DEFAULT_CURRICULA);
  const [grades, setGrades] = useState<GradeOption[]>(DEFAULT_GRADES);
  const [curriculumId, setCurriculumId] = useState("ethiopian-national");
  const [gradeId, setGradeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("curricula").select("id, name").then(({ data }) => {
      if (data && data.length > 0) { setCurricula(data); if (data.length === 1) setCurriculumId(data[0].id); }
    });
  }, []);

  useEffect(() => {
    if (!curriculumId) { return; }
    supabase.from("grades").select("id, level, label, curriculum_id").eq("curriculum_id", curriculumId).order("level")
      .then(({ data }) => {
        if (data && data.length > 0) {
          const map = new Map<number, GradeOption>();
          for (const item of data) {
            if (!map.has(item.level)) map.set(item.level, item);
          }
          setGrades(Array.from(map.values()).sort((a, b) => a.level - b.level));
        }
      });
  }, [curriculumId]);

  async function handleSave() {
    setError(null);
    if (!gradeId) { setError("Select your grade to continue."); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/signin"); return; }
    const { error: updateError } = await supabase.from("profiles").update({ current_grade_id: gradeId, curriculum_id: curriculumId }).eq("id", user.id);
    if (updateError) { setError("Couldn't save your grade. Try again."); setSaving(false); return; }
    router.push("/dashboard");
  }

  return (
    <Shell>
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="w-full max-w-[460px] fade-up">
          <div className="flex justify-center mb-6"><GrootMark /></div>
          <Glass strong className="shadow-glass">
            <Eyebrow>One more step</Eyebrow>
            <h1 className="font-display text-[30px] tracking-tight text-ink mt-2 mb-1.5">Set your grade</h1>
            <p className="text-[13.5px] text-ink-soft mb-6 leading-relaxed">
              Groot filters every retrieval by grade before vector search runs. Pick once — it locks your curriculum.
            </p>
            <div className="space-y-4">
              {curricula.length > 1 && (
                <Field label="Curriculum">
                  <Select value={curriculumId} onChange={e=>{ setCurriculumId(e.target.value); setGradeId(""); }}>
                    <option value="">Select…</option>
                    {curricula.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </Field>
              )}
              <Field label="Grade" hint="Ethiopian national curriculum">
                <Select value={gradeId} onChange={e=>setGradeId(e.target.value)} disabled={!curriculumId || grades.length===0}>
                  <option value="">{grades.length ? "Select grade…" : "Choose a curriculum first"}</option>
                  {grades.map(g=> <option key={g.id} value={g.id}>{g.label}</option>)}
                </Select>
              </Field>
              {error && <div className="bg-[rgba(255,107,107,0.07)] border border-[rgba(255,107,107,0.25)] text-danger text-[12.5px] rounded-[14px] px-3 py-2.5">{error}</div>}
              <PrimaryButton onClick={handleSave} disabled={saving || !gradeId} className="w-full">
                {saving ? "Saving…" : "Continue to Groot"}
              </PrimaryButton>
            </div>
          </Glass>
          <p className="text-[11px] text-ink-faint text-center mt-4 font-mono">Grade 9–12 · curriculum-locked RAG</p>
        </div>
      </div>
    </Shell>
  );
}
