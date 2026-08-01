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
export {};
//# sourceMappingURL=main.d.ts.map