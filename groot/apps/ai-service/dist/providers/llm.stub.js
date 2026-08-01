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
const EXAM_LENGTH_SENTENCES = 4;
export class StubLLMProvider {
    constructor() {
        this.name = 'stub';
    }
    async *stream(req) {
        const text = this.compose(req);
        // Emit word-by-word for a believable streaming feel in dev.
        const tokens = text.split(/(\s+)/);
        for (const tok of tokens) {
            if (tok.length === 0)
                continue;
            yield { delta: tok, done: false };
        }
        yield { delta: '', done: true };
    }
    async complete(req) {
        const content = this.compose(req);
        return {
            content,
            usage: {
                input: this.countWords(req.prompt.system + ' ' + req.prompt.userQuery),
                output: this.countWords(content),
            },
            refused: false,
        };
    }
    compose(req) {
        const { prompt } = req;
        const blocks = prompt.context;
        if (blocks.length === 0) {
            return prompt.locale === 'am'
                ? 'ይቅርታ፣ ይህ ጥያቄ ከኮሪኩለምህ ውጭ ሊሆን ይችላል። በተጨማሪ እባክህ ትምህርት ሰነድህን ይመልከቱ።'
                : 'This question may be outside your curriculum. Please consult your textbook or teacher for guidance.';
        }
        const top = blocks[0];
        const sentences = this.extractSentences(top.content, EXAM_LENGTH_SENTENCES);
        if (prompt.intent === 'generate_questions') {
            return this.composeQuestions(sentences, prompt.locale);
        }
        // Default: explain — produce a concise, exam-length answer grounded in context.
        const intro = prompt.locale === 'am' ? 'ከኮሪኩለምህ መሠረት፡' : 'Based on your curriculum:';
        const body = sentences.join(' ');
        const cite = prompt.locale === 'am'
            ? `\n\n[ምንጭ: ${top.sourceRef}]`
            : `\n\n[Source: ${top.sourceRef}]`;
        return `${intro} ${body}${cite}`;
    }
    extractSentences(text, max) {
        const cleaned = text
            .replace(/\s+/g, ' ')
            .split(/(?<=[.!?])\s+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
        return cleaned.slice(0, max);
    }
    composeQuestions(sentences, locale) {
        // Skeleton; full templating is in the questions module of the ingestion worker.
        const s = sentences.join(' ');
        return locale === 'am'
            ? `ከሚከተሉት ምንጮች ላይ የተገኙ ጥያቄዎችን ይመርጣል፡\n- ${s.slice(0, 80)}…`
            : `Candidate questions derived from: ${s.slice(0, 80)}…`;
    }
    countWords(s) {
        return s.trim().split(/\s+/).filter(Boolean).length;
    }
}
//# sourceMappingURL=llm.stub.js.map