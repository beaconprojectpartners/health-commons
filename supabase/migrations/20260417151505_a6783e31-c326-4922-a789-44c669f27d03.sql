-- Phase 2a: Moderation system schema for user-submitted medical terms
-- Includes: PHI eponym allowlist, pending term occurrences, moderation queue,
-- redaction log (with provider abstraction), reviewer onboarding tables, PHI reports.

-- ============================================================
-- 0. Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================
-- 1. Rename pending_code_entries.submitted_text -> redacted_text
--    Table is currently empty; safe rename.
-- ============================================================
ALTER TABLE public.pending_code_entries
  RENAME COLUMN submitted_text TO redacted_text;

COMMENT ON COLUMN public.pending_code_entries.redacted_text IS
  'Redacted text only. Original submitter text MUST NEVER be written here. Enforced by submit-pending-term server-side re-scrub (Phase 2b).';

-- ============================================================
-- 2. Enums
-- ============================================================
CREATE TYPE public.moderation_source AS ENUM (
  'threshold', 'specialist_suggestion', 'content_report'
);

CREATE TYPE public.moderation_item_status AS ENUM (
  'awaiting', 'in_review', 'approved_new', 'mapped_alias',
  'rejected', 'needs_info', 'deferred_to_moderator'
);

CREATE TYPE public.moderation_rejection_reason AS ENUM (
  'duplicate', 'not_medical', 'phi_leaked', 'nonsense', 'out_of_scope', 'other'
);

CREATE TYPE public.redaction_phase AS ENUM (
  'client_preview', 'server_submit', 'review_rescrub'
);

-- ============================================================
-- 3. phi_eponym_allowlist
-- ============================================================
CREATE TABLE public.phi_eponym_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term citext NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'disease_eponym',
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.phi_eponym_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eponym allowlist readable by all"
  ON public.phi_eponym_allowlist FOR SELECT USING (true);

CREATE POLICY "Admins manage eponym allowlist"
  ON public.phi_eponym_allowlist FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed
INSERT INTO public.phi_eponym_allowlist (term, category) VALUES
  ('Crohn', 'disease_eponym'),
  ('Hashimoto', 'disease_eponym'),
  ('Ehlers-Danlos', 'disease_eponym'),
  ('Sjögren', 'disease_eponym'),
  ('Behçet', 'disease_eponym'),
  ('Raynaud', 'disease_eponym'),
  ('Wegener', 'disease_eponym'),
  ('Tourette', 'disease_eponym'),
  ('Asperger', 'disease_eponym'),
  ('Parkinson', 'disease_eponym'),
  ('Alzheimer', 'disease_eponym'),
  ('Huntington', 'disease_eponym'),
  ('Down', 'disease_eponym'),
  ('Marfan', 'disease_eponym'),
  ('Turner', 'disease_eponym'),
  ('Klinefelter', 'disease_eponym'),
  ('Kawasaki', 'disease_eponym'),
  ('Kaposi', 'disease_eponym'),
  ('Hodgkin', 'disease_eponym'),
  ('Bell', 'disease_eponym'),
  ('Charcot', 'disease_eponym'),
  ('Guillain-Barré', 'disease_eponym'),
  ('Lou Gehrig', 'disease_eponym'),
  ('Lyme', 'disease_eponym'),
  ('ALS', 'disease_eponym'),
  ('myasthenia gravis', 'disease_eponym'),
  ('Stevens-Johnson', 'disease_eponym'),
  ('Peyronie', 'disease_eponym'),
  ('Dupuytren', 'disease_eponym'),
  ('Osler-Weber-Rendu', 'disease_eponym'),
  ('von Willebrand', 'disease_eponym'),
  ('Gilbert', 'disease_eponym'),
  ('Takayasu', 'disease_eponym');

-- ============================================================
-- 4. pending_term_occurrences (signed-in users only; threshold counting)
-- ============================================================
CREATE TABLE public.pending_term_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_code_entry_id uuid NOT NULL REFERENCES public.pending_code_entries(id) ON DELETE CASCADE,
  submitter_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pending_code_entry_id, submitter_id)
);

