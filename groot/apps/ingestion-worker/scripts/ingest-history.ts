import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { IngestionPipeline } from '../src/pipeline.js';
import { loadConfig } from '../src/config.js';

process.env.DATABASE_URL = process.env.DATABASE_URL || "";
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
process.env.EMBEDDING_PROVIDER = "gemini";

async function main() {
  const cfg = loadConfig();
  const pool = new Pool({ connectionString: cfg.databaseUrl });

  const subjectId = '00000000-0000-4000-8000-000000000004';
  const unitId = '00000000-0000-4000-8000-000000000040';
  const topicId = '00000000-0000-4000-8000-000000000400';

  await pool.query(`
    INSERT INTO subjects (id, name, grade, language) VALUES
      ($1, 'History', 10, 'en')
    ON CONFLICT (name, grade, language) DO NOTHING;
  `, [subjectId]);

  await pool.query(`
    INSERT INTO units (id, subject_id, title, order_index, curriculum_version) VALUES
      ($1, $2, 'Introduction to History', 1, '2024.1')
    ON CONFLICT (subject_id, order_index) DO NOTHING;
  `, [unitId, subjectId]);

  await pool.query(`
    INSERT INTO topics (id, unit_id, title, order_index) VALUES
      ($1, $2, 'Grade 10 History textbook', 1)
    ON CONFLICT (unit_id, order_index) DO NOTHING;
  `, [topicId, unitId]);

  console.log('Setup Grade 10 History metadata.');

  const filePath = 'c:\\Users\\yeron.DERE1\\Downloads\\Groot AI\\groot\\Books\\G10-History-STB-2023-web.pdf';
  console.log('Reading PDF from', filePath);
  const content = await readFile(filePath);

  console.log('Starting ingestion pipeline...');
  const pipeline = new IngestionPipeline(pool, {
    embeddingDim: cfg.embeddingDim,
    embeddingProvider: cfg.embeddingProvider,
    geminiApiKey: cfg.geminiApiKey
  });

  const result = await pipeline.run({
    filename: 'G10-History-STB-2023-web.pdf',
    content,
    subjectId,
    unitId,
    topicId,
    grade: 10,
    language: 'en',
  });

  console.log(`Ingested ${result.chunkCount} chunks (version ${result.version}, ${result.totalTokens} tokens)`);

  const r = await pipeline.approve(result.version);
  console.log(`Approved version ${result.version}: ${r.publishedCount} chunks published.`);

  await pool.end();
}

main().catch(err => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
