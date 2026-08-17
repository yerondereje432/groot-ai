/**
 * pgvector-backed VectorStore implementation.
 *
 * Calls the SQL function defined in apps/api/prisma/migrations/sql/pgvector.sql
 * (`curriculum_chunks_hybrid_search`) which returns a combined score:
 *   combined = vec_weight * cosine_sim + lex_weight * ts_rank_cd
 *
 * Per spec §14: hybrid retrieval is [DEFAULT]. Per spec §15: pgvector for MVP.
 */
import type { Pool } from 'pg';
import type { RetrievalHit } from '@groot/shared-types';
import type { HybridQuery, VectorStore } from './vector-store.js';
export declare class PgVectorStore implements VectorStore {
    private readonly pool;
    constructor(pool: Pool);
    upsertChunk(input: {
        id: string;
        topicId: string;
        content: string;
        sourceRef: string;
        version: string;
        embedding: number[];
    }): Promise<void>;
    hybridSearch(q: HybridQuery): Promise<RetrievalHit[]>;
    getChunk(id: string): Promise<{
        id: string;
        topicId: string;
        content: string;
        sourceRef: string;
    } | null>;
}
//# sourceMappingURL=pgvector-store.d.ts.map