CREATE INDEX idx_occurrences_pending ON public.pending_term_occurrences(pending_code_entry_id);
CREATE INDEX idx_occurrences_submitter ON public.pending_term_occurrences(submitter_id);

ALTER TABLE public.pending_term_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submitter reads own occurrences"
  ON public.pending_term_occurrences FOR SELECT
  USING (submitter_id = auth.uid()
         OR public.has_role(auth.uid(), 'admin')
         OR public.has_role(auth.uid(), 'specialist'));

CREATE POLICY "Authenticated users insert own occurrences"
  ON public.pending_term_occurrences FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND submitter_id = auth.uid());

-- ============================================================
-- 5. moderation_queue_items
-- ============================================================
CREATE TABLE public.moderation_queue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_code_entry_id uuid NOT NULL UNIQUE REFERENCES public.pending_code_entries(id) ON DELETE CASCADE,
  priority int NOT NULL DEFAULT 0,
  source public.moderation_source NOT NULL,
  status public.moderation_item_status NOT NULL DEFAULT 'awaiting',
  claimed_by uuid,
  claimed_at timestamptz,
  decided_by uuid,
  decided_at timestamptz,
  decision_notes text,
  resolution_alias_id uuid REFERENCES public.code_aliases(id),
  resolution_code_id uuid REFERENCES public.medical_codes(id),
  rejection_reason public.moderation_rejection_reason,
  shadow_decision jsonb,
  required_tier text NULL,
  is_calibration boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.moderation_queue_items.required_tier IS
  'Reserved for peer-governance integration. Unused in Phase 2a. When governance ships, populate with the minimum reviewer tier required to act on this item.';

COMMENT ON COLUMN public.moderation_queue_items.is_calibration IS
  'Reserved for trainee shadow-review filtering. Unused in Phase 2a UI.';

CREATE INDEX idx_queue_status ON public.moderation_queue_items(status);
CREATE INDEX idx_queue_priority ON public.moderation_queue_items(priority DESC, created_at ASC);

ALTER TABLE public.moderation_queue_items ENABLE ROW LEVEL SECURITY;

-- TODO(governance): Approval rights are currently "any specialist in scope OR admin".
-- Once peer-governance tiers land, gate on required_tier column on moderation_queue_items.
-- Removal trigger: governance tier system shipped + tier assignment UI live.
CREATE POLICY "Reviewers read queue"
  ON public.moderation_queue_items FOR SELECT
  USING (public.has_role(auth.uid(), 'admin')
         OR public.has_role(auth.uid(), 'specialist'));

CREATE POLICY "Reviewers update queue"
  ON public.moderation_queue_items FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin')
         OR public.has_role(auth.uid(), 'specialist'))
  WITH CHECK (public.has_role(auth.uid(), 'admin')
              OR public.has_role(auth.uid(), 'specialist'));

CREATE POLICY "Service role inserts queue items"
  ON public.moderation_queue_items FOR INSERT
  WITH CHECK (auth.role() = 'service_role'
              OR public.has_role(auth.uid(), 'admin')
              OR public.has_role(auth.uid(), 'specialist'));

CREATE TRIGGER trg_moderation_queue_updated_at
  BEFORE UPDATE ON public.moderation_queue_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. redaction_log (with provider abstraction)
-- ============================================================
CREATE TABLE public.redaction_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_code_entry_id uuid REFERENCES public.pending_code_entries(id) ON DELETE SET NULL,
  moderation_queue_item_id uuid REFERENCES public.moderation_queue_items(id) ON DELETE SET NULL,
  phase public.redaction_phase NOT NULL,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider text NOT NULL,
  model_version text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.redaction_log IS
  'Counts-by-type only. NEVER stores any text. Provider field identifies which PHI detector ran.';

CREATE INDEX idx_redaction_log_created ON public.redaction_log(created_at DESC);
CREATE INDEX idx_redaction_log_provider ON public.redaction_log(provider, created_at DESC);

ALTER TABLE public.redaction_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read redaction log"
  ON public.redaction_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role inserts redaction log"
  ON public.redaction_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 7. reviewer_status (calibration + shadow-review progress)
