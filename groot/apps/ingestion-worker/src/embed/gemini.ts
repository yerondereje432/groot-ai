import type { EmbeddingProvider } from './index.js';

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'gemini';
  readonly dimension: number;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey: string, model = 'text-embedding-004', dimension = 768) {
    this.apiKey = apiKey;
    this.model = model;
    this.dimension = dimension;
  }

  async embed(text: string): Promise<number[]> {
    const res = await this.embedBatch([text]);
    return res[0]!;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const url = `${this.baseUrl}/models/${this.model}:batchEmbedContents?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: texts.map(text => ({
          model: `models/${this.model}`,
          content: { parts: [{ text }] },
          taskType: 'RETRIEVAL_DOCUMENT',
          outputDimensionality: this.dimension
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini batch embedding error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embeddings.map((e: any) => e.values);
  }
}
