/**
 * Tutor proxy service — forwards requests to the AI service.
 *
 * Per spec §8: Core API ↔ AI Service is internal REST.
 * Per spec §10: AI/RAG Service is a separate deployable.
 *
 * Streaming: the AI service emits SSE; we relay it byte-for-byte to the client.
 */

import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TutorQuery, TutorResponse } from '@groot/shared-types';

@Injectable()
export class TutorProxyService {
  private readonly log = new Logger('TutorProxy');
  private readonly aiUrl: string;
  private readonly aiTimeoutMs = 30_000;

  constructor(private readonly config: ConfigService) {
    this.aiUrl = this.config.get<string>('aiServiceUrl', 'http://localhost:4001');
  }

  /**
   * Stream SSE events from the AI service.
   * Yields raw "data: …\n\n" chunks.
   */
  async *stream(q: TutorQuery): AsyncIterable<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.aiTimeoutMs);
    try {
      const res = await fetch(`${this.aiUrl}/v1/tutor/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(q),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new ServiceUnavailableException(`AI service returned ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // Yield complete lines; keep partial lines in buffer.
        const lines = buf.split('\n\n');
        buf = lines.pop() ?? '';
        for (const chunk of lines) {
          if (chunk) yield chunk + '\n\n';
        }
      }
      if (buf) yield buf + '\n\n';
    } catch (err) {
      this.log.error('AI stream failed', (err as Error).message);
      throw new ServiceUnavailableException('AI service unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }

  async once(q: TutorQuery): Promise<TutorResponse> {
    try {
      const res = await fetch(`${this.aiUrl}/v1/tutor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(q),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new ServiceUnavailableException(`AI service error ${res.status}: ${text}`);
      }
      return (await res.json()) as TutorResponse;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.log.error('AI once failed', (err as Error).message);
      throw new ServiceUnavailableException('AI service unavailable');
    }
  }
}
