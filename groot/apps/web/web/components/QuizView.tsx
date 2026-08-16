"use client";
import { useState } from "react";
import { Glass, PrimaryButton, Badge } from "./ui";

interface QuizQuestion {
  question_text: string; question_type: "multiple_choice" | "short_answer";
  options: string[] | null; correct_answer: string; explanation: string; source_chunk_id: string;
}

export function QuizView({ title, questions, onRetake }: { title: string; questions: QuizQuestion[]; onRetake?: () => void; }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  function selectAnswer(index: number, value: string) { if (revealed[index]) return; setAnswers(p=>({...p, [index]:value})); }
  function checkAnswer(index: number) { setRevealed(p=>({...p, [index]: true})); }
  const answeredCount = Object.keys(revealed).length;
  const correctCount = questions.filter((q,i)=> revealed[i] && answers[i]?.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()).length;

  return (
    <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-10">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="eyebrow mb-2">Chapter quiz</div>
          <h1 className="font-display text-[30px] tracking-tight text-ink">{title}</h1>
        </div>
        {answeredCount > 0 && <Badge tone={correctCount===answeredCount ? "verdigris":"neutral"}>{correctCount}/{answeredCount}</Badge>}
      </div>
      <div className="space-y-4">
        {questions.map((q,i)=>{
          const isRevealed = revealed[i];
          const studentAnswer = answers[i];
          const isCorrect = isRevealed && studentAnswer?.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
          return (
            <Glass key={i} className="fade-up">
              <p className="text-[14.5px] text-ink leading-relaxed mb-3">
                <span className="font-mono text-[11px] text-ink-faint mr-2">{i+1}.</span>{q.question_text}
              </p>
              {q.question_type==="multiple_choice" && q.options ? (
                <div className="space-y-2">
                  {q.options.map(option=>{
                    const isSelected = studentAnswer === option;
                    const isAnswerCorrect = isRevealed && option === q.correct_answer;
                    return (
                      <button key={option} onClick={()=>selectAnswer(i, option)} disabled={isRevealed}
                        className={`w-full text-left px-3.5 py-2.5 rounded-[13px] border text-[13.5px] transition-all
                          ${isAnswerCorrect ? "border-[rgba(45,212,191,0.45)] bg-[rgba(45,212,191,0.09)] text-verdigris-bright" : ""}
                          ${isSelected && !isRevealed ? "border-[rgba(95,255,230,0.42)] bg-white/[0.045] text-ink" : ""}
                          ${!isSelected && !isAnswerCorrect ? "border-glassline bg-white/[0.022] text-ink-soft hover:border-glassline2" : ""}
                          ${isRevealed ? "cursor-default" : ""}`}>
                        {option}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input value={studentAnswer ?? ""} onChange={e=>selectAnswer(i,e.target.value)} disabled={isRevealed}
                  placeholder="Your answer…" className="glass-input" />
              )}
              {!isRevealed ? (
                <button onClick={()=>checkAnswer(i)} disabled={!studentAnswer}
                  className="mt-3 text-[13px] text-verdigris-bright font-medium hover:text-verdigris disabled:text-ink-faint">
                  Check answer →
                </button>
              ) : (
                <div className={`mt-3 rounded-[13px] px-3.5 py-3 text-[13px] leading-relaxed ${isCorrect ? "bg-[rgba(45,212,191,0.08)] text-[#9fffe9] border border-[rgba(45,212,191,0.18)]" : "bg-[rgba(255,200,107,0.075)] text-amber border border-[rgba(255,200,107,0.18)]"}`}>
                  <div className="font-medium mb-0.5">{isCorrect ? "Correct." : `Answer: ${q.correct_answer}`}</div>
                  <div className="opacity-90 text-[12.5px]">{q.explanation}</div>
                </div>
              )}
            </Glass>
          );
        })}
      </div>
      {onRetake && <div className="mt-6 text-center"><PrimaryButton onClick={onRetake}>Generate a new quiz</PrimaryButton></div>}
    </div>
  );
}
