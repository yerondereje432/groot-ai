import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createSmsProvider,
  ConsoleSmsProvider,
  TwilioSmsProvider,
  HttpGatewaySmsProvider,
} from './sms.provider.js';

describe('createSmsProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to ConsoleSmsProvider', () => {
    const p = createSmsProvider({ provider: 'console', nodeEnv: 'development' });
    expect(p).toBeInstanceOf(ConsoleSmsProvider);
  });

  it('returns a TwilioSmsProvider when Twilio credentials are present', () => {
    const p = createSmsProvider({
      provider: 'twilio',
      nodeEnv: 'production',
      twilioAccountSid: 'AC123',
      twilioAuthToken: 'secret',
      twilioFromNumber: '+15550000000',
    });
    expect(p).toBeInstanceOf(TwilioSmsProvider);
  });

  it('throws in production if SMS_PROVIDER=twilio but credentials are missing', () => {
    expect(() => createSmsProvider({ provider: 'twilio', nodeEnv: 'production' })).toThrow(
      /TWILIO_ACCOUNT_SID/,
    );
  });

  it('falls back to ConsoleSmsProvider in development if twilio credentials are missing', () => {
    const p = createSmsProvider({ provider: 'twilio', nodeEnv: 'development' });
    expect(p).toBeInstanceOf(ConsoleSmsProvider);
  });

  it('returns an HttpGatewaySmsProvider when gateway credentials are present', () => {
    const p = createSmsProvider({
      provider: 'http',
      nodeEnv: 'production',
      smsGatewayUrl: 'https://sms.example.et/send',
      smsGatewayApiKey: 'key123',
    });
    expect(p).toBeInstanceOf(HttpGatewaySmsProvider);
  });

  it('throws in production if SMS_PROVIDER=http but gateway credentials are missing', () => {
    expect(() => createSmsProvider({ provider: 'http', nodeEnv: 'production' })).toThrow(
      /SMS_GATEWAY_URL/,
    );
  });
});

describe('TwilioSmsProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to the Twilio Messages API with Basic Auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new TwilioSmsProvider('AC123', 'secret', '+15550000000');
    await provider.send('+251911234567', 'Your code is 123456');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('AC123:secret').toString('base64')}`);
    expect(init.body.toString()).toContain('To=%2B251911234567');
  });

  it('throws when Twilio responds with a non-2xx status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'bad auth' }));
    const provider = new TwilioSmsProvider('AC123', 'bad', '+15550000000');
    await expect(provider.send('+251911234567', 'hi')).rejects.toThrow(/SMS delivery failed/);
  });
});

describe('HttpGatewaySmsProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs JSON with a bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new HttpGatewaySmsProvider('https://sms.example.et/send', 'key123');
    await provider.send('+251911234567', 'Your code is 123456');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://sms.example.et/send');
    expect(init.headers.Authorization).toBe('Bearer key123');
    expect(JSON.parse(init.body)).toEqual({ to: '+251911234567', message: 'Your code is 123456' });
  });

  it('throws when the gateway responds with a non-2xx status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'oops' }));
    const provider = new HttpGatewaySmsProvider('https://sms.example.et/send', 'key123');
    await expect(provider.send('+251911234567', 'hi')).rejects.toThrow(/SMS delivery failed/);
  });
});
