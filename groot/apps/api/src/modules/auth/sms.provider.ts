/**
 * SMS provider interface — per spec §12 (OTP delivery abstraction).
 * Real implementation should target an Ethiopian SMS gateway.
 */

import { Injectable, Logger } from '@nestjs/common';

export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}

@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly log = new Logger('SMS');

  async send(phone: string, message: string): Promise<void> {
    this.log.warn(`[DEV SMS] to=${phone} msg="${message}"`);
  }
}
