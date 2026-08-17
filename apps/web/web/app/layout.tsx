import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Groot — Curriculum AI Tutor",
  description: "Curriculum-grounded AI tutor for Ethiopian Grades 9–12. Answers from your textbook, with chapter citations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-deep text-ink antialiased">{children}</body>
    </html>
  );
}
