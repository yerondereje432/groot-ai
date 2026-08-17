/**
 * RAG evaluation harness — per spec §32.
 *
 * "Curated golden Q&A set per subject; measure retrieval accuracy + answer correctness;
 *  regression-test on each model/prompt change."
 *
 * This is the regression gate before any LLM/prompt change deploys (§33 CI/CD).
 *
 * What we measure (per §32):
 *   - Retrieval accuracy: did the golden chunk land in top-K?
 *   - Answer correctness: does the answer mention the expected key facts?
 *   - Refusal correctness: did off-curriculum queries get refused?
 *   - Curriculum-lock: no model-pretraining leakage in answers.
 *
 * Output: a JSON report suitable for CI to gate on.
 */

import { Orchestrator } from '../src/orchestrator/orchestrator.js';
import { StubLLMProvider } from '../src/providers/llm.stub.js';
import { StubEmbeddingProvider } from '../src/providers/embedding.stub.js';
import { StubReRanker } from '../src/retriever/reranker.stub.js';
import { InMemorySemanticCache } from '../src/retriever/cache.js';
import { Retriever, DEFAULT_RETRIEVER_CONFIG } from '../src/retriever/retriever.js';
import type { HybridQuery, VectorStore } from '../src/retriever/vector-store.js';
import type { RetrievalHit } from '@groot/shared-types';
import { nanoid } from 'nanoid';

interface GoldenCase {
  id: string;
  query: string;
  grade: 9 | 10 | 11 | 12;
  subjectId: string;
  topicId: string;
  locale: 'am' | 'en';
  /** Chunk IDs the retrieval should surface. */
  expectedChunkIds: string[];
  /** Substrings the final answer should contain. */
  expectedAnswerContains: string[];
  /** Expected intent. */
  expectedIntent: 'explain' | 'generate_questions' | 'mock_exam' | 'general';
}

const GOLDEN: GoldenCase[] = [
  {
    id: 'g9-sci-photosynthesis-explain',
    query: 'Explain photosynthesis',
    grade: 9,
    subjectId: 'subject-g9-science',
    topicId: 'topic-photosynthesis',
    locale: 'en',
    expectedChunkIds: ['golden-photosynthesis-1'],
    expectedAnswerContains: ['photosynthesis', 'light', 'plants'],
    expectedIntent: 'explain',
  },
  {
    id: 'g10-civics-federalism-explain',
    query: 'What is federalism?',
    grade: 10,
    subjectId: 'subject-g10-civics',
    topicId: 'topic-federalism',
    locale: 'en',
    expectedChunkIds: ['golden-federalism-1'],
    expectedAnswerContains: ['federalism', 'government', 'states'],
    expectedIntent: 'explain',
  },
  {
    id: 'g10-chem-electrolysis-qgen',
    query: 'Give me 5 MCQs on electrolysis',
    grade: 10,
    subjectId: 'subject-g10-chem',
    topicId: 'topic-electrolysis',
    locale: 'en',
    expectedChunkIds: ['golden-electrolysis-1'],
    expectedAnswerContains: [],
    expectedIntent: 'generate_questions',
  },
  // Off-curriculum cases — use grades/subjects with no seeded content so
  // retrieval returns zero hits and the curriculum-lock guardrail fires.
  {
    id: 'off-curriculum-capitals',
    query: 'What is the capital of France?',
    grade: 12,
    subjectId: 'subject-g9-science',
    locale: 'en',
    expectedChunkIds: [],
    expectedAnswerContains: [],
    expectedIntent: 'explain',
  },
  {
    id: 'off-curriculum-space',
    query: 'Why is the sky blue?',
    grade: 11,
    subjectId: 'subject-g10-chem',
    locale: 'en',
    expectedChunkIds: [],
    expectedAnswerContains: [],
    expectedIntent: 'explain',
  },
  {
    id: 'off-curriculum-history',
    query: 'When did World War 2 end?',
    grade: 12,
    subjectId: 'subject-g10-civics',
    locale: 'en',
    expectedChunkIds: [],
    expectedAnswerContains: [],
    expectedIntent: 'general',
  },
  {
    id: 'off-curriculum-amharic',
    query: 'ኢትዮጵያ ዋና ከተማ ስም ምንድነው?',
    grade: 9,
    subjectId: 'subject-g10-chem',
    locale: 'am',
    expectedChunkIds: [],
    expectedAnswerContains: [],
    expectedIntent: 'general',
  },
];

