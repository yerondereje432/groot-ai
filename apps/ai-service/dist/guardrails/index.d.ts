/**
 * Guardrails — per spec §13 step 6 and §27 AI safety.
 *
 * Three guards, applied in order:
 *   1. Unsafe-request guard: blocks content that is unsafe for minors.
 *   2. Curriculum-lock guard: blocks if retrieval confidence is too low.
 *   3. PII guard: redacts obvious PII patterns from prompts before sending.
 *
 * If any guard fires, the orchestrator returns a refusal (no LLM call).
 */
import type { RetrievalResult, TutorRefusalReason } from '@groot/shared-types';
export interface GuardContext {
    query: string;
    retrieval: RetrievalResult;
    minConfidence: number;
    locale: 'am' | 'en';
}
export interface GuardResult {
    pass: boolean;
    refusal?: {
        reason: TutorRefusalReason;
        message: string;
    };
    /** Redacted query (if PII was found). */
    redactedQuery?: string;
}
export declare function applyGuards(ctx: GuardContext): GuardResult;
export declare function redactPii(text: string): string;
//# sourceMappingURL=index.d.ts.map