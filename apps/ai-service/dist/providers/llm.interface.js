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
export {};
//# sourceMappingURL=llm.interface.js.map