"use client";

import { useEffect, useRef, useState } from "react";
import { ChatMessage, type ChatMessageData } from "@/components/ChatMessage";
import { SubjectGrid, type Subject } from "@/components/SubjectGrid";
import { AuroraBackground, GrootMark, Badge, Glass, GhostButton, Eyebrow } from "@/components/ui";
import {
  apiFetch,
  ensureSession,
  BACKEND_URL,
  getStoredGrade,
  setStoredGrade,
  getStoredSubject,
  setStoredSubject,
  resetStudySelection,
  type StoredSubject,
} from "@/lib/api-client";

const GRADES = [9, 10, 11, 12];

/**
 * The whole app, in one page. No signup/signin wall: a guest session is
 * created silently on first load (see lib/api-client.ts), and the only
 * thing a student is ever asked is "grade, then subject" — once, inline in
 * the chat shell itself — the same low-friction feel as picking a GPT in
 * ChatGPT, not a multi-page account flow. Both choices persist in
 * localStorage so returning visitors go straight back into the chat.
 */
export default function HomePage() {
  const [ready, setReady] = useState(false);
  const [grade, setGrade] = useState<number | null>(null);
  const [subject, setSubject] = useState<StoredSubject | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Bootstrap: silently open a guest session, restore any saved grade/subject.
  useEffect(() => {
    (async () => {
      try {
        await ensureSession();
      } catch {
        // Session creation failures surface per-action below (e.g. when
        // picking a grade); nothing to show on a bare page load.
      }
      setGrade(getStoredGrade());
      setSubject(getStoredSubject());
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handlePickGrade(g: number) {
    setSetupError(null);
    setLoadingSubjects(true);
    try {
      await ensureSession(g);
      setStoredGrade(g);
      setGrade(g);
      const res = await apiFetch(`/curriculum/subjects`);
      if (!res.ok) throw new Error();
      const all = (await res.json()) as Array<{ id: string; name: string; grade: number }>;
      const forGrade = all.filter((s) => s.grade === g);
      setSubjects(
        forGrade.map((s) => ({ id: s.id, name: s.name, slug: s.name.toLowerCase().replace(/\s+/g, "-") })),
      );
    } catch {
      setSetupError(`Couldn't load subjects. Is the API reachable at ${BACKEND_URL}?`);
    } finally {
      setLoadingSubjects(false);
    }
  }

  function handlePickSubject(s: Subject) {
    const stored: StoredSubject = { id: s.id, name: s.name };
    setStoredSubject(stored);
    setSubject(stored);
  }

  function changeSubject() {
    resetStudySelection();
    setGrade(null);
    setSubject(null);
    setSubjects([]);
    setMessages([]);
  }

  async function handleSend() {
    if (!input.trim() || sending || !grade || !subject) return;

    const studentMessage: ChatMessageData = {
      id: crypto.randomUUID(),
      role: "student",
      content: input,
      citations: [],
    };
    setMessages((prev) => [...prev, studentMessage]);
    setInput("");
    setSending(true);

    try {
      const response = await apiFetch(`/tutor`, {
        method: "POST",
        body: JSON.stringify({
          query: studentMessage.content,
          grade,
          subjectId: subject.id,
          locale: "en",
        }),
      });

      if (!response.ok) throw new Error();
      const data = await response.json();

      if (data.kind === "refusal") {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.message, citations: [] }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: data.content, citations: data.citations ?? [] },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: `Couldn't reach the tutor backend at ${BACKEND_URL}.`, citations: [] },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center bg-deep relative overflow-hidden">
        <AuroraBackground />
        <div className="relative z-10 text-ink-soft text-[13.5px]">Loading Groot…</div>
      </div>
    );
  }

  // Step 1: grade (only ever shown once, then remembered).
  if (!grade) {
    return (
      <div className="h-screen flex items-center justify-center bg-deep relative overflow-hidden px-5">
        <AuroraBackground />
        <div className="relative z-10 w-full max-w-[520px]">
          <Glass strong className="shadow-glass fade-up" padding>
            <div className="flex items-center gap-2 mb-1"><GrootMark /></div>
            <Eyebrow>Before we start</Eyebrow>
            <h1 className="font-display text-[28px] tracking-tight text-ink mt-2 mb-1">What grade are you in?</h1>
            <p className="text-[13.5px] text-ink-soft mb-6">
              Groot answers strictly from your grade-level Ethiopian curriculum — this keeps every answer on-syllabus.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {GRADES.map((g) => (
                <button
                  key={g}
                  onClick={() => handlePickGrade(g)}
                  disabled={loadingSubjects}
                  className="glass glass-hover rounded-[16px] px-4 py-5 text-center disabled:opacity-50"
                >
                  <div className="font-display text-[22px] text-ink">Grade {g}</div>
                </button>
              ))}
            </div>
            {loadingSubjects && <p className="text-[13px] text-ink-faint mt-4">Loading subjects…</p>}
            {setupError && (
              <div className="mt-4 bg-[rgba(255,107,107,0.07)] border border-[rgba(255,107,107,0.25)] text-danger text-[12.5px] rounded-[14px] px-3 py-2.5">
                {setupError}
              </div>
            )}
          </Glass>
        </div>
      </div>
    );
  }

  // Step 2: subject (only ever shown once per grade, then remembered).
  if (!subject) {
    return (
      <div className="min-h-screen bg-deep relative overflow-hidden px-5 py-14">
        <AuroraBackground />
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <GrootMark />
            <Badge tone="verdigris">Grade {grade}</Badge>
          </div>
          <Eyebrow>Choose a subject</Eyebrow>
          <h1 className="font-display text-[32px] text-ink tracking-tight mb-1 mt-2">What do you want to study?</h1>
          <p className="text-[14px] text-ink-soft mb-6">Every answer is cited from your Grade {grade} textbook.</p>
          {subjects.length === 0 && !loadingSubjects && (
            <Glass><p className="text-[13.5px] text-ink-soft">No subjects available for Grade {grade} yet.</p></Glass>
          )}
          <SubjectGrid subjects={subjects} onSelect={handlePickSubject} />
        </div>
      </div>
    );
  }

  // Step 3: chat — the main event.
  return (
    <div className="h-screen flex bg-deep relative overflow-hidden">
      <AuroraBackground />
      <aside
        className="hidden lg:flex w-[300px] border-r border-glassline flex-col relative z-10"
        style={{ background: "rgba(7,19,21,0.62)", backdropFilter: "blur(18px)" }}
      >
        <div className="h-[62px] px-5 flex items-center border-b border-glassline"><GrootMark /></div>
        <div className="p-5 flex-1">
          <div className="eyebrow mb-2">Current session</div>
          <div className="text-[13px] text-ink-soft leading-relaxed">
            Studying {subject.name} (Grade {grade})
          </div>
          <div className="mt-5 space-y-2.5 text-[12.5px] text-ink-soft">
            {[
              ["Curriculum-locked", "#2DD4BF"],
              ["Chapter-cited", "#FFC86B"],
              ["No web fallback", "#9BCBC0"],
            ].map(([t, c]) => (
              <div key={t as string} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: c as string, boxShadow: `0 0 8px ${c}66` }} />
                {t}
              </div>
            ))}
          </div>
        </div>
        <div className="p-5 border-t border-glassline">
          <GhostButton onClick={changeSubject}>Change subject</GhostButton>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <div
          className="h-[62px] border-b border-glassline flex items-center justify-between px-5 sm:px-8"
          style={{ background: "rgba(7,19,21,0.55)", backdropFilter: "blur(14px)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-ink-soft">{subject.name}</span>
            <Badge tone="verdigris">Grade {grade}</Badge>
          </div>
          <button onClick={changeSubject} className="lg:hidden text-[12.5px] text-ink-soft hover:text-ink">Change</button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-chat mx-auto px-5 sm:px-8 py-10">
            {messages.length === 0 && (
              <div className="py-10 fade-up">
                <div className="eyebrow mb-3">Start with a question</div>
                <h1 className="font-display text-[36px] sm:text-[44px] tracking-tight text-ink leading-[1.06] mb-3">
                  What are you<br />studying today?
                </h1>
                <p className="text-[14.5px] text-ink-soft max-w-[520px] leading-relaxed">
                  Ask anything from your {subject.name} textbook. Groot answers strictly from your grade-level material.
                </p>
              </div>
            )}
            {messages.map((m) => <ChatMessage key={m.id} message={m} />)}
            {sending && (
              <div className="text-[13px] text-ink-faint italic ml-12 mt-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-verdigris animate-pulse" />
                Retrieving from textbook...
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-glassline" style={{ background: "rgba(7,19,21,0.72)", backdropFilter: "blur(16px)" }}>
          <div className="max-w-chat mx-auto px-5 sm:px-8 py-4">
            <div
              className="flex items-center gap-3 rounded-[18px] px-4 py-2.5 glass"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 30px rgba(0,0,0,0.38)" }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask about your chapter…"
                className="flex-1 bg-transparent outline-none text-[14.5px] text-ink placeholder:text-ink-faint py-1.5"
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="bg-[linear-gradient(180deg,#2DD4BF_0%,#1AAE9B_100%)] text-[#052623] rounded-[12px] px-4 py-2 text-[13px] font-semibold disabled:opacity-40 hover:brightness-105 transition-all"
                style={{ boxShadow: "0 0 20px rgba(45,212,191,0.18)" }}
              >
                Send
              </button>
            </div>
            <div className="flex items-center justify-between px-1 pt-2 text-[11px] text-ink-faint">
              <span>Answers are grounded in your textbook — citations included.</span>
              <span className="hidden sm:inline font-mono">Enter to send</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
