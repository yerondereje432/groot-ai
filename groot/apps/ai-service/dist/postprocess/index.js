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
export function postProcess(answer, citations) {
    let out = answer.trim();
    // Replace "[Source: undefined]" with the first citation if available.
    const first = citations[0];
    if (first) {
        out = out.replace(/\[Source:\s*undefined\]/g, `[Source: ${first.sourceRef}]`);
    }
    else {
        out = out.replace(/\[Source:\s*undefined\]/g, '');
    }
    // Ensure at least one citation. If the model omitted it, append.
    if (first && !out.includes('[Source:')) {
        out += `\n\n[Source: ${first.sourceRef}]`;
    }
    return out;
}
//# sourceMappingURL=index.js.map