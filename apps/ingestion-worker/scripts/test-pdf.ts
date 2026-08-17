import { readFile } from 'fs/promises';
import pdfParse from 'pdf-parse';

async function testPdf() {
  const filePath = 'c:\\Users\\yeron.DERE1\\Downloads\\Groot AI\\groot\\Books\\G10-History-STB-2023-web.pdf';
  const content = await readFile(filePath);
  const result = await pdfParse(content);
  
  const extractedText = result.text;
  const pageCount = result.numpages;
  const density = extractedText.replace(/\s+/g, '').length / pageCount;
  
  console.log('Pages:', pageCount);
  console.log('Text density (chars/page):', density);
  console.log('Looks like scanned?', density < 40);
}

testPdf().catch(console.error);
