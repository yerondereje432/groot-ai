"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";
import { Shell, GrootMark, Glass, Field, Input, Select, PrimaryButton, Eyebrow } from "@/components/ui";

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [grade, setGrade] = useState(""); 
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Hardcoded grades to match the Ethiopian curriculum levels
  // This solves the "empty dropdown" issue because we no longer depend on a missing DB table.
  const grades = [
    { level: 9, label: "Grade 9" },
    { level: 10, label: "Grade 10" },
    { level: 11, label: "Grade 11" },
    { level: 12, label: "Grade 12" },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); 
    setError(null);

    if (!grade) { 
      setError("Select your grade — Groot needs this to answer from the right textbook."); 
      return; 
    }

    setSubmitting(true);

    // 1. Sign up user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          full_name: fullName,
          role: "student",
          grade: parseInt(grade, 10),
        }
      }
    });
    
    if (authError || !authData.user) { 
      setError(authError?.message ?? "Could not create your account."); 
      setSubmitting(false); 
      return; 
    }

    // 2. Create profile in the 'users' table (matches Prisma schema model 'User')
    // Note: We use column names from schema.prisma (fullName, role, grade, phone)
    const { error: profileError } = await supabase.from("users").upsert({
      id: authData.user.id, 
      fullName: fullName, 
      role: "student",
      grade: parseInt(grade, 10),
      email: email,
      phone: `user_${authData.user.id.slice(0, 8)}`, // Prisma requires a unique phone string
    }, { 
      onConflict: "id" 
    });

    if (profileError) { 
      console.error("Profile Error:", profileError);
      setError("Account created, but database profile failed: " + profileError.message); 
      setSubmitting(false); 
      return; 
    }

    router.push("/dashboard"); 
    router.refresh();
  }

  return (
    <Shell>
      <div className="border-b border-glassline" style={{background:"rgba(7,19,21,0.5)", backdropFilter:"blur(14px)"}}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <GrootMark />
          <Link href="/signin" className="text-[13px] text-ink-soft hover:text-ink">Sign in</Link>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-14 min-h-[calc(100vh-56px)]">
        <div className="w-full max-w-[460px]">
          <Glass strong className="shadow-glass fade-up">
            <Eyebrow>Get started</Eyebrow>
            <h2 className="font-display text-[30px] tracking-tight text-ink mt-2 mb-1">Create your account</h2>
            <p className="text-[13.5px] text-ink-soft mb-6">Your grade locks the curriculum scope.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Full name">
                <Input value={fullName} onChange={e=>setFullName(e.target.value)} required placeholder="Hana Tadesse" />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Email">
                  <Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@school.edu.et" />
                </Field>
                <Field label="Password" hint="8+ chars">
                  <Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} />
                </Field>
              </div>
              <Field label="Your grade" hint="Required for curriculum filtering">
                <Select value={grade} onChange={e=>setGrade(e.target.value)} required>
                  <option value="">Select grade…</option>
                  {grades.map(g=> <option key={g.level} value={g.level}>{g.label}</option>)}
                </Select>
              </Field>

              {error && (
                <div className="bg-[rgba(255,107,107,0.07)] border border-[rgba(255,107,107,0.25)] text-danger text-[12.5px] rounded-[14px] px-3 py-2.5">{error}</div>
              )}

              <PrimaryButton type="submit" disabled={submitting} className="w-full">
                {submitting ? "Creating account…" : "Create account"}
              </PrimaryButton>

              <p className="text-[11.5px] text-ink-faint text-center">Grade 9–12 · Ethiopia · curriculum-locked</p>
            </form>
          </Glass>
          <p className="text-[13px] text-ink-soft text-center mt-4">
            Already have an account? <Link href="/signin" className="text-verdigris-bright font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </Shell>
  );
}
