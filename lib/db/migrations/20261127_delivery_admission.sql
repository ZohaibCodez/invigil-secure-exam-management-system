-- External Neon: apply explicitly BEFORE deploying code that selects these fields.
-- Additive only. This does not rewrite active attempts, existing grades or papers.
BEGIN;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS delivery_settings jsonb NOT NULL DEFAULT
  '{"requireProctorApproval":false,"requireReadiness":false,"confirmSubjects":false,"lockOnSave":false,"minimumAttemptPercent":0,"venue":"","sessionLabel":""}'::jsonb;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS delivery_settings jsonb NOT NULL DEFAULT
  '{"requireProctorApproval":false,"requireReadiness":false,"confirmSubjects":false,"lockOnSave":false,"minimumAttemptPercent":0,"venue":"","sessionLabel":""}'::jsonb;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS entry_attestation jsonb;
CREATE TABLE IF NOT EXISTS admissions (
  id text PRIMARY KEY,
  exam_id text NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  candidate_id text NOT NULL REFERENCES "user"(id),
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  decided_at timestamptz,
  decided_by text REFERENCES "user"(id),
  reason text NOT NULL DEFAULT '',
  consumed_at timestamptz,
  attempt_id text REFERENCES attempts(id),
  CONSTRAINT admissions_status_check CHECK (status IN ('pending','approved','denied','consumed','expired')),
  CONSTRAINT admissions_window_check CHECK (expires_at > requested_at)
);
CREATE INDEX IF NOT EXISTS admissions_candidate_exam_idx ON admissions(candidate_id, exam_id);
CREATE INDEX IF NOT EXISTS admissions_exam_status_idx ON admissions(exam_id, status);
COMMIT;
