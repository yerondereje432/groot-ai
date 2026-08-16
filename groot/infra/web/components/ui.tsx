"use client";

import React, { useRef } from "react";

export function AuroraBackground() {
  return (
    <>
      <div className="aurora-bg" aria-hidden />
      <div className="orb orb-v" aria-hidden />
      <div className="orb orb-a" aria-hidden />
      <div className="orb orb-v2" aria-hidden />
    </>
  );
}

export function GrootMark({ light = true, withWord = true }: { light?: boolean; withWord?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-[14px] rim-glow flex items-center justify-center"
        style={{background: "linear-gradient(155deg, rgba(45,212,191,0.28), rgba(45,212,191,0.08))"}}>
        <span className="font-display text-[18px] text-verdigris-bright" style={{textShadow:"0 0 18px rgba(45,212,191,0.35)"}}>G</span>
      </div>
      {withWord && <span className="font-display text-[20px] text-ink tracking-tight">Groot</span>}
    </div>
  );
}

export function Glass({ children, className = "", hover = false, strong = false, padding = true }:
  { children: React.ReactNode; className?: string; hover?: boolean; strong?: boolean; padding?: boolean }) {
  return (
    <div className={`${strong ? "glass-strong" : "glass"} ${hover ? "glass-hover" : ""} ${padding ? "p-5 sm:p-6" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function TiltCard({
  children, className = "",
  maxTilt = 7, scale = 1.015
}: {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  scale?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(1200px) rotateY(${px * maxTilt}deg) rotateX(${-py * maxTilt}deg) scale(${scale})`;
    });
  };
  const reset = () => {
    const el = ref.current; if (!el) return;
    el.style.transform = "perspective(1200px) rotateY(0deg) rotateX(0deg) scale(1)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={`glass glass-hover transition-transform duration-200 ${className}`}
      style={{ transformStyle: "preserve-3d", transition: "transform 220ms cubic-bezier(.22,1,.36,1), border-color .22s, box-shadow .22s" }}
    >
      {children}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen relative"><AuroraBackground />{children}</div>;
}

export function TopNav({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-glassline"
      style={{ background: "rgba(7,19,21,0.72)", backdropFilter: "blur(18px)" }}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-[62px] flex items-center justify-between">
        <div>{left}</div>
        <div className="flex items-center gap-3">{right}</div>
      </div>
    </header>
  );
}

export function PageContainer({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return <div className={`${narrow ? "max-w-[900px]" : "max-w-6xl"} mx-auto px-5 sm:px-8 py-9 sm:py-12 relative`}>{children}</div>;
}

export function Field({ label, hint, children, error }: { label: string; hint?: string; children: React.ReactNode; error?: string | null }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-[12.5px] font-medium text-ink-soft">{label}</label>
        {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-[12px] text-danger mt-1.5">{error}</p>}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`glass-input ${props.className ?? ""}`} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`glass-input appearance-none ${props.className ?? ""}`}>{props.children}</select>;
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`btn-verdigris disabled:opacity-50 disabled:cursor-not-allowed ${props.className ?? ""}`} />;
}
export function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`btn-ghost ${props.className ?? ""}`} />;
}
export function GlassButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`btn-glass ${props.className ?? ""}`} />;
}

export function Badge({ children, tone = "verdigris" }: { children: React.ReactNode; tone?: "verdigris"|"amber"|"neutral" }) {
  const tones = {
    verdigris: "bg-[rgba(45,212,191,0.10)] text-verdigris-bright border border-[rgba(45,212,191,0.22)]",
    amber: "bg-[rgba(255,200,107,0.10)] text-amber border border-[rgba(255,200,107,0.22)]",
    neutral: "bg-white/[0.045] text-ink-soft border border-glassline"
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}

// Lucide-style inline icons (no external dep)
export const I = {
  arrowRight: (p:any) => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>,
  spark: (p:any) => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"/></svg>,
  book: (p:any) => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5V5.5A2.5 2.5 0 0 1 6.5 3H20v14H6.5A2.5 2.5 0 0 0 4 19.5z"/></svg>,
  flask: (p:any) => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M9 3h6M10 9l-5 11h14l-5-11"/></svg>,
};
