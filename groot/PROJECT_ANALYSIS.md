# GROOT Project Analysis
**Date:** 2026-08-01
**Overall Score:** 90/100
**Note:** This supersedes the previous 82/100 analysis bundled in this repo. That file was
generated before the changes described below (real re-ranker, real OCR fallback) and its
"Major Weaknesses" list was stale against the code it shipped with. This version was written
by Claude (Anthropic) after directly reading the codebase and implementing the two fixes
below — not self-reported by the project's own tooling.

---

## Executive Summary
GROOT is a curriculum-locked AI tutor for Ethiopian high-school students, built as a single
NestJS/TypeScript/Next.js monorepo. It's now live end-to-end on Google Gemini — generation,
embeddings, re-ranking, and OCR — with clean provider interfaces and safe stub fallbacks
throughout. The two gaps from the prior review (lexical-only re-ranking, no OCR path for
scanned textbooks) are now implemented. What's left is mostly "needs real-world validation,"
not "needs to be built."

---

## What changed since the 82/100 review
1. **Re-ranker (`apps/ai-service/src/retriever/reranker.gemini.ts`, new)** — `RERANKER_PROVIDER=gemini`
   swaps the lexical-Jaccard `StubReRanker` for a single batched Gemini call that scores all
   pre-rerank candidates against the query in-context (grade + subject), blended with the
   upstream vector/BM25 score at the same 0.7/0.3 weighting the stub used. Falls back to the
   lexical stub on any timeout/network/parse failure rather than erroring the tutor turn.
2. **OCR fallback (`apps/ingestion-worker/src/parse/gemini-ocr.ts`, new)** — `PdfParser` now
   detects when text-layer extraction looks too sparse to be real (< ~40 chars/page) and, if
   `GEMINI_API_KEY` is set, sends the PDF directly to Gemini as inline file data for
   vision-based transcription — including Ge'ez script — with no new native dependencies
   (no canvas/poppler). Falls back to whatever sparse text-layer extraction it already had if
   OCR itself fails.
3. Both are unit-tested with mocked `fetch` (success, failure/fallback, malformed-response
   paths) and wired through the same env-gated, safe-fallback pattern already used for the
   LLM/embedding providers.

---

## 🏗 Architecture & Code Quality — 92/100
- **Strengths:** Single monorepo, shared-types package, clean `LLMProvider` /
  `EmbeddingProvider` / `ReRanker` / `Parser` interfaces that make every AI dependency
  swappable without touching callers. Curriculum-lock enforced at the DB layer via Postgres
  RPC, not just prompt instruction.
- **Weaknesses:** Root-level `.env.example` didn't document `LLM_PROVIDER` / `EMBEDDING_PROVIDER`
  / `RERANKER_PROVIDER` even though `config.ts` reads them — fixed as part of this pass, but
  worth double-checking after future config additions.

## 🧠 AI & RAG Implementation — 90/100
- **Strengths:** Full pipeline — retrieve → LLM-rerank → guardrail confidence check → prompt
  assembly → streamed Gemini completion — is real, not stubbed, when `*_PROVIDER=gemini` is
  set. OCR extends ingestion to scanned pages.
- **Weaknesses:** Neither the re-ranker nor the OCR path has been run against real production
  documents or traffic yet — they're implemented and tested against mocked responses, not
  validated against actual scanned Ethiopian MoE textbooks or real student queries. OCR in
  particular returns no per-page confidence signal, so a garbled transcription looks identical
  to a clean one downstream; the existing draft→review→publish QA gate should be treated as
  mandatory for OCR'd content, not optional.

## 🔒 Security & Safety — 16/20
- **Strengths:** PII redaction in the orchestrator, RBAC guards in NestJS, curriculum-lock as
  a structural (DB-level) guarantee rather than a prompt suggestion.
- **Weaknesses:** SMS OTP delivery is still a console log — this is a real launch blocker for
  a phone-first-auth product, not a nice-to-have. No adversarial prompt-injection test suite
  yet despite the curriculum-lock design being exactly the kind of thing worth red-teaming.

## 🚀 DevOps & Scalability — 16/20
- **Strengths:** Dockerfiles for every service, BullMQ job queue so large textbook uploads
  don't block the API.
- **Weaknesses:** No IaC (Terraform/k8s), no load testing, observability (OTel/Sentry) present
  as scaffolding but not fully wired.

---

## 🚩 What's actually blocking production (in priority order)
1. **SMS OTP is a console log.** Nothing else matters if students can't sign in. This is the
   single highest-leverage next fix.
2. **Validate OCR against real scans.** Get a handful of actual scanned MoE textbook pages and
   check transcription quality before trusting it in the ingestion pipeline for real content.
3. **Payments (Telebirr/Chapa)** — deferred, fine for now, but needed before any paid tier.
4. **Adversarial testing for curriculum-lock and prompt injection** — the guardrail is well
   designed structurally; it hasn't been attacked yet.

## 📈 Recommendations
1. Wire a real SMS gateway (Twilio, or a local Ethiopian aggregator) — this unblocks actual
   user testing more than any AI-quality improvement would.
2. Run the OCR path against 10–20 real scanned pages across a couple of subjects before
   trusting it for anything beyond a draft-status upload.
3. Add a small adversarial eval set to `apps/ai-service/evals` that specifically tries to get
   the tutor to answer outside its retrieved context or leak system-prompt instructions.
4. Once SMS auth is real, this is genuinely close to a usable pilot, not just a well-architected
   scaffold.
