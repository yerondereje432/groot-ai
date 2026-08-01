import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CurriculumModule } from './modules/curriculum/curriculum.module.js';
import { TutorModule } from './modules/tutor/tutor.module.js';
import { IngestionModule } from './modules/ingestion/ingestion.module.js';
import { HealthController } from './modules/health/health.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    DatabaseModule,
    AuthModule,
    CurriculumModule,
    TutorModule,
    IngestionModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
