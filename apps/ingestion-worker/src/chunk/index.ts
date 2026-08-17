/**
 * Semantic chunker.
 *
 * Per spec §16 step 4: "semantic chunking with topic tags and source page references.
 * ~300–500 tokens per chunk."
 *
 * Implementation:
 *   1. Split on section boundaries from the parser.
 *   2. Tokenize (rough word-based, since we don't have a Ge'ez tokenizer yet).
 *   3. Pack sentences into chunks respecting the soft min/max token budget.
 *   4. Carry forward the section heading as a tag.
 *
 * Amharic script must survive intact. The chunker is unicode-safe.
 */

import type { ParsedDocument, ParsedSection } from '../parse/index.js';

export interface ChunkOptions {
  minTokens: number;     // default 250
  maxTokens: number;     // default 500
  /** Overlap between chunks to preserve context. */
  overlapTokens: number; // default 50
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  minTokens: 250,
  maxTokens: 500,
  overlapTokens: 50,
};

export interface RawChunk {
  /** Heading or sub-heading — propagated to metadata. */
  heading: string | null;
  body: string;
  /** Source page or section for citation. */
  page?: number;
  /** Approximate token count. */
  tokenCount: number;
}

export function chunkDocument(doc: ParsedDocument, opts: ChunkOptions = DEFAULT_CHUNK_OPTIONS): RawChunk[] {
  const chunks: RawChunk[] = [];
  for (const sec of doc.sections) {
    const sectionChunks = chunkSection(sec, opts);
    chunks.push(...sectionChunks);
  }
  return chunks;
}

function chunkSection(sec: ParsedSection, opts: ChunkOptions): RawChunk[] {
  const text = sec.body.trim();
  if (!text) return [];

  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];

  const out: RawChunk[] = [];
  let buffer: string[] = [];
  let bufferTokens = 0;

  for (const sent of sentences) {
    const tokens = countTokens(sent);

    // If a single sentence exceeds maxTokens, hard-split it.
    if (tokens > opts.maxTokens) {
      if (buffer.length > 0) {
        out.push(makeChunk(sec, buffer, bufferTokens));
        buffer = [];
        bufferTokens = 0;
      }
      const parts = hardSplit(sent, opts.maxTokens);
      for (const part of parts) {
        out.push(makeChunk(sec, [part], countTokens(part)));
      }
      continue;
    }

    if (bufferTokens + tokens > opts.maxTokens && bufferTokens >= opts.minTokens) {
      out.push(makeChunk(sec, buffer, bufferTokens));
      // Carry overlap from the tail of the buffer.
      const overlap = takeOverlap(buffer, bufferTokens, opts.overlapTokens);
      buffer = [...overlap];
      bufferTokens = overlap.reduce((s, x) => s + countTokens(x), 0);
    }

    buffer.push(sent);
    bufferTokens += tokens;
  }

  if (buffer.length > 0) {
    out.push(makeChunk(sec, buffer, bufferTokens));
  }

  return out;
}

function makeChunk(sec: ParsedSection, sentences: string[], tokens: number): RawChunk {
  return {
    heading: sec.heading,
    body: sentences.join(' ').replace(/\s+/g, ' ').trim(),
    page: sec.page,
    tokenCount: tokens,
  };
}

/**
 * Sentence splitter that handles Latin and Ge'ez (Amharic) full stops.
 * Ge'ez uses "።" (U+1362) as the period.
 */
export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  // Split on [.!?።] followed by whitespace and capital/Ge'ez character.
  const parts = normalized.split(/(?<=[.!?።])\s+(?=[A-Zሀ-ፓ])/);
  return parts.map(p => p.trim()).filter(Boolean);
}

export function countTokens(text: string): number {
  // Conservative approximation: ~1 token per 0.75 word for Latin, ~1 token per
  // Ge'ez syllable. For chunk budgeting this is good enough.
  const words = text.split(/\s+/).filter(Boolean);
  if (hasGeez(text)) {
    // Ge'ez: count syllables (vowel+consonant clusters) by approximating per word.
    return Math.ceil(words.length * 1.3);
  }
  return Math.ceil(words.length / 0.75);
}

function hasGeez(text: string): boolean {
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x1200 && c <= 0x137f) return true;
  }
  return false;
}

function hardSplit(sentence: string, maxTokens: number): string[] {
  const words = sentence.split(/\s+/);
  const approxTokensPerWord = hasGeez(sentence) ? 1.3 : 0.75;
  const wordsPerChunk = Math.floor(maxTokens / approxTokensPerWord);
  const out: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    out.push(words.slice(i, i + wordsPerChunk).join(' '));
  }
  return out;
}

function takeOverlap(sentences: string[], totalTokens: number, overlapTokens: number): string[] {
  if (totalTokens <= overlapTokens) return [...sentences];
  const out: string[] = [];
  let acc = 0;
  for (let i = sentences.length - 1; i >= 0; i--) {
    const s = sentences[i] ?? '';
    const t = countTokens(s);
    if (acc + t > overlapTokens) break;
    out.unshift(s);
    acc += t;
  }
  return out;
}
