/**
 * OTP service — per spec §12.
 *
 * Generates, stores (in Redis; in-memory fallback for dev), and verifies OTPs.
 * Real production should use Redis with a TTL.
 */

import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { nanoid } from 'nanoid';

export interface OtpRecord {
  challengeId: string;
  phone: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

@Injectable()
export class OtpService {
  private readonly store = new Map<string, OtpRecord>();
  private readonly ttlMs = 5 * 60 * 1000;     // 5 minutes
  private readonly maxAttempts = 5;

  /** Generate a new OTP for the given phone. */
  issue(phone: string): OtpRecord {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const rec: OtpRecord = {
      challengeId: nanoid(),
      phone,
      code,
      expiresAt: Date.now() + this.ttlMs,
      attempts: 0,
    };
    this.store.set(rec.challengeId, rec);
    return rec;
  }

  /** Verify the code; returns true on success, false on failure. */
  verify(challengeId: string, code: string): boolean {
    const rec = this.store.get(challengeId);
    if (!rec) return false;
    if (Date.now() > rec.expiresAt) {
      this.store.delete(challengeId);
      return false;
    }
    rec.attempts++;
    if (rec.attempts > this.maxAttempts) {
      this.store.delete(challengeId);
      return false;
    }
    if (rec.code !== code) return false;
    this.store.delete(challengeId);
    return true;
  }
}
