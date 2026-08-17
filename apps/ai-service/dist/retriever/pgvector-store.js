/**
 * pgvector-backed VectorStore implementation.
 *
 * Calls the SQL function defined in apps/api/prisma/migrations/sql/pgvector.sql
 * (`curriculum_chunks_hybrid_search`) which returns a combined score:
 *   combined = vec_weight * cosine_sim + lex_weight * ts_rank_cd
 *
 * Per spec §14: hybrid retrieval is [DEFAULT]. Per spec §15: pgvector for MVP.
 */
export class PgVectorStore {
    constructor(pool) {
        this.pool = pool;
    }
    async upsertChunk(input) {
        // Use parameterized query — never interpolate the vector string (§27).
        const literal = `[${input.embedding.join(',')}]`;
        await this.pool.query(`INSERT INTO curriculum_chunks (id, topic_id, content, source_ref, version, embedding, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::vector, 'published', now())
       ON CONFLICT (id) DO UPDATE
         SET content = EXCLUDED.content,
             source_ref = EXCLUDED.source_ref,
             version = EXCLUDED.version,
             embedding = EXCLUDED.embedding,
             updated_at = now()`, [input.id, input.topicId, input.content, input.sourceRef, input.version, literal]);
    }
    async hybridSearch(q) {
        const literal = `[${q.queryEmbedding.join(',')}]`;
        const res = await this.pool.query(`SELECT * FROM curriculum_chunks_hybrid_search($1::vector, $2, $3, $4, $5, 0.7, 0.3)`, [literal, q.queryText, q.grade, q.subjectId, q.topK]);
        return res.rows.map(r => ({
            chunk: {
                id: r.chunk_id,
                topicId: r.topic_id,
                content: r.content,
                sourceRef: r.source_ref,
                version: r.version,
                status: 'published',
                createdAt: new Date().toISOString(),
            },
            score: r.combined_score,
            scoreBreakdown: {
                vector: r.vector_score,
                bm25: r.lexical_score,
                rerank: 0, // filled in by re-ranker
                metadataBoost: 0, // filled in by re-ranker
            },
        }));
    }
    async getChunk(id) {
        const res = await this.pool.query(`SELECT id, topic_id, content, source_ref FROM curriculum_chunks WHERE id = $1`, [id]);
        const row = res.rows[0];
        if (!row)
            return null;
        return { id: row.id, topicId: row.topic_id, content: row.content, sourceRef: row.source_ref };
    }
}
//# sourceMappingURL=pgvector-store.js.map