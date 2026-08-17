/**
 * LLM provider abstraction.
 *
 * Per spec §13: "LLM provider — abstracted behind an interface so providers are swappable."
 *
 * Every implementation must:
 *   1. Honor the system prompt's curriculum-lock instruction (§13).
 *   2. Refuse to generate content not derivable from the provided context.
 *   3. Support token streaming for SSE (§8, §42).
 *   4. Behave deterministically enough for the RAG eval gate (§32).
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMStructuredPrompt {
  system: string;
  /** Retrieved curriculum chunks with citations. */
  context: LLMContextBlock[];
  /** The student's question. */
  userQuery: string;
  /** Locale for response. */
  locale: 'am' | 'en';
  /** Detected intent — affects response style (§13). */
  intent: 'explain' | 'generate_questions' | 'mock_exam' | 'general';
}

export interface LLMContextBlock {
  chunkId: string;
  sourceRef: string;
  content: string;
}

export interface LLMCompletionRequest {
  prompt: LLMStructuredPrompt;
  /** Stop sequences. Defaults to ["\n\n"] to keep answers exam-length (§2). */
  stopSequences?: string[];
  /** Hard cap on output tokens to bound cost. Per spec §37. */
  maxOutputTokens?: number;
}

export interface LLMTokenChunk {
  /** Incremental token; clients append to assemble the final answer. */
  delta: string;
  /** True on the final chunk. */
  done: boolean;
}

export interface LLMCompletionResult {
  content: string;
  /** Tokens used — recorded for cost observability (§31, §37). */
  usage: { input: number; output: number };
  /** Provider-reported refusal flag, when available. */
  refused?: boolean;
}

export interface LLMProvider {
  readonly name: string;
  /** Stream tokens. Used by the SSE tutor endpoint. */
  stream(req: LLMCompletionRequest): AsyncIterable<LLMTokenChunk>;
  /** One-shot completion. Used by question generation, evals. */
  complete(req: LLMCompletionRequest): Promise<LLMCompletionResult>;
}
