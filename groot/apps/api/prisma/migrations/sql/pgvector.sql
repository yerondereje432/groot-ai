-- =============================================================
-- GROOT — pgvector migration
-- Applied AFTER `prisma migrate dev` creates the relational schema.
-- Per spec §15: HNSW index for approximate nearest neighbor.
-- Per spec §41: vector column on curriculum_chunks.
-- =============================================================

-- Add embedding column to curriculum_chunks.
-- EMBEDDING_DIM comes from env; default 384 matches the stub provider.
-- Using vector(384) keeps the schema concrete; production should pass the
-- actual embedding dimension.
DO $$
DECLARE
  dim int := coalesce(
    nullif(current_setting('app.embedding_dim', true), '')::int,
    384
  );
BEGIN
  EXECUTE format(
    'ALTER TABLE curriculum_chunks ADD COLUMN IF NOT EXISTS embedding vector(%I)',
    dim
  );
END
$$;

-- HNSW index for fast ANN search.
-- Per spec §15: HNSW over IVFFLAT (better recall, slightly higher memory).
-- m=16, ef_construction=64 are good defaults for ≤10M rows.
CREATE INDEX IF NOT EXISTS curriculum_chunks_embedding_hnsw_idx
  ON curriculum_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Composite index supports the metadata filter pattern from §14:
-- "WHERE topic_id = $1 AND status = 'published' ORDER BY embedding <=> $2"
CREATE INDEX IF NOT EXISTS curriculum_chunks_topic_status_idx
  ON curriculum_chunks (topic_id, status);

-- Function for hybrid retrieval: vector + lexical.
-- Returns chunks scored by weighted combination of cosine similarity and
-- a simple lexical overlap (ts_rank_cd). The retriever calls this via
-- raw SQL through the VectorStore interface.
CREATE OR REPLACE FUNCTION curriculum_chunks_hybrid_search(
  query_embedding vector,
  query_text      text,
  filter_grade    int,
  filter_subject  uuid,
  top_k           int,
  vec_weight      float DEFAULT 0.7,
  lex_weight      float DEFAULT 0.3
)
RETURNS TABLE (
  chunk_id          uuid,
  topic_id          uuid,
  content           text,
  source_ref        text,
  version           text,
  vector_score      float,
  lexical_score     float,
  combined_score    float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id            AS chunk_id,
    c.topic_id      AS topic_id,
    c.content       AS content,
    c.source_ref    AS source_ref,
    c.version       AS version,
    -- Cosine similarity -> score in [0,1] (cosine distance is 0..2).
    (1.0 - (c.embedding <=> query_embedding))::float AS vector_score,
    -- Lexical overlap via ts_rank (cheap, language-neutral baseline).
    COALESCE(ts_rank_cd(to_tsvector('simple', c.content), plainto_tsquery('simple', query_text)), 0)::float AS lexical_score,
    (
      vec_weight  * (1.0 - (c.embedding <=> query_embedding)) +
      lex_weight  * COALESCE(ts_rank_cd(to_tsvector('simple', c.content), plainto_tsquery('simple', query_text)), 0)
    )::float AS combined_score
  FROM curriculum_chunks c
  JOIN topics t ON t.id = c.topic_id
  JOIN units  u ON u.id = t.unit_id
  WHERE c.status = 'published'
    AND u.subject_id = filter_subject
  ORDER BY combined_score DESC
  LIMIT top_k;
$$;

-- Sanity check: verify extensions are installed.
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM pg_extension WHERE extname = 'vector') = 1,
    'pgvector extension not installed';
  RAISE NOTICE 'GROOT: pgvector migration applied (HNSW + hybrid_search function)';
END
$$;
