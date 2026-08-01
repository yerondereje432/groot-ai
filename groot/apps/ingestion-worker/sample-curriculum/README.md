# Sample Curriculum (WATERMARK)

**WARNING: This content is SAMPLE DATA ONLY — NOT OFFICIAL MOE CONTENT.**

This directory contains synthetic curriculum text created specifically to
exercise the Groot ingestion and retrieval pipeline end-to-end. It is:

- NOT sourced from the Ethiopian Ministry of Education.
- NOT for student use. Students must use the official MoE textbooks.
- NOT a substitute for any real curriculum.

The content covers three topics that are referenced in the Groot spec (§3, §7):

1. **Photosynthesis** (Grade 9 Science) — referenced as a concept-explanation scenario.
2. **Federalism** (Grade 10 Civics) — referenced as the example user story (§7).
3. **Electrolysis** (Grade 10 Chemistry) — referenced as the teacher analytics scenario (§3, §7).

The text is intentionally concise and curriculum-shaped so that the chunker,
retriever, and orchestrator have realistic inputs to operate on.

## Files

- `g9-science-photosynthesis.md`
- `g10-civics-federalism.md`
- `g10-chemistry-electrolysis.md`
- `seed.sql` — seeds Subject/Unit/Topic records so ingestion has a target.

## Replacing this content with real MoE textbooks

When real content is available:

1. Drop the official PDF/MD files into this directory (or a configured path).
2. Update the Subject/Unit/Topic mapping in `seed.sql` to match the MoE structure.
3. Re-run `npm run ingest:sample`.
4. A human reviewer must then run the QA approval step before chunks become
   'published' and are queryable.

Until then, this sample is the only content in the vector store.