-- ============================================================
CREATE TABLE public.reviewer_status (
  user_id uuid PRIMARY KEY,
  calibration_completed_at timestamptz,
  calibration_score real,
  shadow_reviews_completed int NOT NULL DEFAULT 0,
  shadow_reviews_required int NOT NULL DEFAULT 20,
  full_access_granted_at timestamptz,
  full_access_granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reviewer_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User reads own reviewer status"
  ON public.reviewer_status FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage reviewer status"
  ON public.reviewer_status FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_reviewer_status_updated_at
  BEFORE UPDATE ON public.reviewer_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 8. calibration_items (15 items, 80% pass)
-- ============================================================
CREATE TABLE public.calibration_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_text text NOT NULL,
  expected_decision text NOT NULL,
  rationale text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.calibration_items IS
  'Pre-scrubbed seed data for new-reviewer onboarding. Calibration size: 15 items, 80% pass bar.';

ALTER TABLE public.calibration_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Specialists and admins read active calibration items"
  ON public.calibration_items FOR SELECT
  USING (active = true
         AND (public.has_role(auth.uid(), 'specialist')
              OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Admins manage calibration items"
  ON public.calibration_items FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 9. reviewer_calibration_attempts
-- ============================================================
CREATE TABLE public.reviewer_calibration_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  calibration_item_id uuid NOT NULL REFERENCES public.calibration_items(id) ON DELETE CASCADE,
  chosen_decision text NOT NULL,
  correct boolean NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calib_attempts_user ON public.reviewer_calibration_attempts(user_id);

ALTER TABLE public.reviewer_calibration_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User reads own calibration attempts"
  ON public.reviewer_calibration_attempts FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated user inserts own calibration attempts"
  ON public.reviewer_calibration_attempts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

-- ============================================================
-- 10. shadow_review_decisions
-- ============================================================
CREATE TABLE public.shadow_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderation_queue_item_id uuid NOT NULL REFERENCES public.moderation_queue_items(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL,
  trainee_decision jsonb NOT NULL,
  senior_decision jsonb,
  agreement boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.shadow_review_decisions IS
  'TECH DEBT: Ground truth is "any full-access reviewer" for v1. Real signal requires moderator/panel review once peer-governance ships.';

CREATE INDEX idx_shadow_trainee ON public.shadow_review_decisions(trainee_id);
CREATE INDEX idx_shadow_item ON public.shadow_review_decisions(moderation_queue_item_id);

ALTER TABLE public.shadow_review_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainee reads own shadow decisions"
  ON public.shadow_review_decisions FOR SELECT
  USING (trainee_id = auth.uid()
         OR public.has_role(auth.uid(), 'admin')
         OR public.has_role(auth.uid(), 'specialist'));

CREATE POLICY "Authenticated trainee inserts own shadow decisions"
  ON public.shadow_review_decisions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND trainee_id = auth.uid());

CREATE POLICY "Specialists and admins update shadow decisions"
  ON public.shadow_review_decisions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin')
         OR public.has_role(auth.uid(), 'specialist'))
  WITH CHECK (public.has_role(auth.uid(), 'admin')
              OR public.has_role(auth.uid(), 'specialist'));

-- ============================================================
-- 11. phi_reports
-- ============================================================
CREATE TABLE public.phi_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderation_queue_item_id uuid NOT NULL REFERENCES public.moderation_queue_items(id) ON DELETE CASCADE,
  reporter_id uuid,
  reason text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX idx_phi_reports_unresolved ON public.phi_reports(resolved, created_at DESC);

ALTER TABLE public.phi_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporter reads own phi reports"
  ON public.phi_reports FOR SELECT
  USING (reporter_id = auth.uid()
         OR public.has_role(auth.uid(), 'admin')
         OR public.has_role(auth.uid(), 'specialist'));

CREATE POLICY "Authenticated users insert phi reports"
  ON public.phi_reports FOR INSERT
  WITH CHECK (auth.role() = 'authenticated'
              AND (reporter_id = auth.uid() OR reporter_id IS NULL));

CREATE POLICY "Specialists and admins resolve phi reports"
  ON public.phi_reports FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin')
         OR public.has_role(auth.uid(), 'specialist'))
  WITH CHECK (public.has_role(auth.uid(), 'admin')
              OR public.has_role(auth.uid(), 'specialist'));