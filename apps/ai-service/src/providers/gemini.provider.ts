import type { 
  LLMProvider, 
  LLMCompletionRequest, 
  LLMCompletionResult, 
  LLMTokenChunk, 
  LLMStructuredPrompt 
} from './llm.interface.js';
import type { EmbeddingProvider } from './llm.factory.js';
import { GEMINI_MODELS } from '@groot/shared-types';

export class GeminiProvider implements LLMProvider, EmbeddingProvider {
  readonly name = 'gemini';
  readonly dimension: number;
  private readonly apiKey: string;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private readonly generationModel: string;
  private readonly embeddingModel: string;

  constructor(options: { 
    apiKey: string; 
    generationModel?: string; 
    embeddingModel?: string;
    dimension?: number;
  }) {
    this.apiKey = options.apiKey;
    this.generationModel = options.generationModel || GEMINI_MODELS.generation;
    this.embeddingModel = options.embeddingModel || GEMINI_MODELS.embedding;
    this.dimension = options.dimension || 768; // text-embedding-004 defaults to 768 but can be varied
  }

  async *stream(req: LLMCompletionRequest): AsyncIterable<LLMTokenChunk> {
    // `alt=sse` is the documented way to get real Server-Sent Events
    // ("data: {...}\n\n" lines) out of streamGenerateContent. Without it,
    // Gemini instead returns a single chunked JSON *array* of response
    // objects, which has no line-delimited framing and is genuinely
    // ambiguous to parse incrementally (the previous implementation here
    // hand-rolled a heuristic array parser that could mis-split tokens on
    // awkward chunk boundaries). SSE framing removes that ambiguity: each
    // event is delimited by a blank line, so partial reads just mean "wait
    // for more bytes," never "guess whether this JSON is complete."
    const url = `${this.baseUrl}/models/${this.generationModel}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    const body = this.mapToGeminiBody(req.prompt, req.maxOutputTokens, req.stopSequences);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Gemini streaming error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader for Gemini stream');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line; keep any trailing partial
      // event in the buffer until more bytes arrive.
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        for (const line of event.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice('data:'.length).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (delta) {
              yield { delta, done: false };
            }
          } catch {
            // Malformed/partial SSE payload for this event — skip it rather
            // than throwing away the whole stream.
          }
        }
      }
    }
    yield { delta: '', done: true };
  }

  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResult> {
    const url = `${this.baseUrl}/models/${this.generationModel}:generateContent?key=${this.apiKey}`;
    const body = this.mapToGeminiBody(req.prompt, req.maxOutputTokens, req.stopSequences);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Gemini error: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return {
      content,
      usage: {
        input: data.usageMetadata?.promptTokenCount || 0,
        output: data.usageMetadata?.candidatesTokenCount || 0
      }
    };
  }

  async embed(text: string): Promise<number[]> {
    const url = `${this.baseUrl}/models/${this.embeddingModel}:embedContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${this.embeddingModel}`,
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_QUERY',
        outputDimensionality: this.dimension
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini embedding error: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    return data.embedding.values;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const url = `${this.baseUrl}/models/${this.embeddingModel}:batchEmbedContents?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: texts.map(text => ({
          model: `models/${this.embeddingModel}`,
          content: { parts: [{ text }] },
          taskType: 'RETRIEVAL_DOCUMENT',
          outputDimensionality: this.dimension
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini batch embedding error: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    return data.embeddings.map((e: any) => e.values);
  }

  private mapToGeminiBody(prompt: LLMStructuredPrompt, maxTokens?: number, stop?: string[]) {
    // Format curriculum excerpts into a clear context block
    const contextStr = prompt.context
      .map(c => `[Source: ${c.sourceRef}]\n${c.content}`)
      .join('\n\n---\n\n');

    return {
      system_instruction: {
        parts: [{ text: prompt.system }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: `CONTEXT:\n${contextStr}\n\nQUESTION: ${prompt.userQuery}` }]
        }
      ],
      generationConfig: {
        maxOutputTokens: maxTokens || 350,
        stopSequences: stop || ['\n\n\n']
      }
    };
  }
}
