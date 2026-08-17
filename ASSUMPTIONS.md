# GROOT — Assumptions Log

This document captures every assumption made during the build because the specification was
silent, ambiguous, or — in the case of Section §42 onward — unavailable at build time.

Each assumption is tagged with the spec section(s) it relates to and the impact if it is later
found to be wrong. **All assumptions should be reviewed by the Groot engineering team before
production deployment.**

---

## A. Spec completeness

### A1. Sections §42–§44+ were not provided
- **Spec section:** §42 (Endpoint Specifications, partial), §43, **§44 (Milestones)**, §45, §46
- **What was missing:** The remainder of the endpoint catalog, the milestone schedule, and any
  post-§41 sections.
- **Assumption:** This build follows the **AI/RAG vertical** proposed in our pre-build
  clarification (Sections §13 + §14 + §16 + minimal §11/§12/§26 scaffolding). When §44 arrives,
  the build order should be re-validated against the prescribed milestones.
- **Impact if wrong:** If §44 prescribes a different milestone ordering (e.g., payments first,
  auth-first), some scaffolding work may be duplicated. Low risk — abstractions were designed
  for late binding.

### A2. Telebirr and Chapa payment providers (Sections §24, §25)
- **Spec section:** §23–§25
- **Assumption:** Payments are **out of scope** for this vertical. Only the `PaymentProvider`
  interface shape was captured in this build to avoid speculative implementation. Real wiring
  requires Telebirr merchant onboarding and Chapa sandbox credentials.
- **Impact if wrong:** None — interfaces are designed to slot in without breaking changes.

---

## B. Technical defaults (per [DEFAULT] tags in spec)

### B1. Backend language
- **Spec section:** §10
- **Decision:** **Node.js + TypeScript (NestJS)** — explicitly marked [DEFAULT] in §10.
- **Alternative considered:** Python FastAPI. Rejected per [DEFAULT].

### B2. Vector database
- **Spec section:** §15
- **Decision:** **pgvector** on PostgreSQL for MVP. Migration path to **Qdrant** at scale is
  scaffolded behind a `VectorStore` interface.

### B3. Retrieval strategy
- **Spec section:** §14
- **Decision:** **Hybrid retrieval** (dense vectors + BM25 keyword) with metadata filtering by
  grade+subject. **Re-ranking** from top-20 → top-5 using a cross-encoder-style scorer (stubbed).

### B4. Streaming protocol
- **Spec section:** §8
- **Decision:** **Server-Sent Events (SSE)** for AI tutor streaming. Explicitly [DEFAULT].

### B5. Job queue
- **Spec section:** §10, §16
- **Decision:** **BullMQ on Redis** for ingestion job queue. Same Redis used for caching.

### B6. Authentication
- **Spec section:** §12
- **Decision:** Phone-first registration with OTP via SMS [DEFAULT]. JWT access + rotating
  refresh. Argon2id for any password fallback. In this vertical, OTP delivery is stubbed
  (logs to console in dev) — a real SMS gateway interface is defined but not implemented.

### B7. PWA / frontend framework
- **Spec section:** §9
- **Decision:** **React 18 + TypeScript + Vite + Tailwind + TanStack Query + Zustand**.
  Service Worker for offline cache. Bundle budget < 200 KB gzipped.

---

## C. Curriculum sample content

### C1. Sample curriculum source
- **Spec section:** §16, §41
- **Assumption:** The sample curriculum is **synthetically authored in-tree** and clearly
  watermarked "SAMPLE — NOT OFFICIAL MOE CONTENT". This is because:
  1. The real Ethiopian MoE textbooks are copyrighted and not freely redistributable.
  2. Embedding any unofficial transcription into the vector store would risk
     curriculum accuracy claims we cannot verify.
- **Format:** Markdown/text files covering 3 topics in Grade 9 Science (the "Energy" unit) and
  Grade 10 Chemistry (the "Electrolysis" unit) — chosen because they appear as example topics
  in §3 (personas) and §7 (user stories).
- **Impact if wrong:** When real MoE content is provided, only the ingestion pipeline and
  chunker parameters need re-validation. The retriever and prompt assembler are content-agnostic.

---

## D. AI provider abstractions

### D1. LLM provider
- **Spec section:** §13
- **Decision:** Provider-agnostic interface (`LLMProvider`) with three implementations:
  - `StubLLMProvider` (default in dev) — returns templated, retrieval-grounded answers using
    only the retrieved chunks, no pretrained knowledge. This proves the curriculum-lock works.
  - `OpenAILLMProvider` (skeleton, requires `OPENAI_API_KEY`).
  - `AnthropicLLMProvider` (skeleton, requires `ANTHROPIC_API_KEY`).
