/**
 * Vector store abstraction.
 *
 * Per spec §15: MVP uses pgvector; scale path is Qdrant.
 * This interface lets us swap implementations without touching the retriever.
 */
import type { RetrievalHit } from '@groot/shared-types';
export interface HybridQuery {
    queryEmbedding: number[];
    queryText: string;
    grade: 9 | 10 | 11 | 12;
    subjectId: string;
    /** Optional topic narrowing for tighter retrieval. */
    topicId?: string;
    topK: number;
}
export interface VectorStore {
    /** Upsert a chunk with its embedding. Used by ingestion worker. */
    upsertChunk(input: {
        id: string;
        topicId: string;
        content: string;
        sourceRef: string;
        version: string;
        embedding: number[];
    }): Promise<void>;
    /** Hybrid search: vector + BM25, with metadata filtering by grade+subject (§14). */
    hybridSearch(q: HybridQuery): Promise<RetrievalHit[]>;
    /** For eval/debug: get a chunk by id. */
    getChunk(id: string): Promise<{
        id: string;
        topicId: string;
        content: string;
        sourceRef: string;
    } | null>;
}
//# sourceMappingURL=vector-store.d.ts.map