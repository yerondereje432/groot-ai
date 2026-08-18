import { Module } from '@nestjs/common';
import { CurriculumController } from './curriculum.controller.js';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [CurriculumController],
})
export class CurriculumModule {}
