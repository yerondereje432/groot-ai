/**
 * Auth service — per spec §12.
 * Phone-first registration + OTP verification → JWT pair.
 */

import { Injectable, Inject, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { nanoid } from 'nanoid';
import type { CurrentUser, OtpChallenge, AuthTokens } from '@groot/shared-types';
import { DatabaseModule } from '../../database/database.module.js';
import { OtpService } from './otp.service.js';
import { SmsProvider, ConsoleSmsProvider } from './sms.provider.js';

export interface RegisterInput {
  phone: string;
  fullName: string;
  inviteCode?: string;
  role?: 'student' | 'teacher';
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseModule.PRISMA) private readonly prisma: any,
    private readonly otp: OtpService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sms: ConsoleSmsProvider,
  ) {}

  async register(input: RegisterInput): Promise<OtpChallenge> {
    const phone = this.normalizePhone(input.phone);
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) {
      throw new ConflictException('Phone number already registered');
    }
    const rec = this.otp.issue(phone);
    await this.sms.send(phone, `[Groot] Your verification code is ${rec.code}. Valid for 5 minutes.`);
    return {
      challengeId: rec.challengeId,
      phone,
      expiresIn: Math.floor((rec.expiresAt - Date.now()) / 1000),
    };
  }

  async verifyOtp(challengeId: string, code: string, profile: RegisterInput): Promise<AuthTokens> {
    if (!this.otp.verify(challengeId, code)) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    const phone = this.normalizePhone(profile.phone);
    // Create the user on first verified OTP. In a real system, profile would
    // be passed in via /register and OTP just confirms; we keep this lightweight.
    const user = await this.prisma.user.upsert({
      where: { phone },
      create: {
        phone,
        fullName: profile.fullName,
        role: profile.role ?? 'student',
        locale: 'en',
      },
      update: {},
    });
    return this.issueTokens({
      id: user.id,
      role: user.role,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email ?? null,
      locale: user.locale,
      grade: user.grade ?? undefined,
      schoolId: user.schoolId ?? undefined,
    });
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; typ: string }>(refreshToken, {
        secret: this.config.get<string>('jwtRefreshSecret'),
      });
      if (payload.typ !== 'refresh') throw new Error('Not a refresh token');
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new Error('User not found');
      return this.issueTokens({
        id: user.id,
        role: user.role,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email ?? null,
        locale: user.locale,
        grade: user.grade ?? undefined,
        schoolId: user.schoolId ?? undefined,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(_refreshToken: string): Promise<void> {
    // Real impl: blacklist refresh token in Redis until expiry.
    // Minimal: noop for the vertical.
    return;
  }

  async hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  private async issueTokens(user: CurrentUser): Promise<AuthTokens> {
    const accessTtl = this.config.get<number>('jwtAccessTtlSeconds');
    const refreshTtl = this.config.get<number>('jwtRefreshTtlSeconds');
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      locale: user.locale,
      grade: user.grade,
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, typ: 'refresh', jti: nanoid() },
      { secret: this.config.get<string>('jwtRefreshSecret'), expiresIn: refreshTtl },
    );
    return { accessToken, refreshToken, expiresIn: accessTtl };
  }

  private normalizePhone(phone: string): string {
    // Naive E.164 normalization for Ethiopian numbers.
    // Real impl should use libphonenumber-js.
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('251')) return '+' + digits;
    if (digits.startsWith('0')) return '+251' + digits.slice(1);
    return '+' + digits;
  }
}
