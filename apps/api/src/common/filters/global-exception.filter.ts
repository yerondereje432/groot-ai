/**
 * Global exception filter — per spec §26 standardized error envelope.
 */

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiError } from '@groot/shared-types';
import { nanoid } from 'nanoid';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    const correlationId = nanoid();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    const details: Array<{ field: string; message: string }> = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as { message?: string | string[]; code?: string; error?: string };
        if (Array.isArray(b.message)) {
          message = 'Validation failed';
          code = 'VALIDATION_ERROR';
          for (const m of b.message) {
            details.push({ field: 'unknown', message: String(m) });
          }
        } else if (typeof b.message === 'string') {
          message = b.message;
          code = b.code ?? this.statusToCode(status);
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      message = exception.message;
    }

    const body: ApiError = {
      error: {
        code,
        message,
        ...(details.length > 0 ? { details } : {}),
        correlationId,
      },
    };

    res.status(status).json(body);
  }

  private statusToCode(status: number): string {
    switch (status) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHENTICATED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 409: return 'CONFLICT';
      case 422: return 'VALIDATION_ERROR';
      case 429: return 'RATE_LIMITED';
      default: return 'INTERNAL_ERROR';
    }
  }
}
