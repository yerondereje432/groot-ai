/**
 * BullMQ job queue wiring.
 *
 * Per spec §10: BullMQ on Redis for async workloads.
 * Per spec §16: "Asynchronous job queue" for ingestion.
 */
import { Queue, Worker } from 'bullmq';
import type { IngestionJobInput, IngestionJobResult } from './pipeline.js';
export declare function createQueue(redisUrl: string): Queue<IngestionJobInput>;
export declare function createWorker(redisUrl: string, processor: (input: IngestionJobInput) => Promise<IngestionJobResult>, concurrency?: number): Worker<IngestionJobInput, IngestionJobResult>;
//# sourceMappingURL=queue.d.ts.map