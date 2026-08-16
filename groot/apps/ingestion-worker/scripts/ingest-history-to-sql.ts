import { readFile, writeFile } from 'node:fs/promises';
import { parseDocument } from '../src/parse/index.js';
import { chunkDocument, DEFAULT_CHUNK_OPTIONS } from '../src/chunk/index.js';
import { localEmbeddingProvider } from '../src/embed/index.js';
import { newVersion } from '../src/version/index.js';
import crypto from 'node:crypto';
import path from 'node:path';

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

async function main() {
  console.log('Setup Grade 10 History metadata.');

  const subjectId = '00000000-0000-4000-8000-000000000004';
  const unitId = '00000000-0000-4000-8000-000000000040';
  const topicId = '00000000-0000-4000-8000-000000000400';

  let sql = 'BEGIN;\n\n';

  sql += `
INSERT INTO subjects (id, name, grade, language) VALUES
  ('${subjectId}', 'History', 10, 'en')
ON CONFLICT (name, grade, language) DO NOTHING;

INSERT INTO units (id, subject_id, title, order_index, curriculum_version) VALUES
  ('${unitId}', '${subjectId}', 'Introduction to History', 1, '2024.1')
ON CONFLICT (subject_id, order_index) DO NOTHING;

INSERT INTO topics (id, unit_id, title, order_index) VALUES
  ('${topicId}', '${unitId}', 'Grade 10 History textbook', 1)
ON CONFLICT (unit_id, order_index) DO NOTHING;
\n`;

  const filename = 'G10-History-STB-2023-web.pdf';
  const filePath = path.resolve('..', '..', 'Books', filename);
  
  console.log('Reading PDF from', filePath);
  const content = await readFile(filePath);

  console.log('Parsing PDF...');
  const parsed = await parseDocument(filename, content, {
    geminiApiKey: process.env.GEMINI_API_KEY,
  });

  console.log('Chunking document...');
  const rawChunks = chunkDocument(parsed, DEFAULT_CHUNK_OPTIONS);
  
  console.log(`Generated ${rawChunks.length} chunks. Getting embeddings via Gemini...`);

  // Batch embed chunks (maximum 100 per request, maybe?) 
  // Let's do it in batches of 100 to avoid Gemini rate limits or payload limits
  const embedder = localEmbeddingProvider(768, 'gemini', process.env.GEMINI_API_KEY);
  const embeddings: number[][] = [];
  
  for (let i = 0; i < rawChunks.length; i++) {
    if (i % 10 === 0) console.log(`Embedding chunk ${i} of ${rawChunks.length}...`);
    const c = rawChunks[i]!;
    const text = c.heading ? `${c.heading}\n\n${c.body}` : c.body;
    try {
      const emb = await embedder.embed(text);
      embeddings.push(emb);
    } catch (e) {
      console.error(`Failed to embed chunk ${i}:`, e);
      throw e;
    }
    // small sleep to avoid rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  const version = newVersion(new Date().getFullYear(), 1, `${parsed.title} (auto)`);
  
  for (let i = 0; i < rawChunks.length; i++) {
    const chunk = rawChunks[i]!;
    const emb = embeddings[i]!;
    
    // Construct source ref
    let sourceRef = parsed.sourceRef;
    if (chunk.page != null) sourceRef += ` p.${chunk.page}`;
    else if (chunk.heading) sourceRef += ` §${chunk.heading}`;
    
    const literal = `[${emb.join(',')}]`;
    
    // Escape single quotes for SQL string
    const safeContent = chunk.body.replace(/'/g, "''");
    const safeSourceRef = sourceRef.replace(/'/g, "''");

    sql += `INSERT INTO curriculum_chunks (id, topic_id, content, source_ref, version, status, embedding, created_at, updated_at) 
VALUES ('${crypto.randomUUID()}', '${topicId}', '${safeContent}', '${safeSourceRef}', '${version.id}', 'published', '${literal}'::vector, now(), now());\n`;
  }

  sql += '\nCOMMIT;\n';

  const outPath = path.resolve('scripts', 'seed-history.sql');
  await writeFile(outPath, sql, 'utf8');
  
  console.log(`Successfully generated seed-history.sql at ${outPath} with ${rawChunks.length} chunks!`);
}

main().catch(err => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
