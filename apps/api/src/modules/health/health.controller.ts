import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  health() {
    return {
      status: 'ok',
      service: 'groot-api',
      env: this.config.get('nodeEnv'),
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
