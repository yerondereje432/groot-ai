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

import type {
  RetrievalHit,
  TutorIntent,
  TutorSourceCitation,
  TutorStreamEvent,
} from '@groot/shared-types';
import type { LLMProvider } from '../providers/llm.interface.js';
import type { Retriever } from '../retriever/retriever.js';
import type { RetrieverConfig } from '../retriever/retriever.js';
import { classifyIntent } from './index.js';
import { assemblePrompt } from '../prompt/assembler.js';
import { applyGuards, redactPii } from '../guardrails/index.js';

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

export class Orchestrator {
  constructor(
    private readonly deps: OrchestratorDeps,
    private readonly cfg: RetrieverConfig,
  ) {}

  async *run(input: OrchestratorInput): AsyncIterable<TutorStreamEvent> {
    const sessionId = this.deps.generateSessionId();
    const intent = classifyIntent(input.query);

    // 1. Retrieve.
    const retrieval = await this.deps.retriever.retrieve({
      query: input.query,
      grade: input.grade,
      subjectId: input.subjectId,
      topicId: input.topicId,
    });

    // 2. Guardrails.
    const guard = applyGuards({
      query: input.query,
      retrieval,
      minConfidence: this.cfg.minConfidence,
      locale: input.locale,
    });

    if (!guard.pass) {
      yield { type: 'refusal', reason: guard.refusal!.reason, message: guard.refusal!.message };
      return;
    }

    // 3. Cite top-K chunks up front.
    const citations: TutorSourceCitation[] = retrieval.hits.map((h: RetrievalHit) => ({
      chunkId: h.chunk.id,
      topicId: h.chunk.topicId,
      sourceRef: h.chunk.sourceRef,
    }));

    yield { type: 'start', sessionId, intent };
    for (const c of citations) {
      yield { type: 'citation', citation: c };
    }

    // 4. Prompt + LLM.
    const prompt = assemblePrompt({
      query: guard.redactedQuery ?? redactPii(input.query),
      hits: retrieval.hits,
      intent,
      locale: input.locale,
    });

    const req = {
      prompt,
      stopSequences: ['\n\n\n'],
      maxOutputTokens: 350, // exam-length cap, §2
    };

    // 5. Stream tokens.
    let fullText = '';
    for await (const tok of this.deps.llm.stream(req)) {
      if (tok.done) break;
      fullText += tok.delta;
      yield { type: 'token', delta: tok.delta };
    }

    // 6. Done event with citations and confidence.
    yield {
      type: 'done',
      citations,
      confidence: retrieval.topScore,
    };

    // Observability hook — in production this writes to the audit log + telemetry.
    void this.recordOutcome({
      sessionId,
      userId: input.userId,
      intent,
      retrieval,
      citations,
      answerLength: fullText.length,
      refused: false,
    });
  }

  /**
   * Non-streaming variant — used by question generation, evals, and admin tools.
   */
  async runOnce(input: OrchestratorInput): Promise<
    | { kind: 'answer'; content: string; citations: TutorSourceCitation[]; intent: TutorIntent; confidence: number; hits: RetrievalHit[] }
    | { kind: 'refusal'; reason: string; message: string }
  > {
    const intent = classifyIntent(input.query);
    const retrieval = await this.deps.retriever.retrieve({
      query: input.query,
      grade: input.grade,
      subjectId: input.subjectId,
      topicId: input.topicId,
    });

    const guard = applyGuards({
      query: input.query,
      retrieval,
      minConfidence: this.cfg.minConfidence,
      locale: input.locale,
    });

    if (!guard.pass) {
      return { kind: 'refusal', reason: guard.refusal!.reason, message: guard.refusal!.message };
    }

    const prompt = assemblePrompt({
      query: guard.redactedQuery ?? redactPii(input.query),
      hits: retrieval.hits,
      intent,
      locale: input.locale,
    });

    const result = await this.deps.llm.complete({
      prompt,
      stopSequences: ['\n\n\n'],
      maxOutputTokens: 350,
    });

    return {
      kind: 'answer',
      content: result.content,
      citations: retrieval.hits.map((h: RetrievalHit) => ({
        chunkId: h.chunk.id,
        topicId: h.chunk.topicId,
        sourceRef: h.chunk.sourceRef,
      })),
      intent,
      confidence: retrieval.topScore,
      hits: retrieval.hits,
    };
  }

  private async recordOutcome(_out: {
    sessionId: string;
    userId: string;
    intent: TutorIntent;
    retrieval: { hits: RetrievalHit[]; topScore: number; latencyMs: number };
    citations: TutorSourceCitation[];
    answerLength: number;
    refused: boolean;
  }): Promise<void> {
    // Wired up to telemetry in a later phase (§31).
    // Kept async to keep the interface stable.
  }
}
