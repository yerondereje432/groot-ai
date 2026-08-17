/**
 * Post-processor — per spec §13 step 5.
 *
 * For now: a thin pass that:
 *   1. Trims trailing whitespace.
 *   2. Ensures at least one citation appears in the rendered text.
 *   3. Replaces any model-emitted "[Source: undefined]" with the actual source.
 *
 * Real implementations would also run a content-moderation model here (§27).
 */
import type { TutorSourceCitation } from '@groot/shared-types';
export declare function postProcess(answer: string, citations: TutorSourceCitation[]): string;
//# sourceMappingURL=index.d.ts.map