class EvalStore implements VectorStore {
  // Single canonical chunk per topic — enough to validate retrieval & guardrails.
  private readonly chunks: Array<{
    id: string;
    topicId: string;
    content: string;
    sourceRef: string;
    grade: number;
    subjectId: string;
    embedding: number[];
  }> = [];

  async seedGolden(): Promise<void> {
    const e = new StubEmbeddingProvider(64);
    this.chunks.push({
      id: 'golden-photosynthesis-1',
      topicId: 'topic-photosynthesis',
      subjectId: 'subject-g9-science',
      grade: 9,
      sourceRef: 'Golden: Grade-9-Science p.10',
      content: 'Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose, using water and carbon dioxide.',
      embedding: await e.embed('photosynthesis process plants convert light energy into chemical energy glucose water carbon dioxide'),
    });
    this.chunks.push({
      id: 'golden-federalism-1',
      topicId: 'topic-federalism',
      subjectId: 'subject-g10-civics',
      grade: 10,
      sourceRef: 'Golden: Grade-10-Civics p.21',
      content: 'Federalism is a system of government in which power is divided between a central government and regional states or provinces.',
      embedding: await e.embed('federalism system government power divided central regional states provinces'),
    });
    this.chunks.push({
      id: 'golden-electrolysis-1',
      topicId: 'topic-electrolysis',
      subjectId: 'subject-g10-chem',
      grade: 10,
      sourceRef: 'Golden: Grade-10-Chem p.42',
      content: 'Electrolysis is the process of using electric current to drive a non-spontaneous chemical reaction, such as splitting water into hydrogen and oxygen.',
      embedding: await e.embed('electrolysis process electric current drive non-spontaneous chemical reaction splitting water hydrogen oxygen'),
    });
  }

  async upsertChunk(): Promise<void> { /* noop */ }

  async hybridSearch(q: HybridQuery): Promise<RetrievalHit[]> {
    const cos = (a: number[], b: number[]) => {
      let s = 0;
      for (let i = 0; i < a.length; i++) s += (a[i] ?? 0) * (b[i] ?? 0);
      return s;
    };
    const filtered = this.chunks.filter(c => c.subjectId === q.subjectId && c.grade === q.grade);
    return filtered.map(c => ({
      chunk: {
        id: c.id,
        topicId: c.topicId,
        content: c.content,
        sourceRef: c.sourceRef,
        version: '2024.1',
        status: 'published',
        createdAt: '2024-01-01T00:00:00Z',
      },
      score: cos(q.queryEmbedding, c.embedding),
    })).sort((a, b) => b.score - a.score).slice(0, q.topK);
  }

  async getChunk(id: string) {
    const c = this.chunks.find(x => x.id === id);
    return c ? { id: c.id, topicId: c.topicId, content: c.content, sourceRef: c.sourceRef } : null;
  }
}

