/**
 * BullMQ job queue wiring.
 *
 * Per spec §10: BullMQ on Redis for async workloads.
 * Per spec §16: "Asynchronous job queue" for ingestion.
 */
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
const QUEUE_NAME = 'groot-ingestion';
function makeRedis(url) {
    // IORedis is compatible with BullMQ's ConnectionOptions at runtime even
    // when there are two ioredis copies in node_modules.
    return new IORedis(url, { maxRetriesPerRequest: null });
}
export function createQueue(redisUrl) {
    return new Queue(QUEUE_NAME, { connection: makeRedis(redisUrl) });
}
export function createWorker(redisUrl, processor, concurrency = 2) {
    return new Worker(QUEUE_NAME, async (job) => processor(job.data), { connection: makeRedis(redisUrl), concurrency });
}
//# sourceMappingURL=queue.js.map