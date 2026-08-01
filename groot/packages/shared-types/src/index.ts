/**
 * @groot/shared-types
 *
 * Type contracts shared across apps (api, ai-service, ingestion-worker, web).
 * These are the canonical shape of API DTOs, internal events, and core domain types.
 * Per spec §26: API is REST + JSON; errors follow the standard envelope.
 */

export * from './common';
export * from './curriculum';
export * from './tutor';
export * from './questions';
export * from './auth';
