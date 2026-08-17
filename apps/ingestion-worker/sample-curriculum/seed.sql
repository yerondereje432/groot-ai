-- =============================================================
-- GROOT — Sample curriculum seed
-- Maps the sample markdown files to the curriculum hierarchy so
-- the ingestion worker has valid Subject/Unit/Topic records to
-- attach chunks to.
--
-- This is SAMPLE data (see README.md). Replace with real MoE
-- structure when production content is available.
-- =============================================================

BEGIN;

-- Grade 9 Science
INSERT INTO subjects (id, name, grade, language) VALUES
  ('00000000-0000-4000-8000-000000000001', 'Science', 9, 'en')
ON CONFLICT (name, grade, language) DO NOTHING;

INSERT INTO units (id, subject_id, title, order_index, curriculum_version) VALUES
  ('00000000-0000-4000-8000-000000000010',
   '00000000-0000-4000-8000-000000000001',
   'Energy', 1, '2024.1')
ON CONFLICT (subject_id, order_index) DO NOTHING;

INSERT INTO topics (id, unit_id, title, order_index) VALUES
  ('00000000-0000-4000-8000-000000000100',
   '00000000-0000-4000-8000-000000000010',
   'Photosynthesis', 1)
ON CONFLICT (unit_id, order_index) DO NOTHING;

-- Grade 10 Civics
INSERT INTO subjects (id, name, grade, language) VALUES
  ('00000000-0000-4000-8000-000000000002', 'Civics', 10, 'en')
ON CONFLICT (name, grade, language) DO NOTHING;

INSERT INTO units (id, subject_id, title, order_index, curriculum_version) VALUES
  ('00000000-0000-4000-8000-000000000020',
   '00000000-0000-4000-8000-000000000002',
   'Forms of Government', 1, '2024.1')
ON CONFLICT (subject_id, order_index) DO NOTHING;

INSERT INTO topics (id, unit_id, title, order_index) VALUES
  ('00000000-0000-4000-8000-000000000200',
   '00000000-0000-4000-8000-000000000020',
   'Federalism', 1)
ON CONFLICT (unit_id, order_index) DO NOTHING;

-- Grade 10 Chemistry
INSERT INTO subjects (id, name, grade, language) VALUES
  ('00000000-0000-4000-8000-000000000003', 'Chemistry', 10, 'en')
ON CONFLICT (name, grade, language) DO NOTHING;

INSERT INTO units (id, subject_id, title, order_index, curriculum_version) VALUES
  ('00000000-0000-4000-8000-000000000030',
   '00000000-0000-4000-8000-000000000003',
   'Chemical Reactions', 1, '2024.1')
ON CONFLICT (subject_id, order_index) DO NOTHING;

INSERT INTO topics (id, unit_id, title, order_index) VALUES
  ('00000000-0000-4000-8000-000000000300',
   '00000000-0000-4000-8000-000000000030',
   'Electrolysis', 1)
ON CONFLICT (unit_id, order_index) DO NOTHING;

COMMIT;
