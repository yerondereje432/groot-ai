/**
 * Prompt assembler.
 *
 * Per spec §13 step 3: "Prompt assembler — injects retrieved context + system constraints
 * ('answer concisely, exam-focused, curriculum-only, cite unit')."
 *
 * This is the load-bearing defense against hallucinations:
 *   1. The system prompt forbids using pretrained knowledge.
 *   2. Citations are pre-computed and injected into the prompt.
 *   3. Locale-aware response style.
 */
import type { RetrievalHit, TutorIntent } from '@groot/shared-types';
import type { LLMStructuredPrompt } from '../providers/llm.interface.js';
export interface AssembleInput {
    query: string;
    hits: RetrievalHit[];
    intent: TutorIntent;
    locale: 'am' | 'en';
}
export declare function assemblePrompt(input: AssembleInput): LLMStructuredPrompt;
//# sourceMappingURL=assembler.d.ts.map