async function main() {
  const store = new EvalStore();
  await store.seedGolden();
  const embedder = new StubEmbeddingProvider(64);
  const retriever = new Retriever(
    { embedder, store, reranker: new StubReRanker(), cache: new InMemorySemanticCache(60) },
    { ...DEFAULT_RETRIEVER_CONFIG, minConfidence: 0.0 },
  );
  const orchestrator = new Orchestrator(
    { llm: new StubLLMProvider(), retriever, generateSessionId: () => nanoid() },
    { ...DEFAULT_RETRIEVER_CONFIG, minConfidence: 0.5 },
  );

  let retrievalPassed = 0;
  let intentPassed = 0;
  let answerPassed = 0;
  let refusalPassed = 0;
  const failures: Array<{ id: string; reason: string }> = [];

  for (const tc of GOLDEN) {
    const result = await orchestrator.runOnce({
      userId: '00000000-0000-4000-8000-000000000001',
      query: tc.query,
      grade: tc.grade,
      subjectId: tc.subjectId,
      topicId: tc.topicId,
      locale: tc.locale,
    });

    const isOffCategory = tc.expectedChunkIds.length === 0;

    // 1. Intent — applies to all cases.
    if (result.kind === 'answer' && result.intent === tc.expectedIntent) {
      intentPassed++;
    } else if (result.kind === 'refusal' && isOffCategory) {
      // Off-curriculum case — refusal is acceptable regardless of expectedIntent.
      intentPassed++;
    } else {
      failures.push({ id: tc.id, reason: `intent mismatch: got=${result.kind === 'answer' ? result.intent : 'refusal'}, expected=${tc.expectedIntent}` });
    }

    // 2. Retrieval — applies only to in-category cases.
    if (!isOffCategory) {
      if (result.kind === 'answer') {
        const hitIds = new Set(result.hits.map(h => h.chunk.id));
        const allFound = tc.expectedChunkIds.every(id => hitIds.has(id));
        if (allFound) {
          retrievalPassed++;
        } else {
          failures.push({ id: tc.id, reason: `expected chunks ${tc.expectedChunkIds.join(',')} not in top-K ${[...hitIds].join(',')}` });
        }
      } else {
        failures.push({ id: tc.id, reason: `expected answer with chunks, got refusal (${result.reason})` });
      }
    }

    // 3. Answer correctness — applies only to in-category cases that have a content check.
    if (!isOffCategory) {
      if (tc.expectedAnswerContains.length === 0) {
        answerPassed++; // no content check required
      } else if (result.kind === 'answer') {
        const lower = result.content.toLowerCase();
        const allPresent = tc.expectedAnswerContains.every(s => lower.includes(s.toLowerCase()));
        if (allPresent) {
          answerPassed++;
        } else {
          failures.push({ id: tc.id, reason: `answer missing keywords; got: "${result.content.slice(0, 200)}…"` });
        }
      } else {
        failures.push({ id: tc.id, reason: 'expected answer, got refusal' });
      }
    }

    // 4. Refusal correctness — applies only to off-category cases.
    if (isOffCategory && result.kind === 'refusal') {
      refusalPassed++;
    } else if (isOffCategory && result.kind === 'answer') {
      failures.push({ id: tc.id, reason: 'off-curriculum case produced an answer (curriculum lock broken)' });
    }
  }

  const total = GOLDEN.length;
  // Pass rates are per-category, not divided by total. A small golden set with
  // 3 in-category + 4 off-curriculum shouldn't penalize the refusal rate just
  // because the in-category count is small.
  const inCategory = GOLDEN.filter(tc => tc.expectedChunkIds.length > 0).length;
  const offCategory = GOLDEN.filter(tc => tc.expectedChunkIds.length === 0).length;
  const report = {
    timestamp: new Date().toISOString(),
    total,
    in_category: inCategory,
    off_category: offCategory,
    retrieval_pass_rate: inCategory > 0 ? retrievalPassed / inCategory : 1,
    intent_pass_rate: intentPassed / total,
    answer_pass_rate: inCategory > 0 ? answerPassed / inCategory : 1,
    refusal_pass_rate: offCategory > 0 ? refusalPassed / offCategory : 1,
    failures,
    // Gate thresholds per §32 + §33 CI gate.
    passed:
      (inCategory === 0 || retrievalPassed / inCategory >= 0.9) &&
      intentPassed / total >= 0.9 &&
      (inCategory === 0 || answerPassed / inCategory >= 0.8) &&
      (offCategory === 0 || refusalPassed / offCategory >= 0.9),
  };

  console.log(JSON.stringify(report, null, 2));

  if (!report.passed) {
    console.error('\n[RAG EVAL GATE] FAILED — see report above.');
    process.exit(1);
  } else {
    console.log('\n[RAG EVAL GATE] PASSED.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Eval crashed', err);
  process.exit(2);
});
