/**
 * Tutor / AI chat types — per spec §13 (AI Architecture) and §42 (Tutor endpoint).
 *
 * Critical: tutor answers are curriculum-locked. The orchestrator returns a refusal
 * if retrieval confidence is below threshold (RAG_MIN_CONFIDENCE).
 */

export type TutorIntent =
  | 'explain'         // "Explain X in simple terms"
  | 'generate_questions' // "Give me 10 MCQs on X"
  | 'mock_exam'       // "Give me a mock exam"
  | 'general';        // Catch-all — still curriculum-locked

export interface TutorQuery {
  userId: string;
  /** Student's grade — used as metadata filter for retrieval (§14). */
  grade: 9 | 10 | 11 | 12;
  /** Subject slug or id — metadata filter. */
  subjectId: string;
  /** Optional topic narrowing. */
  topicId?: string;
  /** Free-text question in Amharic or English. */
  query: string;
  /** Preferred response language (§7, §34). */
  locale: 'am' | 'en';
}

export interface TutorSourceCitation {
  chunkId: string;
  topicId: string;
  sourceRef: string;
}

export type TutorRefusalReason =
  | 'low_retrieval_confidence'  // §13 guardrail: outside curriculum
  | 'unsafe_request'            // §27 safety
  | 'rate_limited';             // §22 free-tier metering

export type TutorResponse =
  | {
      kind: 'answer';
      content: string;
      citations: TutorSourceCitation[];
      intent: TutorIntent;
      confidence: number;
      /** Streaming chunk event for SSE. */
      stream?: never;
    }
  | {
      kind: 'refusal';
      reason: TutorRefusalReason;
      /** Localized message for the student. */
      message: string;
    };

/** SSE event payload shape emitted by the tutor endpoint. */
export type TutorStreamEvent =
  | { type: 'start'; sessionId: string; intent: TutorIntent }
  | { type: 'citation'; citation: TutorSourceCitation }
  | { type: 'token'; delta: string }
  | { type: 'done'; citations: TutorSourceCitation[]; confidence: number }
  | { type: 'refusal'; reason: TutorRefusalReason; message: string }
  | { type: 'error'; code: string; message: string };
