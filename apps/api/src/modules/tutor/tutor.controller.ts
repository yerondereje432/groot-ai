/**
 * Tutor controller — per spec §42.
 *
 *   POST /api/v1/tutor/stream  → SSE stream
 *   POST /api/v1/tutor          → one-shot
 *
 * Authenticated via JWT (per §26). Free-tier metering via UsageMeter (§22).
 */

import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, Max, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TutorProxyService } from './tutor-proxy.service.js';
import { UsageMeter } from './usage-meter.service.js';
import type { TutorResponse } from '@groot/shared-types';

class TutorQueryDto {
  @IsUUID() subjectId!: string;
  @IsOptional() @IsUUID() topicId?: string;
  @IsInt() @Min(9) @Max(12) grade!: 9 | 10 | 11 | 12;
  @IsString() @MaxLength(2000) query!: string;
  @IsEnum(['am', 'en']) locale!: 'am' | 'en';
}

@Controller('tutor')
@UseGuards(JwtAuthGuard)
export class TutorController {
  constructor(
    private readonly proxy: TutorProxyService,
    private readonly meter: UsageMeter,
  ) {}

  @Post('stream')
  async stream(@Req() req: Request, @Res() res: Response, @Body() dto: TutorQueryDto): Promise<void> {
    const user = req.user as { sub: string; role: string };
    const gate = await this.meter.checkAndIncrement(user.sub, user.role);
    if (!gate.allowed) {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: `Daily AI query limit reached (${gate.used}/${gate.limit}). Upgrade to Pro for unlimited access.`,
        },
      });
      return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      for await (const chunk of this.proxy.stream({
        userId: user.sub,
        subjectId: dto.subjectId,
        topicId: dto.topicId,
        grade: dto.grade,
        query: dto.query,
        locale: dto.locale,
      })) {
        res.write(chunk);
      }
    } catch {
      res.write(`data: ${JSON.stringify({ type: 'error', code: 'STREAM_ERROR', message: 'AI service unavailable' })}\n\n`);
    } finally {
      res.end();
    }
  }

  @Post()
  @HttpCode(200)
  async once(@Req() req: Request, @Body() dto: TutorQueryDto): Promise<TutorResponse> {
    const user = req.user as { sub: string; role: string };
    const gate = await this.meter.checkAndIncrement(user.sub, user.role);
    if (!gate.allowed) {
      return {
        kind: 'refusal',
        reason: 'rate_limited',
        message: `Daily AI query limit reached (${gate.used}/${gate.limit}). Upgrade to Pro for unlimited access.`,
      };
    }
    return this.proxy.once({
      userId: user.sub,
      subjectId: dto.subjectId,
      topicId: dto.topicId,
      grade: dto.grade,
      query: dto.query,
      locale: dto.locale,
    });
  }
}
