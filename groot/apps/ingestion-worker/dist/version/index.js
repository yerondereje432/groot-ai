/**
 * Curriculum versioning.
 *
 * Per spec §16 step 7: "Versioning — each ingestion creates a version; rollback supported."
 * Per spec §15: "Versioning: vectors tagged with curriculum version so re-ingestion
 *               doesn't break live queries."
 *
 * Version format: "YYYY.S" — the year of MoE release + sequential index.
 * Example: "2024.1" → first release in 2024, "2024.2" → mid-year correction.
 */
export function newVersion(year, sequence, label) {
    return {
        id: `${year}.${sequence}`,
        label,
        activatedAt: new Date().toISOString(),
    };
}
/** Compare two versions. Returns -1, 0, 1. */
export function compareVersions(a, b) {
    const [ay, as] = a.split('.').map(Number);
    const [by, bs] = b.split('.').map(Number);
    if (ay !== by)
        return ay < by ? -1 : 1;
    return as < bs ? -1 : as > bs ? 1 : 0;
}
//# sourceMappingURL=index.js.map