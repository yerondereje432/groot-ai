/**
 * Stub cross-encoder re-ranker.
 *
 * Real production would use a model like `cross-encoder/ms-marco-MiniLM-L-6-v2`.
 * This stub combines:
 *   1. Lexical overlap between query and chunk (Jaccard on tokens).
 *   2. A metadata match bonus when chunk.topic_id matches input.topicId.
 *
 * Designed so it can be replaced by a real cross-encoder with no code changes
 * elsewhere.
 */

import type { RetrievalHit } from '@groot/shared-types';
import type { RerankInput, ReRanker } from './reranker.js';

export class StubReRanker implements ReRanker {
  readonly name = 'stub';

  async rerank(input: RerankInput): Promise<RetrievalHit[]> {
    const queryTokens = new Set(this.tokenize(input.query));
    const scored = input.candidates.map(hit => {
      const chunkTokens = new Set(this.tokenize(hit.chunk.content));
      const overlap = this.jaccard(queryTokens, chunkTokens);

      // Metadata boost: if the caller asked for a specific topic and the
      // chunk belongs to it, lift its score. This implements the §14
      // metadata filtering behavior at the re-rank stage.
      const metaBoost = input.topicId && hit.chunk.topicId === input.topicId ? 0.15 : 0;

      // Re-rank score is a bounded function of overlap and metaBoost.
      const rerankScore = Math.min(1, overlap + metaBoost);

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

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 2);
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let inter = 0;
    for (const tok of a) if (b.has(tok)) inter++;
    const union = a.size + b.size - inter;
    return union === 0 ? 0 : inter / union;
  }
}
