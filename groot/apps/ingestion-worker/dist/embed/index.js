/**
 * Embedder — wraps the embedding provider for batch ingestion.
 *
 * Per spec §16 step 5: "Embedding — batch embed, store in vector DB."
 * Per spec §37: "Embeddings — batch and cache; re-embed only changed chunks."
 *
 * The ingestion worker uses its own local stub embedder for the vertical.
 * A production deployment should call the AI service's /v1/embed endpoint
 * (or a shared library) to keep the embedding model in lock-step.
 */
import { StubEmbeddingProvider } from '../util/stub-embedder.js';
import { GeminiEmbeddingProvider } from './gemini.js';
export function localEmbeddingProvider(dimension = 384, provider = 'stub', apiKey) {
    if (provider === 'gemini' && apiKey) {
        return new GeminiEmbeddingProvider(apiKey, 'text-embedding-004', dimension);
    }
    return new StubEmbeddingProvider(dimension);
}
//# sourceMappingURL=index.js.map