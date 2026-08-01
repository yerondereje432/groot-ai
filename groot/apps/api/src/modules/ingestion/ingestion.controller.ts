/**
 * Ingestion controller — admin-facing.
 *
 * Per spec §16 step 6: human reviewer approves chunks (draft → review → published).
 * This controller exposes:
 *   GET  /ingestion/jobs         — list recent jobs
 *   GET  /ingestion/pending      — list chunks awaiting approval
 *   POST /ingestion/approve/:version — promote draft → published
 *
 * Full CMS UI is out of scope for this vertical (§17). These endpoints are
 * the programmatic counterpart; admins can call them via curl/Postman in dev.
 */

import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { Roles, RolesGuard } from '../../common/guards/roles.guard.js';

@Controller('ingestion')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IngestionController {
  constructor(@Inject(DatabaseModule.PRISMA) private readonly prisma: any) {}

  @Get('pending')
  @Roles('platform_admin')
  async listPending() {
    const versions = await this.prisma.curriculumChunk.findMany({
      where: { status: 'draft' },
      distinct: ['version'],
      select: { version: true },
      orderBy: { version: 'desc' },
    });
    const counts = await this.prisma.curriculumChunk.groupBy({
      by: ['version'],
      where: { status: 'draft' },
      _count: { _all: true },
    });
    return versions.map(v => ({
      version: v.version,
      pendingChunks: counts.find(c => c.version === v.version)?._count?._all ?? 0,
    }));
  }

  @Post('approve/:version')
  @Roles('platform_admin')
  async approve(@Param('version') version: string) {
    const res = await this.prisma.curriculumChunk.updateMany({
      where: { version, status: 'draft' },
      data: { status: 'published', updatedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: null,
        action: 'ingestion.approve',
        target: version,
        metadata: { publishedCount: res.count },
      },
    });
    return { version, publishedCount: res.count };
  }
}
