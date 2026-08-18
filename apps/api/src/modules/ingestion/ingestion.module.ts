import { Module } from '@nestjs/common';
import { IngestionController } from './ingestion.controller.js';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [IngestionController],
})
export class IngestionModule {}
