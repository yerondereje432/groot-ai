/**
 * Single source of truth for default Gemini model IDs.
 *
 * Every call site (LLM generation, embeddings, LLM-based re-ranking, OCR)
 * previously hardcoded its own fallback model string independently
 * (`gemini-3.5-flash` in one file, `gemini-1.5-flash` in another,
 * `gemini-embedding-2` in a third) which makes it easy for defaults to
 * silently drift out of sync with each other and with whatever's actually
 * current/available on the Gemini API.
 *
 * All of these remain overridable via env (`LLM_MODEL`, `EMBEDDING_MODEL`,
 * `RERANKER_MODEL`) — these are just the fallback when the env var is unset.
 * Before changing a default here, verify the model id against the live
 * catalog: `GET https://generativelanguage.googleapis.com/v1beta/models?key=...`
 * (see `apps/ingestion-worker/scripts/list-models.ts`), since Gemini model
 * availability and naming changes over time.
 */
export const GEMINI_MODELS = {
  /** Text generation (tutor completions, question generation). */
  generation: 'gemini-2.5-flash',
  /** Text embeddings (retrieval). */
  embedding: 'gemini-embedding-001',
  /** LLM-based re-ranking — cheap/fast model is fine since it's pointwise scoring. */
  rerank: 'gemini-2.5-flash',
  /** Vision OCR for scanned PDF pages. */
  ocr: 'gemini-2.5-flash',
} as const;
