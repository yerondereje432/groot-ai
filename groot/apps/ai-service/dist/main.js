/**
 * AI service HTTP entry point.
 *
 * Endpoints:
 *   GET  /health
 *   POST /v1/tutor/stream    (SSE — per spec §8, §42)
 *   POST /v1/tutor           (non-streaming)
 *   POST /v1/retrieve        (debug / eval)
 *   POST /v1/embed           (debug)
 *
 * Per spec §26: REST + JSON, SSE for streaming, error envelope.
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Pool } from 'pg';
import { nanoid } from 'nanoid';
import { loadConfig } from './config.js';
import { StubLLMProvider } from './providers/llm.stub.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { StubEmbeddingProvider } from './providers/embedding.stub.js';
import { PgVectorStore } from './retriever/pgvector-store.js';
import { StubReRanker } from './retriever/reranker.stub.js';
import { GeminiReRanker } from './retriever/reranker.gemini.js';
import { InMemorySemanticCache } from './retriever/cache.js';
import { Retriever, DEFAULT_RETRIEVER_CONFIG } from './retriever/retriever.js';
import { Orchestrator } from './orchestrator/orchestrator.js';
async function bootstrap() {
    const cfg = loadConfig();
    const app = Fastify({
        logger: {
            level: cfg.logLevel,
            transport: cfg.nodeEnv === 'development'
                ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
                : undefined,
        },
    });
    await app.register(cors, { origin: true });
    // ----- Infrastructure wiring -----
    const pool = new Pool({ connectionString: cfg.databaseUrl, max: 10 });
    // LLM provider — swap implementations here as credentials become available.
    let llm;
    switch (cfg.llmProvider) {
        case 'gemini':
            if (!cfg.geminiApiKey) {
                app.log.error('GEMINI_API_KEY is missing but Gemini provider was requested. Falling back to stub.');
                llm = new StubLLMProvider();
            }
            else {
                llm = new GeminiProvider({
                    apiKey: cfg.geminiApiKey,
                    generationModel: cfg.llmModel
                });
            }
            break;
        case 'stub':
            llm = new StubLLMProvider();
            break;
        case 'openai':
        case 'anthropic':
            // Real provider implementations deferred. Keep stub behavior to ensure
            // the system is runnable in dev.
            app.log.warn({ cfg: { llmProvider: cfg.llmProvider } }, 'Real LLM provider not wired yet; using stub. See apps/ai-service/src/providers/llm.factory.ts.');
            llm = new StubLLMProvider();
            break;
        default:
            llm = new StubLLMProvider();
    }
    // Embedding provider — same pattern.
    let embedder;
    if (cfg.embeddingProvider === 'gemini' && cfg.geminiApiKey) {
        embedder = new GeminiProvider({
            apiKey: cfg.geminiApiKey,
            embeddingModel: cfg.embeddingModel,
            dimension: cfg.embeddingDim
        });
    }
    else {
        embedder = new StubEmbeddingProvider(cfg.embeddingDim);
    }
    // Vector store — pgvector per §15.
    const store = new PgVectorStore(pool);
    // Re-ranker — LLM-based (Gemini) when configured, lexical stub otherwise. Per §14.
    let reranker;
    if (cfg.rerankerProvider === 'gemini') {
        if (!cfg.geminiApiKey) {
            app.log.error('GEMINI_API_KEY is missing but Gemini re-ranker was requested. Falling back to stub.');
            reranker = new StubReRanker();
        }
        else {
            reranker = new GeminiReRanker({ apiKey: cfg.geminiApiKey, model: cfg.llmModel });
        }
    }
    else {
        reranker = new StubReRanker();
    }
    // Cache — Redis preferred, in-memory fallback for dev.
    const cache = cfg.redisUrl
        ? new InMemorySemanticCache(cfg.ragCacheTtlSeconds) // swap to RedisSemanticCache when ioredis is initialized below
        : new InMemorySemanticCache(cfg.ragCacheTtlSeconds);
    const retriever = new Retriever({ embedder, store, reranker, cache }, {
        ...DEFAULT_RETRIEVER_CONFIG,
        topKPreRerank: cfg.ragTopKPreRerank,
        topKPostRerank: cfg.ragTopKPostRerank,
        minConfidence: cfg.ragMinConfidence,
    });
    const orchestrator = new Orchestrator({
        llm,
        retriever,
        generateSessionId: () => nanoid(),
    }, {
        ...DEFAULT_RETRIEVER_CONFIG,
        minConfidence: cfg.ragMinConfidence,
    });
    // ----- Health -----
    app.get('/health', async () => ({
        status: 'ok',
        service: 'ai-service',
        llm: cfg.llmProvider,
        embedder: cfg.embeddingProvider,
        version: '0.1.0',
    }));
    // ----- Tutor stream (SSE) -----
    app.post('/v1/tutor/stream', async (req, reply) => {
        const parsed = TutorQuerySchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({
                error: { code: 'VALIDATION_ERROR', message: 'Invalid tutor query', details: parsed.error.issues },
            });
        }
        const q = parsed.data;
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.setHeader('X-Accel-Buffering', 'no');
        reply.raw.flushHeaders();
        try {
            for await (const ev of orchestrator.run(q)) {
                reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);
            }
            reply.raw.write('data: [DONE]\n\n');
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'unknown';
            reply.raw.write(`data: ${JSON.stringify({ type: 'error', code: 'STREAM_ERROR', message: msg })}\n\n`);
        }
        finally {
            reply.raw.end();
        }
    });
    // ----- Tutor non-streaming -----
    app.post('/v1/tutor', async (req, reply) => {
        const parsed = TutorQuerySchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({
                error: { code: 'VALIDATION_ERROR', message: 'Invalid tutor query', details: parsed.error.issues },
            });
        }
        const result = await orchestrator.runOnce(parsed.data);
        return result;
    });
    // ----- Retrieve (debug/eval) -----
    app.post('/v1/retrieve', async (req, reply) => {
        const parsed = TutorQuerySchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({
                error: { code: 'VALIDATION_ERROR', message: 'Invalid query', details: parsed.error.issues },
            });
        }
        const r = await retriever.retrieve({
            query: parsed.data.query,
            grade: parsed.data.grade,
            subjectId: parsed.data.subjectId,
            topicId: parsed.data.topicId,
        });
        return r;
    });
    // ----- Embed (debug) -----
    app.post('/v1/embed', async (req, reply) => {
        const body = req.body;
        if (!body.text) {
            return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'text required' } });
        }
        const vec = await embedder.embed(body.text);
        return { dim: vec.length, vector: vec };
    });
    // ----- Start -----
    await app.listen({ port: cfg.port, host: '0.0.0.0' });
    app.log.info({ port: cfg.port, llm: cfg.llmProvider }, 'GROOT AI service started');
}
// Inline schema — avoids a runtime dep on zod in shared-types.
// We could also re-export from shared-types but kept inline for now.
import { z } from 'zod';
const TutorQuerySchema = z.object({
    userId: z.string().uuid(),
    grade: z.union([z.literal(9), z.literal(10), z.literal(11), z.literal(12)]),
    subjectId: z.string().uuid(),
    topicId: z.string().uuid().optional(),
    query: z.string().min(1).max(2000),
    locale: z.enum(['am', 'en']),
});
bootstrap().catch(err => {
    console.error('AI service failed to start', err);
    process.exit(1);
});
//# sourceMappingURL=main.js.map