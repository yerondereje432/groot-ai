"use client";
import { useState } from "react";

export interface Citation {
  chunk_id: string; chapter: number; chapter_title: string;
  section: string; section_title: string; page: number | null; similarity: number;
}

export function MarginCitation({ citation, excerpt }: { citation: Citation; excerpt?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button onClick={()=>setOpen(o=>!o)}
        className="inline-flex items-center gap-2 rounded-full border border-glassline bg-white/[0.034] px-3 py-[7px] text-[11.5px] text-ink-soft hover:border-glassline2 hover:text-ink transition-all font-mono"
        aria-expanded={open}>
        <span className="w-1.5 h-1.5 rounded-full bg-verdigris" style={{boxShadow:"0 0 10px rgba(45,212,191,0.5)"}} />
        Ch. {citation.chapter} §{citation.section}
        {citation.page ? ` · p.${citation.page}` : ""}
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-[320px] glass-strong p-3.5 shadow-float fade-up" style={{borderRadius:"16px"}}>
          <div className="text-[12.5px] font-semibold text-ink mb-1">{citation.section_title}</div>
          <div className="text-[11.5px] text-ink-soft">{citation.chapter_title}</div>
          {excerpt && <p className="text-[12.5px] text-ink-soft mt-2 leading-relaxed">{excerpt}</p>}
          <div className="text-[10.5px] text-ink-faint mt-2 font-mono">sim {citation.similarity.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
}
