# Sample Curriculum Notes

The sample curriculum in `apps/ingestion-worker/sample-curriculum/` is
**synthetic, watermarked, and NOT for student use**. It exists solely to
exercise the ingestion and retrieval pipeline end-to-end.

## Files

| File | Maps to | Used by |
|---|---|---|
| `g9-science-photosynthesis.md` | Grade 9 Science → Energy → Photosynthesis | Example "Explain photosynthesis" query (retrieval test, eval harness) |
| `g10-civics-federalism.md` | Grade 10 Civics → Forms of Government → Federalism | Example user story (§7 "Explain federalism in simple terms") |
| `g10-chemistry-electrolysis.md` | Grade 10 Chemistry → Chemical Reactions → Electrolysis | Example teacher analytics scenario (§3 "60% of class struggles with Electrolysis") |

## IDs (referenced by sample seed.sql and eval harness)

```
Subject  g9-science       00000000-0000-4000-8000-000000000001
Unit     g9-energy        00000000-0000-4000-8000-000000000010
Topic    g9-photosynth.   00000000-0000-4000-8000-000000000100

Subject  g10-civics       00000000-0000-4000-8000-000000000002
Unit     g10-govt-forms   00000000-0000-4000-8000-000000000020
Topic    g10-federalism   00000000-0000-4000-8000-000000000200

Subject  g10-chemistry    00000000-0000-4000-8000-000000000003
Unit     g10-chem-react.  00000000-0000-4000-8000-000000000030
Topic    g10-electrolysis 00000000-0000-4000-8000-000000000300
```

These IDs match the seed SQL and the eval harness.

## Replacing with real MoE content

When real MoE textbooks are available:

1. Drop official PDFs/MD into a new directory (e.g., `real-curriculum/`).
2. Update `seed.sql` to map to the MoE hierarchy (subjects, grades, units,
   topics — many more than three).
3. Update `scripts/ingest-sample.ts` to reference the new files and IDs.
4. Run the pipeline. A human reviewer must then approve each version
   before chunks become queryable.

## Why sample, not real, in this vertical

Three reasons:

1. **Copyright**: Ethiopian MoE textbooks are not freely redistributable.
   Embedding unofficial copies would put the project at legal risk.
2. **Accuracy**: Curriculum accuracy is the product's core promise.
   We will not seed the vector store with content that hasn't gone
   through official QA.
3. **Testability**: Synthetic content with known facts is much easier to
   write deterministic eval tests against.

When official content is onboarded through proper licensing, this sample
set should be removed from production deployments.
