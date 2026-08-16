import type { EmbeddingProvider } from './index.js';

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'gemini';
  readonly dimension: number;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey: string, model = 'gemini-embedding-2', dimension = 768) {
    this.apiKey = apiKey;
    this.model = model;
    this.dimension = dimension;
  }

  async embed(text: string): Promise<number[]> {
    const url = `${this.baseUrl}/models/${this.model}:embedContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: this.dimension
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini embedding error: ${response.status} ${response.statusText}\nBody: ${errorText}`);
    }

    const data = (await response.json()) as any;
    return data.embedding.values;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }
}
