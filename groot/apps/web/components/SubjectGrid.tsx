"use client";

import { TiltCard, I, Badge } from "./ui";

export interface Subject {
  id: string;
  name: string;
  slug: string;
}

const ACCENT_BY_SLUG: Record<string, { c: string; glow: string }> = {
  chemistry:  { c: "#22C5A6", glow: "rgba(34,197,166,0.18)" },
  physics:    { c: "#22C5A6", glow: "rgba(34,197,166,0.18)" },
  biology:    { c: "#22C5A6", glow: "rgba(34,197,166,0.18)" },
  mathematics:{ c: "#FF8A5B", glow: "rgba(255,138,91,0.15)" },
  english:    { c: "#6BA8FF", glow: "rgba(107,168,255,0.15)" },
  amharic:    { c: "#6BA8FF", glow: "rgba(107,168,255,0.15)" },
  history:    { c: "#E8B86B", glow: "rgba(232,184,107,0.13)" },
  geography:  { c: "#E8B86B", glow: "rgba(232,184,107,0.13)" },
  civics:     { c: "#E8B86B", glow: "rgba(232,184,107,0.13)" },
};

function accentFor(slug: string) {
  return ACCENT_BY_SLUG[slug] ?? ACCENT_BY_SLUG.mathematics;
}

export function SubjectGrid({ subjects, onSelect }: { subjects: Subject[]; onSelect: (subject: Subject) => void; }) {
  if (subjects.length === 0) {
    return <div className="py-10 text-center text-[13.5px] text-ink-soft">No subjects available for your grade yet.</div>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {subjects.map((subject, i) => {
        const a = accentFor(subject.slug);
        return (
          <TiltCard key={subject.id} className="p-5 cursor-pointer group" maxTilt={5.5}>
            <button onClick={() => onSelect(subject)} className="text-left w-full">
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-[14px] flex items-center justify-center"
                  style={{ background: `${a.c}18`, border: `1px solid ${a.c}33`, boxShadow: `0 0 28px ${a.glow}` }}>
                  <span className="font-display text-[15px]" style={{ color: a.c }}>{subject.name.slice(0,2).toUpperCase()}</span>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">{subject.slug}</span>
              </div>
              <div className="font-display text-[23px] text-ink tracking-tight">{subject.name}</div>
              <div className="text-[12.5px] text-ink-soft mt-1">Ask questions · Generate quizzes</div>
              <div className="mt-4 flex items-center gap-1.5 text-[12.5px] text-ink-faint group-hover:text-ink-soft transition-colors">
                Open session <I.arrowRight />
              </div>
            </button>
          </TiltCard>
        );
      })}
    </div>
  );
}
