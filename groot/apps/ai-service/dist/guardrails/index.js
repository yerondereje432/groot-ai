/**
 * Guardrails — per spec §13 step 6 and §27 AI safety.
 *
 * Three guards, applied in order:
 *   1. Unsafe-request guard: blocks content that is unsafe for minors.
 *   2. Curriculum-lock guard: blocks if retrieval confidence is too low.
 *   3. PII guard: redacts obvious PII patterns from prompts before sending.
 *
 * If any guard fires, the orchestrator returns a refusal (no LLM call).
 */
// Conservative blocklist — kept small and explicit to minimize false positives.
// Real systems would use a dedicated moderation model.
const UNSAFE_PATTERNS = [
    /\b(?:kill\s+(?:myself|yourself|himself|herself))\b/i,
    /\b(?:suicide|self[- ]harm)\b/i,
    /\b(?:how\s+to\s+(?:make|build)\s+(?:a\s+)?(?:bomb|explosive|weapon))\b/i,
    /\b(?:child\s+(?:porn|abuse|exploitation))\b/i,
    /\b(?:rape|sexual\s+assault)\b/i,
];
// Loose PII patterns. Not exhaustive — defense in depth, not the only line.
const PII_PATTERNS = [
    { re: /\b\d{10,13}\b/g, replacement: '[REDACTED-PHONE]' },
    { re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, replacement: '[REDACTED-EMAIL]' },
];
export function applyGuards(ctx) {
    // 1. Unsafe-request guard.
    for (const pat of UNSAFE_PATTERNS) {
        if (pat.test(ctx.query)) {
            return {
                pass: false,
                refusal: unsafeRefusal(ctx.locale),
                redactedQuery: redactPii(ctx.query),
            };
        }
    }
    // 2. Curriculum-lock guard.
    if (!ctx.retrieval.hasConfidentAnswer) {
        return {
            pass: false,
            refusal: curriculumRefusal(ctx.locale),
            redactedQuery: redactPii(ctx.query),
        };
    }
    // 3. PII guard — pass through redacted query.
    return {
        pass: true,
        redactedQuery: redactPii(ctx.query),
    };
}
function unsafeRefusal(locale) {
    return {
        reason: 'unsafe_request',
        message: locale === 'am'
            ? 'ይቅርታ፣ ለዚህ ጥያቄ ምላሽ መስጠት አልቻልንም። እባክህ ከአዲስ ሰው ጋር ተነጋገር።'
            : "I can't help with that. Please talk to a trusted adult, counselor, or teacher.",
    };
}
function curriculumRefusal(locale) {
    return {
        reason: 'low_retrieval_confidence',
        message: locale === 'am'
            ? 'ይቅርታ፣ ይህ ጥያቄ ከኮሪኩለምህ ውጭ ሊሆን ይችላል። በተጨማሪ እባክህ ትምህርት ሰነድህን ይመልከቱ።'
            : 'This question may be outside your curriculum. Please consult your textbook or teacher for guidance.',
    };
}
export function redactPii(text) {
    let out = text;
    for (const { re, replacement } of PII_PATTERNS) {
        out = out.replace(re, replacement);
    }
    return out;
}
//# sourceMappingURL=index.js.map