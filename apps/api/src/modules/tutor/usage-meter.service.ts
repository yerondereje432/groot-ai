/**
 * Usage meter — per spec §22 free-tier metering.
 * Hot path: Redis counter. Cold path: durable UsageCounter table.
 *
 * This service is intentionally lightweight for the vertical. Production
 * should use Redis INCR with a daily TTL key, plus a periodic flush to the
 * DB for reporting (§21 analytics).
 */

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module.js';

@Injectable()
export class UsageMeter {
  private readonly dailyLimits = new Map<string, number>();

  constructor(
    @Inject(DatabaseModule.PRISMA) private readonly prisma: any,
    private readonly config: ConfigService,
  ) {
    this.dailyLimits.set('free', this.config.get<number>('rateLimitAiPerDayFree', 20));
  }

  async checkAndIncrement(userId: string, role: string): Promise<{ allowed: boolean; used: number; limit: number }> {
    // Free-tier metering only in this vertical. Paid users have unlimited.
    if (role !== 'student') return { allowed: true, used: 0, limit: Infinity };

    const limit = this.dailyLimits.get('free') ?? 20;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const counter = await this.prisma.usageCounter.upsert({
      where: { userId_date: { userId, date: today } },
      create: { userId, date: today, aiQueriesCount: 0 },
      update: {},
    });

    if (counter.aiQueriesCount >= limit) {
      return { allowed: false, used: counter.aiQueriesCount, limit };
    }

    await this.prisma.usageCounter.update({
      where: { userId_date: { userId, date: today } },
      data: { aiQueriesCount: { increment: 1 } },
    });

    return { allowed: true, used: counter.aiQueriesCount + 1, limit };
  }
}
