/**
 * LLM-based re-ranker backed by Gemini.
 *
 * Per spec §14: "Re-ranking (cross-encoder or LLM-based) on top-20 → top-5."
 * A hosted cross-encoder isn't available in this stack yet, so this implements
 * the LLM-based variant explicitly named as acceptable in the spec: a single
 * pointwise-scoring call asks Gemini to grade each candidate's relevance to
 * the query on a 0–1 scale, in the student's grade/subject context.
 *
 * Design notes:
 *   - One batched call per rerank (not one call per candidate) to keep latency
 *     and cost bounded — candidates are capped at topKPreRerank (20 per §14).
 *   - Blends the LLM relevance score with the upstream vector/BM25 score and
 *     the topic metadata boost, same 0.7/0.3 weighting the stub used, so
 *     swapping providers doesn't change the retrieval confidence semantics
 *     the orchestrator's guardrail (`minConfidence`) depends on.
 *   - On any failure (network, bad JSON, timeout) it falls back to the same
 *     lexical Jaccard scoring the stub uses, rather than throwing — a tutor
 *     answering with slightly worse ranking beats a tutor that's down.
 */

import type { RetrievalHit } from '@groot/shared-types';
import type { RerankInput, ReRanker } from './reranker.js';

export interface GeminiReRankerOptions {
  apiKey: string;
  model?: string;
  /** Max ms to wait for the scoring call before falling back to lexical scoring. */
  timeoutMs?: number;
}

interface LlmScore {
  index: number;
  score: number;
}

export class GeminiReRanker implements ReRanker {
  readonly name = 'gemini';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(options: GeminiReRankerOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model || 'gemini-1.5-flash';
    this.timeoutMs = options.timeoutMs ?? 4000;
  }

  async rerank(input: RerankInput): Promise<RetrievalHit[]> {
    if (input.candidates.length === 0) return [];

    let llmScores: LlmScore[] | null = null;
    try {
      llmScores = await this.scoreWithGemini(input);
    } catch {
      // Network error, timeout, or malformed response — degrade, don't fail the request.
      llmScores = null;
    }

    const scored = input.candidates.map((hit, i) => {
      const metaBoost = input.topicId && hit.chunk.topicId === input.topicId ? 0.15 : 0;
      const semanticScore = llmScores?.find(s => s.index === i)?.score
        ?? this.jaccard(this.tokenize(input.query), this.tokenize(hit.chunk.content));
      const rerankScore = Math.min(1, semanticScore + metaBoost);

      return {
        ...hit,
        score: 0.7 * hit.score + 0.3 * rerankScore,
        scoreBreakdown: {
          ...(hit.scoreBreakdown ?? { vector: 0, bm25: 0, rerank: 0, metadataBoost: 0 }),
          rerank: rerankScore,
          metadataBoost: metaBoost,
        },
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, input.topK);
  }

  private async scoreWithGemini(input: RerankInput): Promise<LlmScore[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const candidateBlock = input.candidates
        .map((hit, i) => `[${i}] ${this.truncate(hit.chunk.content, 500)}`)
        .join('\n\n');

      const prompt =
        `You are grading how relevant each numbered passage is to a student's question, ` +
        `for a Grade ${input.grade} ${input.subjectId} curriculum tutor. ` +
        `Score each passage 0.0 (irrelevant) to 1.0 (directly answers it). ` +
        `Respond with ONLY a JSON array like [{"index":0,"score":0.9}, ...] — one entry per passage, no prose.\n\n` +
        `QUESTION: ${input.query}\n\nPASSAGES:\n${candidateBlock}`;

      const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 1024 },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini rerank error: ${response.statusText}`);
      }

      const data = await response.json();
      const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array in Gemini rerank response');

      const parsed = JSON.parse(jsonMatch[0]) as Array<{ index: number; score: number }>;
      return parsed
        .filter(p => typeof p.index === 'number' && typeof p.score === 'number')
        .map(p => ({ index: p.index, score: Math.max(0, Math.min(1, p.score)) }));
    } finally {
      clearTimeout(timer);
    }
  }

  private truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 2);
  }

  private jaccard(aTokens: string[], bTokens: string[]): number {
    const a = new Set(aTokens);
    const b = new Set(bTokens);
    if (a.size === 0 || b.size === 0) return 0;
    let inter = 0;
    for (const tok of a) if (b.has(tok)) inter++;
    const union = a.size + b.size - inter;
    return union === 0 ? 0 : inter / union;
  }
}
