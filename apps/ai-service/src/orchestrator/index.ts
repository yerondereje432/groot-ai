/**
 * Intent classifier.
 *
 * Per spec §13 step 1: "Orchestrator — receives query, classifies intent."
 * The intent drives:
 *   - Retrieval tuning (more context for "explain", focused for "generate_questions").
 *   - Prompt assembly style.
 *   - LLM model tier (per §37: cheaper model for question generation).
 *
 * Implementation: lightweight rule-based classifier on the query text.
 * A real implementation could use an LLM with a structured-output call,
 * but a deterministic classifier is preferable here so the cost is zero
 * and behavior is reproducible for the RAG eval gate (§32).
 */

import type { TutorIntent } from '@groot/shared-types';

const QUESTION_GEN_PATTERNS = [
  /\b(?:generate|create|give me|make)\b.*\b(?:questions?|mcqs?|problems?|quizzes?)\b/i,
  /\b\d+\s*(?:mcq|question)s?\b.*\b(?:on|about|for)\b/i,
  /\btest\s+me\b/i,
  /\bpractice\s+(?:questions?|problems?)\b/i,
];

const MOCK_EXAM_PATTERNS = [
  /\bmock\s+exam\b/i,
  /\bfull\s+(?:exam|paper)\b/i,
  /\bexam\s+simulation\b/i,
];

const EXPLAIN_PATTERNS = [
  /\bexplain\b/i,
  /\bwhat\s+is\b/i,
  /\bwhat\s+are\b/i,
  /\bhow\s+does\b/i,
  /\bhow\s+do\b/i,
  /\bwhy\b/i,
  /\bdefine\b/i,
  /\bsummari[sz]e\b/i,
];

export function classifyIntent(query: string): TutorIntent {
  for (const p of MOCK_EXAM_PATTERNS) if (p.test(query)) return 'mock_exam';
  for (const p of QUESTION_GEN_PATTERNS) if (p.test(query)) return 'generate_questions';
  for (const p of EXPLAIN_PATTERNS) if (p.test(query)) return 'explain';
  return 'general';
}
