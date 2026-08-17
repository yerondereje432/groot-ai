# GROOT (Unified & Optimized)

**Curriculum-locked AI study companion for Ethiopian high-school students.**

This repository has been refactored into a **Production-Grade Monorepo** that unifies the high-fidelity UI with a robust NestJS/TypeScript backend. All previous version conflicts and complexities have been resolved.

---

## 🚀 What's fixed vs. what's still open

### Resolved
- **Dual-version conflict** — single monorepo at root. The legacy FastAPI prototype is gone;
  its Gemini logic was ported into the production NestJS/TS stack.
- **Live AI integration** — the AI service calls **Google Gemini** (1.5 Flash) for real, both
  for tutoring completions and embeddings, not a stub. Falls back safely to the deterministic
  stub if `GEMINI_API_KEY` is unset (see `.env.example`).
- **LLM-based re-ranking** — `RERANKER_PROVIDER=gemini` scores retrieved chunks against the
  query via a Gemini call instead of lexical-overlap-only matching, with automatic fallback to
  the lexical stub on any failure. See `ASSUMPTIONS.md` §D3.
- **OCR fallback for scanned textbooks** — `PdfParser` now falls back to Gemini-vision OCR
  (`GeminiOcrParser`) when text-layer extraction looks too sparse to be real, so scanned
  Amharic/Ge'ez pages aren't a hard ingestion blocker anymore. **Untested against real scanned
  MoE textbooks — needs a human QA pass before trusting OCR'd content in production.** See
  `ASSUMPTIONS.md` §F1 for the caveats.
- **Frontend disconnect** — the Next.js "Glassy Verdigris" UI is the one official frontend
  (`apps/web`), integrated into the monorepo build.
- **Ingestion parsing** — `AdvancedPdfParser` uses header-detection heuristics and noise
  removal for textbook-layout PDFs.
- **Local dev friction** — one script (`kickstart.sh`) + `npm run dev` starts the stack.

### Still open
- Re-ranker and OCR fallback are new and unverified against real production traffic/documents —
  treat both as "should work" rather than "battle-tested."
- SMS OTP delivery and payment providers remain clean interfaces without real credentials wired
  in (Telebirr/Chapa, Twilio-equivalent) — intentionally deferred, see `ASSUMPTIONS.md` §A2.
- No load testing yet (§E1); Terraform/k8s manifests deferred (§29–30).

---

## 🚀 Kickstart

We have provided a unified script that handles infrastructure, environment, dependencies, and database setup in one go.

```bash
chmod +x kickstart.sh
./kickstart.sh
```

### 4. Run Everything (One Command)
```bash
# Start DB, Redis, API, AI-Service, and Frontend
npm run dev
```
- **Web UI:** http://localhost:3000
- **API:** http://localhost:3001
- **Adminer (DB UI):** http://localhost:8081

---

## 📂 New Repository Layout
```
groot/
├── apps/
│   ├── web/              # Next.js 14 (Glassy Verdigris UI)
│   ├── api/              # NestJS (Auth, Curriculum, Tutor)
│   ├── ai-service/       # AI Orchestrator & Guardrails
│   └── ingestion-worker/ # Advanced PDF/MD Ingestion
├── packages/
│   └── shared-types/     # Shared DTOs and Logic
├── infra/                # Docker & DB Init scripts
└── docker-compose.yml    # Database & Redis infrastructure
```

---

## ✅ Status
- [x] Unified monorepo, single source of truth
- [x] High-fidelity Glassy UI
- [x] Advanced PDF ingestion + Gemini-vision OCR fallback for scanned pages
- [x] Zero-friction local setup
- [x] Provider-agnostic AI interfaces, with Gemini wired for LLM, embeddings, and re-ranking
- [ ] SMS OTP / payment providers — interfaces only, no real credentials
- [ ] Production load testing, IaC, observability wiring
