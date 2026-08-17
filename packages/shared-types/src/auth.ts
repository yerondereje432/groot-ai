/**
 * Auth types — per spec §12.
 *
 * Phone-first registration is [DEFAULT] for Ethiopian users who often lack email.
 * OTP delivery is abstracted behind an SmsProvider interface.
 */

export interface RegisterRequest {
  phone: string;
  fullName: string;
  /** Optional for student self-signup; required for teacher/admin invite flow. */
  inviteCode?: string;
  role?: 'student' | 'teacher';
}

export interface OtpChallenge {
  /** Opaque challenge ID returned by /auth/register; required to verify. */
  challengeId: string;
  /** Phone number in E.164 format. */
  phone: string;
  /** Seconds until this OTP expires. */
  expiresIn: number;
}

export interface VerifyOtpRequest {
  challengeId: string;
  code: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface CurrentUser {
  id: string;
  role: 'student' | 'teacher' | 'school_admin' | 'platform_admin';
  fullName: string;
  phone: string;
  email?: string | null;
  locale: 'am' | 'en';
  grade?: 9 | 10 | 11 | 12;
  schoolId?: string;
}
