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

import { parseDocument, type ParsedDocument } from './parse/index.js';
import { chunkDocument, DEFAULT_CHUNK_OPTIONS, type RawChunk } from './chunk/index.js';
import { localEmbeddingProvider } from './embed/index.js';
import type { Pool } from 'pg';
import { newVersion } from './version/index.js';

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

export class IngestionPipeline {
  constructor(
    private readonly pool: Pool, 
    private readonly options: PipelineOptions = { embeddingDim: 384, embeddingProvider: 'stub' }
  ) {}

  async run(input: IngestionJobInput): Promise<IngestionJobResult> {
    const start = Date.now();

    // 1+2. Parse. Scanned PDFs fall back to Gemini OCR when a key is configured (see parse/gemini-ocr.ts).
    const parsed: ParsedDocument = await parseDocument(input.filename, input.content, {
      geminiApiKey: this.options.geminiApiKey,
    });

    // 3. Validate that the assigned subject/grade/language is consistent.
    // (Detailed validation deferred to CMS layer; pipeline asserts obvious mismatches.)
    if (parsed.language !== input.language) {
      throw new Error(
        `Language mismatch: file=${input.filename} detected=${parsed.language} ` +
          `expected=${input.language}. Rejecting to prevent curriculum contamination.`
      );
    }

    // 4. Chunk.
    const rawChunks: RawChunk[] = chunkDocument(parsed, DEFAULT_CHUNK_OPTIONS);

    // 5. Embed (batch).
    const embedder = localEmbeddingProvider(
      this.options.embeddingDim, 
      this.options.embeddingProvider, 
      this.options.geminiApiKey
    );
    const embeddings = await embedder.embedBatch(rawChunks.map(c => this.withHeading(c)));

    // 6. Create version + persist chunks in 'draft' status (§16 QA gate).
    const version = newVersion(new Date().getFullYear(), 1, `${parsed.title} (auto)`);

    const jobId = crypto.randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < rawChunks.length; i++) {
        const chunk = rawChunks[i]!;
        const emb = embeddings[i]!;
        const literal = `[${emb.join(',')}]`;
        await client.query(
          `INSERT INTO curriculum_chunks
             (id, topic_id, content, source_ref, version, status, embedding, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'draft', $6::vector, now(), now())`,
          [
            crypto.randomUUID(),
            input.topicId,
            chunk.body,
            this.makeSourceRef(parsed, chunk),
            version.id,
            literal,
          ]
        );
      }
      // Record the ingestion job for auditability (§27 audit logs).
      await client.query(
        `INSERT INTO audit_logs (id, actor_id, action, target, metadata, created_at)
         VALUES ($1, NULL, 'ingestion.run', $2, $3::jsonb, now())`,
        [
          crypto.randomUUID(),
          jobId,
          JSON.stringify({
            filename: input.filename,
            subjectId: input.subjectId,
            unitId: input.unitId,
            topicId: input.topicId,
            grade: input.grade,
            language: input.language,
            version: version.id,
            chunkCount: rawChunks.length,
            durationMs: Date.now() - start,
          }),
        ]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return {
      jobId,
      version: version.id,
      chunkCount: rawChunks.length,
      totalTokens: rawChunks.reduce((s, c) => s + c.tokenCount, 0),
      status: 'draft',
    };
  }

  /**
   * Promote chunks from 'draft' to 'published' after QA approval.
   * Per spec §16 step 6.
   */
  async approve(version: string): Promise<{ publishedCount: number }> {
    const res = await this.pool.query(
      `UPDATE curriculum_chunks
       SET status = 'published', updated_at = now()
       WHERE version = $1 AND status = 'draft'
       RETURNING id`,
      [version]
    );
    await this.pool.query(
      `INSERT INTO audit_logs (id, actor_id, action, target, metadata, created_at)
       VALUES ($1, NULL, 'ingestion.approve', $2, $3::jsonb, now())`,
      [
        crypto.randomUUID(),
        version,
        JSON.stringify({ publishedCount: res.rowCount }),
      ]
    );
    return { publishedCount: res.rowCount ?? 0 };
  }

  private withHeading(c: RawChunk): string {
    if (!c.heading) return c.body;
    return `${c.heading}\n\n${c.body}`;
  }

  private makeSourceRef(parsed: ParsedDocument, c: RawChunk): string {
    if (c.page != null) return `${parsed.sourceRef} p.${c.page}`;
    if (c.heading) return `${parsed.sourceRef} §${c.heading}`;
    return parsed.sourceRef;
  }
}
