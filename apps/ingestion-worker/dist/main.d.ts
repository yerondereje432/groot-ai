/**
 * Ingestion worker entry point.
 *
 * Per spec §16: asynchronous worker pipeline.
 * Per spec §29: containerized.
 *
 * Responsibilities:
 *   - Boot Postgres pool.
 *   - Register BullMQ worker on the ingestion queue.
 *   - Handle graceful shutdown.
 */
export {};
//# sourceMappingURL=main.d.ts.map