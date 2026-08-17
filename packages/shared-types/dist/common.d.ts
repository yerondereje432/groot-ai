/**
 * Common types — error envelope, pagination, idempotency, locale.
 * Per spec §26: standardized error envelope and cursor pagination.
 */
export type Locale = 'am' | 'en';
export interface ApiError {
    error: {
        /** Stable machine-readable code, e.g. "VALIDATION_ERROR", "CURRICULUM_NOT_FOUND". */
        code: string;
        /** Human-readable message, already localized if Accept-Language was set. */
        message: string;
        /** Optional field-level details for validation errors. */
        details?: Array<{
            field: string;
            message: string;
        }>;
        /** Optional correlation ID for support/debugging. */
        correlationId?: string;
    };
}
/** Cursor-paginated list response. */
export interface CursorPage<T> {
    items: T[];
    nextCursor: string | null;
    hasMore: boolean;
}
/** Per spec §26 — used on payment and other mutation endpoints. */
export interface IdempotencyKey {
    idempotencyKey: string;
}
/** Roles per spec §12 RBAC. */
export type UserRole = 'student' | 'teacher' | 'school_admin' | 'platform_admin';
export type Grade = 9 | 10 | 11 | 12;
//# sourceMappingURL=common.d.ts.map