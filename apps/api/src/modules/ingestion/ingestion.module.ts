import { Module } from '@nestjs/common';
import { IngestionController } from './ingestion.controller.js';
import { DatabaseModule } from '../../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [IngestionController],
})
export class IngestionModule {}
