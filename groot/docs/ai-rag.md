# GROOT — AI / RAG Pipeline

The **core differentiator** of Groot: a tutor that is **curriculum-locked**.
Every answer is grounded in the official Ethiopian MoE curriculum via RAG.
The model is forbidden by system prompt from using pretrained knowledge.

## Layered design

Per spec §13:

```
   ┌────────────────────────────────────────────────────────────┐
   │  1. Orchestrator (intent classification + flow control)    │
   │  2. Retriever (hybrid search, metadata filter, re-rank)    │
   │  3. Prompt assembler (curriculum-locked system prompt)     │
   │  4. LLM provider (swappable, streams tokens)               │
   │  5. Post-processor (citations, language enforcement)       │
   │  6. Guardrails (curriculum-lock, unsafe-request, PII)       │
   └────────────────────────────────────────────────────────────┘
```

## Why hybrid retrieval

Per spec §14: hybrid is [DEFAULT].

- **Dense vectors** capture semantic similarity — paraphrases, synonyms,
  related concepts.
- **BM25 (lexical)** captures exact-term matches — formulas, named laws,
  proper nouns (e.g., "Calvin cycle", "Urea cycle", "Newton's second law").

Ethiopian exam prep is heavy on exact terminology. A dense-only retriever
can miss the exact term the student asked for; a lexical-only retriever
misses paraphrases. Hybrid wins on both.

The current implementation uses a SQL function
`curriculum_chunks_hybrid_search` that combines:
- `1 - (embedding <=> query_embedding)` — cosine similarity, in [0, 1].
- `ts_rank_cd(to_tsvector('simple', content), plainto_tsquery('simple', query))` — Postgres lexical.

Weights: `0.7 * vector + 0.3 * lexical` by default, tunable per query.

## Metadata filtering is mandatory

A Grade 10 Chemistry query must NEVER return Grade 9 Science chunks. This
is enforced at three layers:

1. **SQL function** filters by `subject_id` and `grade`.
2. **Re-ranker** boosts chunks in the requested topic if `topicId` is set.
3. **Application logic** in the orchestrator validates that the top
   result's metadata matches the request before proceeding.

## Guardrails

### Curriculum-lock guard

If retrieval returns no chunks above `RAG_MIN_CONFIDENCE` (default 0.35),
the orchestrator **refuses** rather than calling the LLM. This is the
single most important defense against hallucination.

Refusal message is localized:

- English: "This question may be outside your curriculum. Please consult
  your textbook or teacher for guidance."
- Amharic: "ይቅርታ፣ ይህ ጥያቄ ከኮሪኩለምህ ውጭ ሊሆን ይችላል። በተጨማሪ እባክህ ትምህርት ሰነድህን ይመልከቱ።"

### Unsafe-request guard

A small blocklist catches the most obvious harmful requests (self-harm,
weapon-making, child exploitation). Production should add a dedicated
moderation model call before the LLM call.

### PII guard

Phone numbers and emails are redacted from the prompt before sending
to the LLM. Defense in depth — not exhaustive, but the obvious patterns
are caught.

## Re-ranking

Per spec §14: cross-encoder or LLM-based re-ranking on top-20 → top-5.

The vertical ships a **stub re-ranker** that uses:
- Jaccard token overlap between query and chunk.
- Metadata boost when `topicId` matches.

To wire a real cross-encoder (e.g., `cross-encoder/ms-marco-MiniLM-L-6-v2`),
implement the `ReRanker` interface and replace the `StubReRanker` in
`apps/ai-service/src/main.ts`.

## Streaming

The orchestrator yields events:

```
{ type: 'start', sessionId, intent }
{ type: 'citation', citation: { chunkId, topicId, sourceRef } }
{ type: 'token', delta: '...' }       // repeated
{ type: 'done', citations, confidence }
```

The API relays these as SSE frames to the client. The web app parses them
and updates the chat UI incrementally.

## Caching

Per spec §37: semantic caching reduces cost and latency for repeated queries.

The vertical ships an in-memory exact-match cache. The `RedisSemanticCache`
class is also provided — wiring it requires initializing an ioredis client
in `apps/ai-service/src/main.ts`.

A future iteration could key the cache by embedding similarity (e.g.,
0.95 cosine threshold) so paraphrased queries hit the cache too.

## The eval gate

Per spec §32: the RAG eval suite is **non-negotiable**.

The harness in `apps/ai-service/evals/run.ts` exercises four dimensions:

1. **Retrieval accuracy** — does the expected chunk land in top-K?
2. **Intent classification** — is `explain` / `generate_questions` correctly detected?
3. **Answer correctness** — does the answer mention expected keywords?
4. **Refusal correctness** — do off-curriculum queries get refused?

CI runs the gate on every PR. Failure blocks deploy (§33).

## Cost & observability

The orchestrator exposes hooks to record per-query:
- Retrieval latency
- Top score
- Chunk count returned
- LLM token usage
- Whether the response was an answer or a refusal

Wire these into Prometheus + Grafana (§31) and the cost-per-user dashboard
(§37) once the LLM provider is real.
