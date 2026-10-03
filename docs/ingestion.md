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
- **PDF** (`.pdf`) — uses `pdf-parse` for text-layer PDFs via
  `AdvancedPdfParser`, falling back to Gemini OCR (`src/parse/gemini-ocr.ts`)
  when `looksLikeScannedDocument()` detects low text density. OCR quality
  against real scanned Ethiopian MoE textbooks is still unverified — no
  scanned sample was available (see ASSUMPTIONS.md).

Language detection identifies Ge'ez-heavy text as Amharic and routes it
accordingly.

#### Validated against a real textbook

`Books/G10-History-STB-2023-web.pdf` (246 pages, Ministry of Education
Grade 10 History) is checked into this repo and was used to validate
`AdvancedPdfParser` end-to-end (`apps/ingestion-worker/scripts/validate-pdf.ts`
is the reusable tool; `src/parse/advanced-pdf.test.ts` has the regression
tests). It's a born-digital PDF (density ~1340 chars/page, well above the
scanned-document threshold), so it doesn't exercise the OCR fallback path —
that part is still unverified — but running the real parsing path against
it surfaced and fixed three real, previously-latent bugs:

1. **Every chunk's page citation was wrong.** `AdvancedPdfParser` split
   pages on a form-feed character (`text.split(/\f/)`) that `pdf-parse`'s
   own default output *never contains* — its default page-joiner is a
   plain `"\n\n"` (confirmed by reading `pdf-parse`'s source). In practice
   this collapsed the entire document into a single "page," so every
   `source_ref` (e.g. "p.42") would have cited the wrong page for almost
   any real PDF. Fixed by passing a custom `pagerender` callback to
   `pdf-parse` that explicitly appends a `\f` marker per page.
2. **Running headers/footers fragmented sections.** A chapter/unit title
   printed in the header of every page (e.g. "Unit 1 | Development of
   Capitalism...") matched the heading-detection regexes on *every* page
   it appeared on, shattering one coherent chapter into dozens of
   near-empty fragments (224 bogus sections on the real book, dropping to
   144 once fixed). Fixed with a frequency-based running-header/footer
   filter: a line repeating verbatim across many pages is treated as page
   furniture, not a heading, regardless of its shape.
3. **Section page numbers pointed at the wrong end of the section.** The
   page recorded for a section was the page where the *next* heading was
   found (i.e. where the section ends), not where it started — a chapter
   spanning pages 5–20 was cited as page 20. Fixed by tracking the start
   page explicitly.
4. (Smaller) table-of-contents lines using dot leaders ("2.6 Impacts of
   Colonial Rule .................... 39") matched the same "N.N Title"
   heading regex as a real section heading and got treated as one. Fixed
   with a dot-leader line filter.

After these fixes, page attribution across the real 246-page book is
monotonically increasing end-to-end with zero regressions, and the
previously-latent ToC/running-header noise is gone (down to 1 tiny
fragment out of 144 detected sections, vs. 4/224 before).

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
