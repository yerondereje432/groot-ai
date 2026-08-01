-- =============================================================
-- GROOT — Postgres initialization script
-- Runs once on first container startup (mounted via docker-entrypoint-initdb.d)
-- Per spec §15: enable pgvector for MVP vector storage
-- =============================================================

-- Required for vector similarity search (HNSW index created in migration)
CREATE EXTENSION IF NOT EXISTS vector;

-- Required for UUID generation (used as primary key type per §41)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Useful for analytics queries and JSON ops
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Useful for ad-hoc text search on curriculum content (hybrid retrieval)
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Verify
DO $$
BEGIN
  RAISE NOTICE 'GROOT: pgvector enabled';
  RAISE NOTICE 'GROOT: extensions ready: uuid-ossp, pg_trgm, btree_gin';
END
$$;
