import { Module } from '@nestjs/common';
import { CurriculumController } from './curriculum.controller.js';
import { DatabaseModule } from '../../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CurriculumController],
})
export class CurriculumModule {}
