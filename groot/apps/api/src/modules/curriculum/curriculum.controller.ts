/**
 * Curriculum controller — read-only endpoints that students and teachers
 * use to navigate the curriculum hierarchy (subjects → units → topics).
 *
 * Per spec §18/§19/§20: these are the basis for the dashboard selectors.
 */

import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

@Controller('curriculum')
@UseGuards(JwtAuthGuard)
export class CurriculumController {
  constructor(@Inject(DatabaseModule.PRISMA) private readonly prisma: any) {}

  @Get('subjects')
  async listSubjects() {
    return this.prisma.subject.findMany({
      orderBy: [{ grade: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, grade: true, language: true },
    });
  }

  @Get('subjects/:id/units')
  async listUnits(@Param('id') id: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id } });
    if (!subject) throw new NotFoundException('Subject not found');
    return this.prisma.unit.findMany({
      where: { subjectId: id },
      orderBy: { orderIndex: 'asc' },
      include: { topics: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  @Get('topics/:id/chunks')
  async listTopicChunks(@Param('id') id: string) {
    const topic = await this.prisma.topic.findUnique({ where: { id } });
    if (!topic) throw new NotFoundException('Topic not found');
    return this.prisma.curriculumChunk.findMany({
      where: { topicId: id, status: 'published' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, content: true, sourceRef: true, version: true, status: true, createdAt: true,
      },
    });
  }
}
