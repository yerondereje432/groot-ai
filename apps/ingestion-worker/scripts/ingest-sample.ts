/**
 * Sample ingestion runner.
 *
 * 1. Applies seed.sql to provision the Subject/Unit/Topic hierarchy.
 * 2. Walks sample-curriculum/*.md and runs each through the ingestion pipeline.
 * 3. Approves the resulting chunks (draft → published) for testing.
 *
 * In production, the QA approval step is a separate human review (§16 step 6).
 * Here we auto-approve so the retriever has data to operate on.
 */

import { Pool } from 'pg';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { IngestionPipeline } from '../src/pipeline.js';

const SAMPLE_DIR = join(import.meta.dirname, '..', 'sample-curriculum');
const SEED_PATH = join(SAMPLE_DIR, 'seed.sql');

const JOBS = [
  {
    file: 'g9-science-photosynthesis.md',
    subjectId: '00000000-0000-4000-8000-000000000001',
    unitId: '00000000-0000-4000-8000-000000000010',
    topicId: '00000000-0000-4000-8000-000000000100',
    grade: 9 as const,
    language: 'en' as const,
  },
  {
    file: 'g10-civics-federalism.md',
    subjectId: '00000000-0000-4000-8000-000000000002',
    unitId: '00000000-0000-4000-8000-000000000020',
    topicId: '00000000-0000-4000-8000-000000000200',
    grade: 10 as const,
    language: 'en' as const,
  },
  {
    file: 'g10-chemistry-electrolysis.md',
    subjectId: '00000000-0000-4000-8000-000000000003',
    unitId: '00000000-0000-4000-8000-000000000030',
    topicId: '00000000-0000-4000-8000-000000000300',
    grade: 10 as const,
    language: 'en' as const,
  },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL
    ?? 'postgresql://groot:groot_dev_password@localhost:5432/groot';

  const pool = new Pool({ connectionString: databaseUrl });

  // 1. Apply seed.
  const seed = await readFile(SEED_PATH, 'utf8');
  await pool.query(seed);
  console.log('seed.sql applied.');

  // 2. Ingest each file.
  const pipeline = new IngestionPipeline(pool, 384);
  const versions: string[] = [];
  for (const job of JOBS) {
    const filePath = join(SAMPLE_DIR, job.file);
    const content = await readFile(filePath, 'utf8');
    console.log(`Ingesting ${job.file}...`);
    const result = await pipeline.run({
      filename: job.file,
      content,
      subjectId: job.subjectId,
      unitId: job.unitId,
      topicId: job.topicId,
      grade: job.grade,
      language: job.language,
    });
    console.log(`  → ${result.chunkCount} chunks (version ${result.version}, ${result.totalTokens} tokens)`);
    versions.push(result.version);
  }

  // 3. Approve all (in production this is a human review).
  for (const v of versions) {
    const r = await pipeline.approve(v);
    console.log(`Approved version ${v}: ${r.publishedCount} chunks published.`);
  }

  // 4. Sanity check.
  const total = await pool.query<{ count: string }>(
    `SELECT count(*)::text FROM curriculum_chunks WHERE status = 'published'`
  );
  console.log(`Total published chunks: ${total.rows[0]?.count ?? 0}`);

  await pool.end();
}

main().catch(err => {
  console.error('Sample ingestion failed:', err);
  process.exit(1);
});
