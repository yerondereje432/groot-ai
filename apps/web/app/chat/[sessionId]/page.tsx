"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChatMessage, type ChatMessageData } from "@/components/ChatMessage";
import { AuroraBackground, GrootMark, Badge, Glass } from "@/components/ui";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000/api/v1";

export default function ChatPage({ params }: { params: { sessionId: string } }) {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    const studentMessage: ChatMessageData = { id: crypto.randomUUID(), role: "student", content: input, citations: [] };
    setMessages((prev) => [...prev, studentMessage]);
    setInput(""); setSending(true);
    try {
      // Note: In a real app, we'd pull these from the user's session/context
      const response = await fetch(`${BACKEND_URL}/tutor`, {
        method: "POST", 
        headers: { 
          "Content-Type": "application/json",
          // Auth header would go here: "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          query: studentMessage.content,
          grade: 10, // Default for demo
          subjectId: "00000000-0000-0000-0000-000000000000", // Dummy UUID
          locale: "en"
        }),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      
      if (data.kind === 'refusal') {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.message, citations: [] }]);
      } else {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.content, citations: data.citations ?? [] }]);
      }
    } catch {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: `Couldn’t reach the tutor backend at ${BACKEND_URL}. Ensure the NestJS API is running.`, citations: [] }]);
    } finally { setSending(false); setTimeout(()=>inputRef.current?.focus(), 10); }
  }

  return (
    <div className="h-screen flex bg-deep relative overflow-hidden">
      <AuroraBackground />
      {/* sidebar glass */}
      <aside className="hidden lg:flex w-[300px] border-r border-glassline flex-col relative z-10"
        style={{background:"rgba(7,19,21,0.62)", backdropFilter:"blur(18px)"}}>
        <div className="h-[62px] px-5 flex items-center border-b border-glassline"><GrootMark /></div>
        <div className="p-5 flex-1">
          <div className="eyebrow mb-2">Current session</div>
          <div className="text-[13px] text-ink-soft leading-relaxed">Curriculum-grounded answers with chapter citations.</div>
          <div className="mt-5 space-y-2.5 text-[12.5px] text-ink-soft">
            {[
              ["Grade-filtered RAG", "#2DD4BF"],
              ["Section-cited", "#FFC86B"],
              ["No web fallback", "#9BCBC0"],
            ].map(([t,c])=>(
              <div key={t as string} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{background:c as string, boxShadow:`0 0 8px ${c}66`}} />
                {t}
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Glass padding className="!p-4 bg-white/[0.023]">
              <div className="text-[11px] text-ink-faint font-mono uppercase tracking-wider mb-1">Session</div>
              <div className="text-[12px] text-ink-soft font-mono break-all">{params.sessionId.slice(0,18)}…</div>
            </Glass>
          </div>
        </div>
        <div className="p-5 border-t border-glassline">
          <Link href="/dashboard" className="text-[13px] text-ink-soft hover:text-ink">← Back to dashboard</Link>
        </div>
      </aside>

      {/* chat */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <div className="h-[62px] border-b border-glassline flex items-center justify-between px-5 sm:px-8"
          style={{background:"rgba(7,19,21,0.55)", backdropFilter:"blur(14px)"}}>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="lg:hidden text-ink-soft">←</Link>
            <span className="text-[13px] text-ink-soft">Tutor session</span>
            <Badge tone="verdigris">curriculum-locked</Badge>
          </div>
          <div className="text-[11px] text-ink-faint font-mono hidden sm:block">{params.sessionId.slice(0,8)}…</div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-chat mx-auto px-5 sm:px-8 py-10">
            {messages.length === 0 && (
              <div className="py-10 fade-up">
                <div className="eyebrow mb-3">Start with a question</div>
                <h1 className="font-display text-[36px] sm:text-[44px] tracking-tight text-ink leading-[1.06] mb-3">
                  What are you<br/>studying today?
                </h1>
                <p className="text-[14.5px] text-ink-soft max-w-[520px] leading-relaxed">
                  Ask anything from your textbook. Groot answers strictly from your grade-level material with chapter citations.
                </p>
                <div className="flex flex-wrap gap-2 mt-5">
                  {[
                    "Explain photosynthesis in Grade 10 Biology Ch. 3",
                    "Solve: 2x² - 5x + 2 = 0",
                    "What caused the Battle of Adwa?",
                  ].map(q=>(
                    <button key={q} onClick={()=>setInput(q)}
                      className="text-[12.5px] text-ink-soft border border-glassline rounded-full px-3.5 py-2 hover:border-glassline2 hover:text-ink transition-all text-left"
                      style={{background:"rgba(255,255,255,0.024)"}}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map(m => <ChatMessage key={m.id} message={m} />)}
            {sending && <div className="text-[13px] text-ink-faint">Retrieving from textbook…</div>}
          </div>
        </div>

        {/* composer */}
        <div className="border-t border-glassline" style={{background:"rgba(7,19,21,0.72)", backdropFilter:"blur(16px)"}}>
          <div className="max-w-chat mx-auto px-5 sm:px-8 py-4">
            <div className="flex items-center gap-3 rounded-[18px] px-4 py-2.5 glass"
              style={{boxShadow:"inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 30px rgba(0,0,0,0.38)"}}>
              <input
                ref={inputRef}
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); handleSend(); }}}
                placeholder="Ask about your chapter…"
                className="flex-1 bg-transparent outline-none text-[14.5px] text-ink placeholder:text-ink-faint py-1.5"
              />
              <button onClick={handleSend} disabled={sending || !input.trim()}
                className="bg-[linear-gradient(180deg,#2DD4BF_0%,#1AAE9B_100%)] text-[#052623] rounded-[12px] px-4 py-2 text-[13px] font-semibold disabled:opacity-40 hover:brightness-105 transition-all"
                style={{boxShadow:"0 0 20px rgba(45,212,191,0.18)"}}>
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
