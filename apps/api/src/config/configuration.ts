/**
 * Centralized API config — per spec §29 12-factor.
 */

export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://groot:groot_dev_password@localhost:5432/groot',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-only-replace-me',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-only-replace-me',
  jwtAccessTtlSeconds: parseInt(process.env.JWT_ACCESS_TTL_SECONDS ?? '900', 10),
  jwtRefreshTtlSeconds: parseInt(process.env.JWT_REFRESH_TTL_SECONDS ?? '2592000', 10),
  aiServiceUrl: process.env.AI_SERVICE_URL ?? 'http://localhost:4001',
  rateLimitAiPerDayFree: parseInt(process.env.RATE_LIMIT_AI_PER_DAY_FREE ?? '20', 10),

  // SMS OTP delivery — see apps/api/src/modules/auth/sms.provider.ts.
  // 'console' (dev default, logs to stdout) | 'twilio' | 'http' (generic
  // gateway for Ethiopian aggregators).
  smsProvider: (process.env.SMS_PROVIDER ?? 'console') as 'console' | 'twilio' | 'http',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER,
  smsGatewayUrl: process.env.SMS_GATEWAY_URL,
  smsGatewayApiKey: process.env.SMS_GATEWAY_API_KEY,
});