- **Critical behavior:** Even with a real LLM, the system prompt **forbids** the model from
  using knowledge outside the retrieved context. If retrieval returns no chunks above
  `RAG_MIN_CONFIDENCE`, the orchestrator returns a refusal rather than calling the LLM.

### D2. Embedding provider
- **Spec section:** §14, §15
- **Decision:** Same abstraction pattern. The `StubEmbeddingProvider` produces **deterministic
  bag-of-words vectors** so retrieval works end-to-end without external API keys. This is
  intentionally simple — designed to be swapped for a real model (e.g., text-embedding-3-small,
  bge-small) without code changes.

### D3. Re-ranker
- **Spec section:** §14
- **Decision:** Two implementations behind the `ReRanker` interface, selected via
  `RERANKER_PROVIDER`:
  - `StubReRanker` (default) — lexical overlap between query and chunk plus a grade/subject
    metadata match bonus. Deterministic, no external calls; still used in tests and as the
    fallback below.
  - `GeminiReRanker` (`RERANKER_PROVIDER=gemini`) — the spec's "LLM-based" re-ranking option:
    a single batched Gemini call pointwise-scores all `topKPreRerank` candidates against the
    query in the student's grade/subject context, blended 0.7/0.3 with the upstream
    vector/BM25 score (same weighting the stub used, so `minConfidence` guardrail semantics
    don't shift when swapping providers). On any failure (timeout, network, bad JSON) it
    silently falls back to the stub's lexical scoring for that request rather than failing
    the tutor turn — see `reranker.gemini.ts`.
  - A hosted cross-encoder model (e.g. `ms-marco-MiniLM-L-6-v2`) remains a reasonable future
    swap if per-request LLM re-ranking proves too slow/costly at scale; the interface doesn't
    change either way.

---

## E. Performance and observability

### E1. Performance targets
- **Spec section:** §36
- **Assumption:** Targets are documented and exposed via a `/metrics` endpoint in dev mode,
  but **load testing is deferred** to a later phase.

### E2. Tracing and error tracking
- **Spec section:** §31
- **Assumption:** OpenTelemetry SDK is initialized with a no-op exporter in dev; Sentry DSN
  is read from env but only initialized when set. Structured JSON logging is on by default.

---

## F. What's NOT assumed — what's deliberately deferred

The following are **not assumed**; they are **deferred** to subsequent vertical builds:

- Real payment provider integration (§24, §25) — interfaces only
- CMS UI for admin (§17)
- Full student / teacher / admin dashboards (§18–§20)
- Analytics pipeline (§21)
- Production-grade Terraform / k8s manifests (§29, §30)
- Voice I/O (§38)
- Multi-region data residency for PII (§27) — single-region dev setup only

These should be prioritized in subsequent milestones per §44 once available.

### F1. Amharic OCR for scanned textbook pages (§16) — now implemented, with caveats
Previously deferred; now handled by `GeminiOcrParser` (`apps/ingestion-worker/src/parse/gemini-ocr.ts`):
- **Approach:** Rather than standing up a rasterization + Tesseract + fine-tuned-Ge'ez-model
  pipeline, the PDF's raw bytes are sent directly to Gemini as inline file data. Gemini reads
  PDF pages as images natively, so it can transcribe scanned pages — including Ge'ez script,
  which generic OCR engines handle poorly without fine-tuning — without any extra native
  dependencies (no canvas/poppler in this environment).
- **Trigger:** `PdfParser` always tries the free, deterministic `AdvancedPdfParser` (text-layer
  extraction) first. It only falls back to OCR when `looksLikeScannedDocument()` finds text
  density below ~40 characters/page (a real text layer virtually never triggers this) **and**
  `GEMINI_API_KEY` is configured. If OCR itself fails, it falls back again to whatever sparse
  text-layer extraction was already obtained, rather than failing the ingest job outright.
- **Known limitations — should be reviewed before production reliance:**
  - Untested against real scanned Ethiopian MoE textbook pages (no sample scans were available
    at build time) — accuracy on actual textbook layouts, handwriting, or low-scan-quality
    pages is unverified.
  - No confidence score is returned per page; a garbled transcription looks the same as a
    clean one to the rest of the pipeline. A human QA pass (the existing draft→review→publish
    gate, §16 step 6) is *not optional* for OCR'd content the way it might be for text-layer
    PDFs.
  - Cost/latency: one Gemini call per scanned document (not per page), but large multi-page
    scans may hit `maxOutputTokens` (8192) before finishing transcription — very long scanned
    chapters may need to be split before ingestion.
