/**
 * Local stub embedder — duplicated from AI service to keep the worker
 * independently runnable. A real deployment would call the AI service
 * over HTTP, but for the vertical we keep everything in-process to
 * minimize moving parts.
 *
 * IMPORTANT: keep this class byte-for-byte compatible with the AI service's
 * StubEmbeddingProvider. If you change one, change both. (See ASSUMPTIONS.md.)
 */

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimension: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export class StubEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'stub';
  readonly dimension: number;

  constructor(dimension = 384) {
    this.dimension = dimension;
  }

  async embed(text: string): Promise<number[]> {
    return this.embedBatch([text]).then(v => v[0]!);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(t => this.embedOne(t));
  }

  private embedOne(text: string): number[] {
    const vec = new Array<number>(this.dimension).fill(0);
    const tokens = this.tokenize(text);
    if (tokens.length === 0) return vec;
    for (const tok of tokens) {
      const h = this.hash32(tok);
      const idx1 = h % this.dimension;
      const idx2 = (h * 31) % this.dimension;
      const idx3 = (h * 131) % this.dimension;
      const sign = (h & 1) === 0 ? 1 : -1;
      vec[idx1] = (vec[idx1] ?? 0) + sign * 1.0;
      vec[idx2] = (vec[idx2] ?? 0) + sign * 0.5;
      vec[idx3] = (vec[idx3] ?? 0) + sign * 0.25;
    }
    return this.l2Normalize(vec);
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').split(/\s+/).filter(t => t.length >= 2);
  }

  private hash32(s: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  private l2Normalize(v: number[]): number[] {
    let norm = 0;
    for (const x of v) norm += x * x;
    norm = Math.sqrt(norm) || 1;
    return v.map(x => x / norm);
  }
}
