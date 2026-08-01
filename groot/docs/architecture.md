# GROOT — Architecture

This document captures the architectural decisions in the Groot platform as
implemented in this vertical. It is the engineering source of truth alongside
the master specification (`/SPEC.md` if it existed in full).

## High-level

Groot is a **modular monolith for MVP → service extraction at scale**
([DEFAULT] per spec §8).

```
┌──────────────┐  HTTPS/SSE  ┌──────────────┐  REST  ┌───────────────┐
│ Web (PWA)    │ ──────────► │ Core API     │ ─────► │ AI/RAG svc    │
│ React 18+TS  │             │ NestJS       │        │ (TS, swappable│
│ Vite, PWA    │             │ Prisma       │        │  Python later)│
└──────────────┘             └──────┬───────┘        └───────┬───────┘
                                   │ BullMQ                  │
                                   ▼                         ▼
                            ┌──────────────┐         ┌──────────────┐
                            │ Ingestion    │ ──────► │ Postgres +   │
                            │ Worker       │         │ pgvector     │
                            │ (TS)         │         │ Redis        │
                            └──────────────┘         └──────────────┘
```

## Apps and their concerns

| App | Concern | Tech |
|---|---|---|
| `apps/web` | Mobile-first PWA, offline shell, SSE consumer | React 18 + TS + Vite |
| `apps/api` | Auth, RBAC, CRUD, payments, SSE proxy, free-tier metering | NestJS + Prisma + Zod |
| `apps/ai-service` | Orchestrator, retriever, prompt assembler, guardrails, LLM provider | TS + Fastify + zod |
| `apps/ingestion-worker` | Async curriculum pipeline (parse → chunk → embed → version) | TS + BullMQ |
| `packages/shared-types` | DTOs and types — the API contract | TS |

## Boundaries

- **`apps/api` ↔ `apps/ai-service`** is REST. The API does not re-implement
  the orchestrator; it forwards requests and relays SSE. This keeps the
  AI service independently deployable and rewriteable (e.g., to Python
  FastAPI per §10 alt).
- **`apps/ingestion-worker` ↔ `apps/ai-service`** — for the vertical, the
  worker uses a local stub embedder (kept byte-identical to the AI service's
  stub). Production should call the AI service's `/v1/embed` endpoint or
  share a library to keep models in lock-step.
- **`apps/web` ↔ `apps/api`** — Vite dev-server proxies `/api/*` to the
  NestJS API on port 3000; in production, the API and web are behind the
  same domain and the proxy is unnecessary.

## Data model highlights

- **Curriculum hierarchy**: `subjects → units → topics → curriculum_chunks`.
- **Chunks** carry `embedding (vector(384))`, `status (draft|review|published|archived)`,
  and `version` (semver-style). The `status` column drives the QA gate (§16 step 6).
- **Vector index**: HNSW with `m=16, ef_construction=64` per pgvector docs —
  good defaults for ≤10M rows.
- **Hybrid retrieval** uses a SQL function `curriculum_chunks_hybrid_search`
  that combines cosine similarity (from `<=>` operator) and `ts_rank_cd`
  lexical scoring. Metadata filtering by `grade` + `subject_id` is enforced
  in SQL so a Grade 9 query cannot retrieve Grade 10 chunks (§14 metadata
  filtering requirement).

## Authentication

- Phone-first registration with OTP via SMS [DEFAULT per §12].
- JWT access tokens (15 min) + rotating refresh tokens (30 d).
- Argon2id for any password fallback.
- RBAC enforced via NestJS guards (`JwtAuthGuard` + `RolesGuard`).
- In this vertical, OTP delivery is `ConsoleSmsProvider` — logs to console.
  Real wiring needs an Ethiopian SMS gateway.

## Streaming

- **SSE** [DEFAULT per §8] for tutor responses. Lighter than WebSockets on
  3G (§34 low-bandwidth constraint).
- The API sets `Content-Type: text/event-stream`, `X-Accel-Buffering: no`
  (so nginx doesn't buffer), and flushes headers before streaming.
- The web app uses a manual SSE parser (`postSse`) because `EventSource`
  doesn't support POST.

## Observability

- All services emit structured JSON logs via pino.
- Correlation IDs are generated on each request and emitted on errors.
- The orchestrator has hooks (`recordOutcome`) for writing to a telemetry
  sink (deferred). Production should:
  - Track retrieval confidence per query (§31 AI observability)
  - Track cache hit rate (§37 cost optimization)
  - Track token usage per request for cost-per-user dashboards

## Security posture

- TLS 1.3 in transit (assumed at the load balancer in production).
- AES-256 at rest (assumed at the volume layer).
- Argon2id password hashing.
- JWT short-lived + refresh rotation.
- Zod validation on the AI service; class-validator on the API.
- PII redaction in the prompt assembly stage (§27 AI safety).
- Prompt-injection resistance is layered:
  1. The LLM is forbidden by system prompt to use pretrained knowledge.
  2. Retrieval only returns chunks filtered by grade + subject.
  3. Unsafe-request guard rejects known-harmful patterns.

## What's not yet wired (and why)

- **Real LLM provider** — interfaces designed but stub used. When the
  OpenAI/Anthropic keys arrive, swap `StubLLMProvider` for the real impl
  in `apps/ai-service/src/main.ts`. The orchestrator does not change.
- **Real embeddings** — same pattern.
- **OCR for scanned PDFs** — Ge'ez text in scanned pages requires an
  OCR model with Ge'ez support; deferred to a future iteration (§38).
- **Payment providers** — interfaces designed (§23/24/25); full wiring
  requires Telebirr/Chapa merchant credentials.
- **Cross-region data residency** — single-region dev setup only (§27).
