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
import type { ParsedDocument } from '../parse/index.js';
export interface ChunkOptions {
    minTokens: number;
    maxTokens: number;
    /** Overlap between chunks to preserve context. */
    overlapTokens: number;
}
export declare const DEFAULT_CHUNK_OPTIONS: ChunkOptions;
export interface RawChunk {
    /** Heading or sub-heading — propagated to metadata. */
    heading: string | null;
    body: string;
    /** Source page or section for citation. */
    page?: number;
    /** Approximate token count. */
    tokenCount: number;
}
export declare function chunkDocument(doc: ParsedDocument, opts?: ChunkOptions): RawChunk[];
/**
 * Sentence splitter that handles Latin and Ge'ez (Amharic) full stops.
 * Ge'ez uses "።" (U+1362) as the period.
 */
export declare function splitSentences(text: string): string[];
export declare function countTokens(text: string): number;
//# sourceMappingURL=index.d.ts.map