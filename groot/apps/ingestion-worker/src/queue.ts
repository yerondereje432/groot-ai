/**
 * BullMQ job queue wiring.
 *
 * Per spec §10: BullMQ on Redis for async workloads.
 * Per spec §16: "Asynchronous job queue" for ingestion.
 */

import { Queue, Worker, type Job, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import type { IngestionJobInput, IngestionJobResult } from './pipeline.js';

const QUEUE_NAME = 'groot:ingestion';

function makeRedis(url: string): ConnectionOptions {
  // IORedis is compatible with BullMQ's ConnectionOptions at runtime even
  // when there are two ioredis copies in node_modules.
  return new IORedis(url, { maxRetriesPerRequest: null }) as unknown as ConnectionOptions;
}

export function createQueue(redisUrl: string): Queue<IngestionJobInput> {
  return new Queue<IngestionJobInput>(QUEUE_NAME, { connection: makeRedis(redisUrl) });
}

export function createWorker(
  redisUrl: string,
  processor: (input: IngestionJobInput) => Promise<IngestionJobResult>,
  concurrency = 2,
): Worker<IngestionJobInput, IngestionJobResult> {
  return new Worker<IngestionJobInput, IngestionJobResult>(
    QUEUE_NAME,
    async (job: Job<IngestionJobInput>) => processor(job.data),
    { connection: makeRedis(redisUrl), concurrency },
  );
}
