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

import { Pool } from 'pg';
import { loadConfig } from './config.js';
import { IngestionPipeline } from './pipeline.js';
import { createWorker } from './queue.js';

async function main() {
  const cfg = loadConfig();
  const pool = new Pool({ connectionString: cfg.databaseUrl });
  const pipeline = new IngestionPipeline(pool, {
    embeddingDim: cfg.embeddingDim,
    embeddingProvider: cfg.embeddingProvider,
    geminiApiKey: cfg.geminiApiKey
  });

  const worker = createWorker(
    cfg.redisUrl,
    async (input) => pipeline.run(input),
    cfg.concurrency,
  );

  worker.on('completed', (job, result) => {
    console.log(JSON.stringify({
      msg: 'ingestion.completed',
      jobId: job.id,
      version: result.version,
      chunkCount: result.chunkCount,
    }));
  });

  worker.on('failed', (job, err) => {
    console.error(JSON.stringify({
      msg: 'ingestion.failed',
      jobId: job?.id,
      error: err.message,
    }));
  });

  console.log(JSON.stringify({ msg: 'ingestion-worker.started', queue: 'groot:ingestion', concurrency: cfg.concurrency }));

  const shutdown = async () => {
    console.log(JSON.stringify({ msg: 'ingestion-worker.shutdown' }));
    await worker.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(err => {
  console.error('Ingestion worker failed to start', err);
  process.exit(1);
});
