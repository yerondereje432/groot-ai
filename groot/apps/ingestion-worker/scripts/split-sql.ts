import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function splitFile() {
  const filePath = path.resolve('scripts', 'seed-history.sql');
  const content = await readFile(filePath, 'utf8');
  
  // The file has setup at the top, then a bunch of INSERTs.
  // Each INSERT for chunks starts with "INSERT INTO curriculum_chunks"
  
  const setupEndIndex = content.indexOf('INSERT INTO curriculum_chunks');
  const setupPart = content.slice(0, setupEndIndex);
  const chunksPart = content.slice(setupEndIndex);
  
  const chunks = chunksPart.split(/INSERT INTO curriculum_chunks/g).filter(c => c.trim().length > 0);
  
  // Create 4 files
  const numFiles = 4;
  const chunkSize = Math.ceil(chunks.length / numFiles);
  
  for (let i = 0; i < numFiles; i++) {
    const fileChunks = chunks.slice(i * chunkSize, (i + 1) * chunkSize);
    if (fileChunks.length === 0) continue;
    
    let fileContent = '';
    
    // First file gets the setup
    if (i === 0) {
      fileContent += setupPart + '\n';
    } else {
      fileContent += 'BEGIN;\n\n';
    }
    
    fileContent += fileChunks.map(c => 'INSERT INTO curriculum_chunks' + c).join('');
    
    // Last file gets the commit if it was present, but let's just make sure all files end with COMMIT
    if (!fileContent.includes('COMMIT;')) {
       fileContent += '\nCOMMIT;\n';
    }
    
    const outPath = path.resolve('scripts', `seed-history-part${i + 1}.sql`);
    await writeFile(outPath, fileContent, 'utf8');
    console.log(`Wrote ${outPath} (${fileChunks.length} chunks)`);
  }
}

splitFile().catch(console.error);
