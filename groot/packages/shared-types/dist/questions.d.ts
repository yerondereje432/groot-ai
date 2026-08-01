/**
 * Question types — per spec §41 (questions table).
 *
 * Generated questions are curriculum-locked: stem, options, and answer are grounded
 * in retrieved chunks. Per spec §32 the RAG eval gate validates that the answer is
 * derivable from the cited chunks.
 */
export type QuestionType = 'mcq' | 'short' | 'truefalse';
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type QuestionSource = 'generated' | 'authored' | 'exam_bank';
export type QuestionStatus = 'draft' | 'review' | 'published';
export interface MCQOption {
    id: string;
    text: string;
    isCorrect: boolean;
}
export interface Question {
    id: string;
    topicId: string;
    type: QuestionType;
    /** Localized: rendered in the student's locale. */
    stem: string;
    options?: MCQOption[];
    /** For 'short' and 'truefalse' — a model answer or canonical string. */
    answer?: string;
    difficulty: Difficulty;
    source: QuestionSource;
    language: 'am' | 'en';
    status: QuestionStatus;
    /** Chunk IDs this question was derived from (for citation/audit). */
    derivedFromChunkIds: string[];
}
export interface GenerateQuestionsRequest {
    topicId: string;
    count: number;
    types: QuestionType[];
    difficulty: Difficulty;
    language: 'am' | 'en';
}
export interface GenerateQuestionsResponse {
    questions: Question[];
}
//# sourceMappingURL=questions.d.ts.map