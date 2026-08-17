/**
 * Tutor module — proxies to the AI service.
 *
 * Per spec §8: Client ↔ API uses REST for CRUD and SSE for streaming AI responses.
 * Per spec §42: POST /tutor/stream and POST /tutor.
 *
 * The API does NOT re-implement the orchestrator. It forwards the request
 * to the AI service (separate deployable per §8) and re-streams the result
 * to the client. This preserves the boundary that lets us swap the AI
 * service implementation (Python, etc.) without touching the API.
 */

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TutorController } from './tutor.controller.js';
import { TutorProxyService } from './tutor-proxy.service.js';
import { UsageMeter } from './usage-meter.service.js';
import { DatabaseModule } from '../../database/database.module.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('jwtAccessSecret'),
        signOptions: { expiresIn: cfg.get<number>('jwtAccessTtlSeconds') },
      }),
    }),
    DatabaseModule,
  ],
  controllers: [TutorController],
  providers: [TutorProxyService, UsageMeter],
})
export class TutorModule {}
