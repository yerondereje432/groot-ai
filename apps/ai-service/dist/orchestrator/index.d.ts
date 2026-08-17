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
export declare function classifyIntent(query: string): TutorIntent;
//# sourceMappingURL=index.d.ts.map