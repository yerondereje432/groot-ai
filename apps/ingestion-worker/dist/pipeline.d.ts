/**
 * Ingestion pipeline orchestrator.
 *
 * Per spec §16:
 *   1. Upload — admin uploads via CMS.
 *   2. Extraction — text + structure.
 *   3. Structuring — map to curriculum hierarchy.
 *   4. Chunking — semantic chunks, ~300–500 tokens, topic-tagged.
 *   5. Embedding — batch embed, store.
 *   6. QA gate — human reviewer approves (draft → review → published).
 *   7. Versioning — each ingestion creates a version.
 *
 * This file wires those steps into a single function that the worker
 * runs per job.
 */
import type { Pool } from 'pg';
export interface IngestionJobInput {
    /** Filename in storage (PDF, MD, TXT). */
    filename: string;
    /** Raw file content. */
    content: Buffer | string;
    /** Curriculum hierarchy assignment (admin maps during upload). */
    subjectId: string;
    unitId: string;
    topicId: string;
    /** Grade and language for metadata. */
    grade: 9 | 10 | 11 | 12;
    language: 'am' | 'en';
}
export interface IngestionJobResult {
    jobId: string;
    version: string;
    chunkCount: number;
    totalTokens: number;
    status: 'draft';
}
export interface IngestionJobRecord extends IngestionJobResult {
    filename: string;
    subjectId: string;
    unitId: string;
    topicId: string;
    createdAt: string;
}
export interface QAApproval {
    jobId: string;
    reviewerId: string;
    approvedAt: string;
    notes?: string;
}
export interface PipelineOptions {
    embeddingDim: number;
    embeddingProvider: 'stub' | 'gemini';
    geminiApiKey?: string;
}
export declare class IngestionPipeline {
    private readonly pool;
    private readonly options;
    constructor(pool: Pool, options?: PipelineOptions);
    run(input: IngestionJobInput): Promise<IngestionJobResult>;
    /**
     * Promote chunks from 'draft' to 'published' after QA approval.
     * Per spec §16 step 6.
     */
    approve(version: string): Promise<{
        publishedCount: number;
    }>;
    private withHeading;
    private makeSourceRef;
}
//# sourceMappingURL=pipeline.d.ts.map