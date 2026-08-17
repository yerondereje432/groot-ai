/**
 * Orchestrator — the main entry point of the AI service.
 *
 * Per spec §13:
 *   1. Classify intent.
 *   2. Retrieve curriculum chunks.
 *   3. Apply guardrails (§27 AI safety, §13 curriculum-lock).
 *   4. Assemble prompt.
 *   5. Call LLM (streaming).
 *   6. Post-process (citations, formatting, language enforcement).
 *
 * Streaming via AsyncIterable — the API layer wraps this in SSE.
 */
import type { RetrievalHit, TutorIntent, TutorSourceCitation, TutorStreamEvent } from '@groot/shared-types';
import type { LLMProvider } from '../providers/llm.interface.js';
import type { Retriever } from '../retriever/retriever.js';
import type { RetrieverConfig } from '../retriever/retriever.js';
export interface OrchestratorInput {
    userId: string;
    query: string;
    grade: 9 | 10 | 11 | 12;
    subjectId: string;
    topicId?: string;
    locale: 'am' | 'en';
}
export interface OrchestratorDeps {
    llm: LLMProvider;
    retriever: Retriever;
    /** Session id for citation logging. */
    generateSessionId: () => string;
}
export declare class Orchestrator {
    private readonly deps;
    private readonly cfg;
    constructor(deps: OrchestratorDeps, cfg: RetrieverConfig);
    run(input: OrchestratorInput): AsyncIterable<TutorStreamEvent>;
    /**
     * Non-streaming variant — used by question generation, evals, and admin tools.
     */
    runOnce(input: OrchestratorInput): Promise<{
        kind: 'answer';
        content: string;
        citations: TutorSourceCitation[];
        intent: TutorIntent;
        confidence: number;
        hits: RetrievalHit[];
    } | {
        kind: 'refusal';
        reason: string;
        message: string;
    }>;
    private recordOutcome;
}
//# sourceMappingURL=orchestrator.d.ts.map