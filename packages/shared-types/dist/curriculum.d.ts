/**
 * Curriculum domain types — per spec §41 (curriculum_chunks, subjects, units, topics).
 *
 * The status field on chunks drives the QA gate (draft → review → published) per §16.
 * Versioning ensures re-ingestion doesn't break live queries (§14, §16).
 */
export type CurriculumChunkStatus = 'draft' | 'review' | 'published' | 'archived';
export interface Subject {
    id: string;
    name: string;
    /** Grade level this subject belongs to (Ethiopian MoE grades 9–12). */
    grade: 9 | 10 | 11 | 12;
    /** Language of the content (Amharic or English primary per spec). */
    language: 'am' | 'en';
}
export interface Unit {
    id: string;
    subjectId: string;
    title: string;
    orderIndex: number;
    curriculumVersion: string;
}
export interface Topic {
    id: string;
    unitId: string;
    title: string;
    orderIndex: number;
}
export interface CurriculumChunk {
    id: string;
    topicId: string;
    content: string;
    /** Source reference for citation: e.g. "Grade-9-Science-Textbook.pdf p.42 §3.2". */
    sourceRef: string;
    /** Curriculum version this chunk belongs to (semver-style, e.g. "2024.1"). */
    version: string;
    status: CurriculumChunkStatus;
    createdAt: string;
}
export interface CurriculumChunkWithEmbedding extends CurriculumChunk {
    /** pgvector halfvec/vector — represented here as a numeric array. */
    embedding: number[];
}
/** A retrieval result from the RAG retriever. */
export interface RetrievalHit {
    chunk: CurriculumChunk;
    /** Combined score (vector similarity + BM25 + re-ranker). Higher is better. */
    score: number;
    /** Optional breakdown for debugging and observability (§31). */
    scoreBreakdown?: {
        vector: number;
        bm25: number;
        rerank: number;
        metadataBoost: number;
    };
}
/** Result of a retriever query. */
export interface RetrievalResult {
    hits: RetrievalHit[];
    /** True if at least one hit exceeded RAG_MIN_CONFIDENCE. */
    hasConfidentAnswer: boolean;
    /** Best score across all hits (0..1). */
    topScore: number;
    /** Retrieval latency in ms — recorded for observability. */
    latencyMs: number;
}
//# sourceMappingURL=curriculum.d.ts.map