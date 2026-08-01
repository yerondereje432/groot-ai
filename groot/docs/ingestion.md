# GROOT — Curriculum Ingestion Pipeline

Per spec §16: the ingestion pipeline is async, versioned, and gated by human
QA review before chunks become queryable.

## Pipeline

```
        ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
PDF ──► │  Parse  │ ──► │  Chunk  │ ──► │  Embed  │ ──► │  Store  │ ──► │   QA    │ ──► │  Live   │
        └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                                                                 (human reviewer)
```

### 1. Parse (`apps/ingestion-worker/src/parse/index.ts`)

Supports:
- **Markdown** (`.md`, `.markdown`) — splits on heading levels.
- **Plain text** (`.txt`) — splits on double newlines.
- **PDF** (`.pdf`) — uses `pdf-parse` for text-layer PDFs. OCR for scanned
  PDFs is deferred (see ASSUMPTIONS.md).

Language detection identifies Ge'ez-heavy text as Amharic and routes it
accordingly.

### 2. Chunk (`apps/ingestion-worker/src/chunk/index.ts`)

Per spec §16 step 4: **semantic, 300–500 tokens, topic-tagged**.

- Sentence splitter handles both Latin and Ge'ez (uses `።` U+1362).
- Pack sentences into chunks respecting min/max token budgets.
- Carry a small overlap between chunks so context isn't lost at boundaries.
- Section headings are propagated to chunk metadata.

### 3. Embed (`apps/ingestion-worker/src/embed/index.ts`)

Batch embedding. Production should call the AI service's `/v1/embed`
endpoint so the model stays in lock-step. The vertical uses a local stub
(kept byte-identical to the AI service's stub for this reason).

### 4. Store (`apps/ingestion-worker/src/pipeline.ts`)

Inserts into `curriculum_chunks` with `status='draft'`. Chunks carry:

- `id` (UUID)
- `topic_id` (FK to curriculum hierarchy)
- `content` (text)
- `source_ref` (e.g. "Grade-9-Science.pdf p.42 §Photosynthesis")
- `version` (semver-style, e.g. "2024.1")
- `embedding` (pgvector)

Each run also writes to `audit_logs` (§27).

### 5. QA gate (§16 step 6)

A platform admin reviews chunks before promotion. The endpoints:

- `GET  /api/v1/ingestion/pending` — list draft versions + chunk counts.
- `POST /api/v1/ingestion/approve/:version` — promote draft → published.

In the vertical, `npm run ingest:sample` auto-approves so the retriever
has data. Production deployments should disable auto-approval and require
manual review.

### 6. Versioning (§16 step 7)

Each ingestion creates a new version (e.g., "2024.1", "2024.2"). Vectors
are tagged with the version so a re-ingestion doesn't break live queries:

- Old version's chunks remain queryable until they're explicitly archived.
- New version's chunks are queryable once approved.
- Rollback: flip the active version flag (deferred to a future iteration).

## Running it

```bash
# 1. Apply seed (subjects/units/topics)
psql "$DATABASE_URL" -f apps/ingestion-worker/sample-curriculum/seed.sql

# 2. Run the ingestion worker (consumes jobs from Redis queue)
npm run dev:ingestion

# 3. In a separate terminal, run the sample ingest
npm run ingest:sample

# 4. Approve drafts (in production: manual review)
curl -X POST http://localhost:3000/api/v1/ingestion/approve/2024.1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Future work

- **OCR for scanned PDFs** — needs a Ge'ez-aware OCR model.
- **Equation extraction** — preserve mathematical notation through chunking.
- **Table handling** — current chunker flattens tables; consider structured
  preservation for science subjects.
- **Diff-based re-embedding** — only re-embed chunks whose source text
  changed (§37 cost optimization).
- **Auto-rollback on QA failure** — currently QA is one-shot.
