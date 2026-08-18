/**
 * Auth module — per spec §12.
 *
 * MVP scope:
 *   - POST /auth/register   → create user, generate OTP challenge
 *   - POST /auth/verify-otp → verify OTP, return JWT pair
 *   - POST /auth/refresh    → rotate access token
 *   - POST /auth/logout     → invalidate refresh token
 *
 * SMS delivery is stubbed (logs OTP to console in dev). Real wiring requires
 * an Ethiopian SMS gateway provider (e.g., Africa's Talking, local telco).
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';
import { ConsoleSmsProvider } from './sms.provider.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('jwtAccessSecret'),
        signOptions: { expiresIn: cfg.get<number>('jwtAccessTtlSeconds') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, ConsoleSmsProvider],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
