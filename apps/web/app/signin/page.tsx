"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";
import { Shell, GrootMark, Glass, Field, Input, PrimaryButton, Eyebrow, I } from "@/components/ui";

export default function SignInPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) { setError("Credentials didn’t verify."); setSubmitting(false); return; }
    router.push("/dashboard"); router.refresh();
  }

  return (
    <Shell>
      <div className="border-b border-glassline" style={{background:"rgba(7,19,21,0.5)", backdropFilter:"blur(14px)"}}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <GrootMark />
          <div className="text-[11px] text-ink-faint font-mono">SEDECIA · ETH Grades 9–12</div>
        </div>
      </div>

      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-5 py-14 relative">
        <div className="w-full max-w-[1060px] grid lg:grid-cols-[1.06fr_.92fr] gap-10 lg:gap-14 items-center">
          
          {/* left lab panel */}
          <div className="hidden lg:block fade-up">
            <Eyebrow>Curriculum-locked RAG</Eyebrow>
            <h1 className="font-display text-[52px] leading-[0.97] tracking-tight text-ink mt-3"
              style={{textShadow:"0 2px 44px rgba(45,212,191,0.09)"}}>
              Answers<br/>from your<br/><span className="text-verdigris-bright">textbook.</span>
            </h1>
            <p className="text-[15px] text-ink-soft mt-5 leading-relaxed max-w-[400px]">
              Groot answers strictly from your grade-level Ethiopian national curriculum.
              Every explanation is chapter-cited. No open-web fallback.
            </p>
            <div className="flex flex-wrap gap-2 mt-6">
              {["Grade-filtered", "Chapter-cited", "RAG-grounded", "Amharic-ready"].map(t=>(
                <span key={t} className="text-[11px] px-3 py-[7px] rounded-full border border-glassline bg-white/[0.03] text-ink-soft">{t}</span>
              ))}
            </div>

            {/* mini glass stat strip */}
            <div className="mt-8 flex gap-4">
              {[
                {k:"9–12", l:"Grades"},
                {k:"8+", l:"Subjects"},
                {k:"Ch§", l:"Citations"},
              ].map(s=>(
                <div key={s.l} className="glass px-4 py-3 min-w-[92px]">
                  <div className="font-display text-[20px] text-verdigris-bright">{s.k}</div>
                  <div className="text-[10.5px] text-ink-faint font-mono uppercase tracking-wider">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* sign in glass */}
          <div className="fade-up" style={{animationDelay:"70ms"}}>
            <Glass strong className="shadow-glass" padding>
              <div className="flex items-center gap-2 mb-1 text-verdigris-bright">
                <I.spark />
                <Eyebrow>Welcome back</Eyebrow>
              </div>
              <h2 className="font-display text-[30px] tracking-tight text-ink mb-1">Sign in to Groot</h2>
              <p className="text-[13.5px] text-ink-soft mb-6">Continue your study sessions.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Email">
                  <Input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@school.edu.et" />
                </Field>
                <Field label="Password" hint="8+ characters">
                  <Input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required />
                </Field>

                {error && (
                  <div className="bg-[rgba(255,107,107,0.07)] border border-[rgba(255,107,107,0.25)] text-danger text-[12.5px] rounded-[14px] px-3 py-2.5">
                    {error}
                  </div>
                )}

                <PrimaryButton type="submit" disabled={submitting} className="w-full">
                  {submitting ? "Signing in…" : "Sign in"}
                </PrimaryButton>

                <p className="text-[13px] text-ink-soft text-center pt-1">
                  New to Groot? <Link href="/signup" className="text-verdigris-bright hover:text-verdigris font-medium">Create an account</Link>
                </p>
              </form>
            </Glass>
            <p className="text-[11px] text-ink-faint text-center mt-4 font-mono">
              curriculum-grounded · RLS-secured · chapter-cited
            </p>
          </div>
        </div>
      </div>
    </Shell>
  );
}
