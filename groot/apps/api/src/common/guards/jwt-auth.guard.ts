/**
 * JWT auth guard — per spec §12.
 * Validates the Bearer token and attaches the decoded user to the request.
 */

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CurrentUser } from '@groot/shared-types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers['authorization'] as string | undefined;
    if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }
    const token = auth.slice('bearer '.length).trim();
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: CurrentUser['role']; locale: CurrentUser['locale']; grade?: CurrentUser['grade'] }>(token);
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
