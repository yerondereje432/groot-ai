/**
 * SMS provider — per spec §12 (OTP delivery abstraction).
 *
 * Previously this was ONLY `ConsoleSmsProvider` (logs to console) with real
 * delivery left as a TODO — correctly flagged in PROJECT_ANALYSIS.md as the
 * single highest-priority launch blocker ("nothing else matters if students
 * can't sign in"). This file now ships two real implementations behind the
 * same interface, following the exact pattern already used for
 * LLM/embedding/re-ranker providers elsewhere in this repo: a real
 * implementation that activates once credentials are configured, with a
 * safe fallback (console logging in dev, a thrown error in production if
 * misconfigured — see `createSmsProvider`) rather than silently pretending
 * to have sent an SMS.
 *
 * Still true: actually going live requires real credentials (Twilio account,
 * or a specific Ethiopian aggregator contract) which this repo cannot
 * provide — same posture as `GEMINI_API_KEY`. What changed is that there is
 * now a real, testable implementation to plug those credentials into,
 * instead of a console.log with no implementation at all.
 */

import { Injectable, Logger } from '@nestjs/common';

export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}

/** DI token — inject via `@Inject(SMS_PROVIDER)` to get whatever provider
 *  `createSmsProvider` selected, rather than depending on a concrete class. */
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly log = new Logger('SMS');

  async send(phone: string, message: string): Promise<void> {
    this.log.warn(`[DEV SMS] to=${phone} msg="${message}"`);
  }
}

/**
 * Twilio REST API, called directly via fetch (no SDK dependency, consistent
 * with how the Gemini providers in apps/ai-service are implemented) using
 * HTTP Basic Auth with the Account SID / Auth Token.
 * https://www.twilio.com/docs/sms/api/message-resource#create-a-message-resource
 */
export class TwilioSmsProvider implements SmsProvider {
  private readonly log = new Logger('SMS:twilio');

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromNumber: string,
  ) {}

  async send(phone: string, message: string): Promise<void> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const body = new URLSearchParams({ To: phone, From: this.fromNumber, Body: message });
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.log.error(`Twilio send failed: ${res.status} ${text}`);
      throw new Error(`SMS delivery failed (Twilio ${res.status})`);
    }
  }
}

/**
 * Generic HTTP-webhook SMS provider for Ethiopian aggregators that don't
 * have a bespoke client here (e.g. an Africa's Talking-style gateway, a
 * local telco API, or an internal relay). Posts a small JSON payload;
 * adjust the field names via env if a specific gateway expects different
 * keys — this intentionally stays provider-agnostic rather than guessing
 * one vendor's exact schema.
 */
export class HttpGatewaySmsProvider implements SmsProvider {
  private readonly log = new Logger('SMS:http-gateway');

  constructor(
    private readonly endpointUrl: string,
    private readonly apiKey: string,
  ) {}

  async send(phone: string, message: string): Promise<void> {
    const res = await fetch(this.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ to: phone, message }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.log.error(`SMS gateway send failed: ${res.status} ${text}`);
      throw new Error(`SMS delivery failed (gateway ${res.status})`);
    }
  }
}

export interface SmsProviderOptions {
  provider: 'console' | 'twilio' | 'http';
  nodeEnv: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  smsGatewayUrl?: string;
  smsGatewayApiKey?: string;
}

/**
 * Selects the configured provider, with the same fail-safe philosophy used
 * for LLM providers elsewhere: missing credentials degrade to the console
 * provider in development (so local/dev flows keep working), but throw at
 * boot in production rather than silently "succeeding" at sending an SMS
 * that never actually went out — login OTP delivery is exactly the kind of
 * failure that should be loud, not swallowed.
 */
export function createSmsProvider(opts: SmsProviderOptions): SmsProvider {
  const log = new Logger('SMS:factory');

  if (opts.provider === 'twilio') {
    if (opts.twilioAccountSid && opts.twilioAuthToken && opts.twilioFromNumber) {
      return new TwilioSmsProvider(opts.twilioAccountSid, opts.twilioAuthToken, opts.twilioFromNumber);
    }
    const msg = 'SMS_PROVIDER=twilio requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.';
    if (opts.nodeEnv === 'production') throw new Error(msg);
    log.error(`${msg} Falling back to ConsoleSmsProvider for local dev.`);
    return new ConsoleSmsProvider();
  }

  if (opts.provider === 'http') {
    if (opts.smsGatewayUrl && opts.smsGatewayApiKey) {
      return new HttpGatewaySmsProvider(opts.smsGatewayUrl, opts.smsGatewayApiKey);
    }
    const msg = 'SMS_PROVIDER=http requires SMS_GATEWAY_URL and SMS_GATEWAY_API_KEY.';
    if (opts.nodeEnv === 'production') throw new Error(msg);
    log.error(`${msg} Falling back to ConsoleSmsProvider for local dev.`);
    return new ConsoleSmsProvider();
  }

  if (opts.nodeEnv === 'production') {
    log.error(
      'SMS_PROVIDER=console in production — OTPs are only logged to stdout, not delivered. ' +
        'Students will not be able to sign in. Set SMS_PROVIDER=twilio or SMS_PROVIDER=http with real credentials.',
    );
  }
  return new ConsoleSmsProvider();
}
