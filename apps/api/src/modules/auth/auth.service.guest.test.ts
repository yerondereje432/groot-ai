import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service.js';

/**
 * Covers the no-signup-wall guest flow (AuthService.guest()) added so
 * students can reach the tutor immediately, without a phone/OTP account.
 */
describe('AuthService.guest', () => {
  let prisma: { user: { create: ReturnType<typeof vi.fn> } };
  let jwt: { signAsync: ReturnType<typeof vi.fn> };
  let config: { get: ReturnType<typeof vi.fn> };
  let otp: Record<string, unknown>;
  let sms: { send: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        create: vi.fn().mockResolvedValue({
          id: 'user-guest-1',
          role: 'student',
          fullName: 'Guest',
          phone: 'guest:abc123',
          email: null,
          locale: 'en',
          grade: 10,
          schoolId: null,
        }),
      },
    };
    jwt = { signAsync: vi.fn().mockResolvedValue('signed.jwt.token') };
    config = {
      get: vi.fn((key: string): unknown => {
        if (key === 'jwtAccessTtlSeconds') return 3600;
        if (key === 'jwtRefreshTtlSeconds') return 2592000;
        if (key === 'jwtRefreshSecret') return 'refresh-secret';
        return undefined;
      }),
    };
    otp = {};
    sms = { send: vi.fn() };

    service = new AuthService(
      prisma as any,
      otp as any,
      jwt as any,
      config as any,
      sms as any,
    );
  });

  it('creates a real student user with a synthetic unique phone, never a real number', async () => {
    await service.guest({ grade: 10 });
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.user.create.mock.calls[0][0];
    expect(createArgs.data.role).toBe('student');
    expect(createArgs.data.phone).toMatch(/^guest:/);
    expect(createArgs.data.grade).toBe(10);
  });

  it('works without a grade (grade can be set later, inline in the chat UI)', async () => {
    await service.guest();
    const createArgs = prisma.user.create.mock.calls[0][0];
    expect(createArgs.data.grade).toBeUndefined();
  });

  it('returns a real access/refresh token pair, identical in shape to the OTP flow', async () => {
    const tokens = await service.guest({ grade: 9 });
    expect(tokens).toEqual({
      accessToken: 'signed.jwt.token',
      refreshToken: 'signed.jwt.token',
      expiresIn: 3600,
    });
    expect(jwt.signAsync).toHaveBeenCalledTimes(2);
  });

  it('never sends an SMS for guest accounts', async () => {
    await service.guest({ grade: 11 });
    expect(sms.send).not.toHaveBeenCalled();
  });
});
