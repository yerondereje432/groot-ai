/**
 * Stub LLM provider.
 *
 * Generates curriculum-locked answers using ONLY the provided context blocks.
 * No pretrained knowledge is used — proving that the curriculum-lock works
 * end-to-end without external API keys.
 *
 * Behavior:
 *   - For "explain": produces a concise, exam-length summary by extracting
 *     relevant sentences from the top context blocks and stitching them.
 *   - For "generate_questions": emits templated MCQs derived from context.
 *   - For "mock_exam": returns a "not yet implemented" refusal (out of vertical).
 *   - If context is empty: emits a curriculum-out-of-scope refusal.
 *
 * Real implementations (OpenAI, Anthropic) must NOT bypass the orchestrator's
 * guardrails — the system prompt is the load-bearing instruction.
 */
import type { LLMProvider, LLMCompletionRequest, LLMTokenChunk, LLMCompletionResult } from './llm.interface.js';
export declare class StubLLMProvider implements LLMProvider {
    readonly name = "stub";
    stream(req: LLMCompletionRequest): AsyncIterable<LLMTokenChunk>;
    complete(req: LLMCompletionRequest): Promise<LLMCompletionResult>;
    private compose;
    private extractSentences;
    private composeQuestions;
    private countWords;
}
//# sourceMappingURL=llm.stub.d.ts.map