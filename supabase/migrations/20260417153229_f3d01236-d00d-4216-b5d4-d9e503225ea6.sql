-- ============================================================
-- submission_rate_buckets
-- ============================================================
CREATE TABLE public.submission_rate_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_kind text NOT NULL,        -- 'user' | 'ip'
  bucket_key text NOT NULL,         -- user uuid as text, or ip address
  window_start timestamptz NOT NULL,
  window_kind text NOT NULL,        -- 'hour' | 'day'
  count int NOT NULL DEFAULT 0,
  UNIQUE (bucket_kind, bucket_key, window_kind, window_start)
);

CREATE INDEX idx_rate_buckets_lookup ON public.submission_rate_buckets(bucket_kind, bucket_key, window_kind, window_start DESC);

ALTER TABLE public.submission_rate_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages rate buckets"
  ON public.submission_rate_buckets FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users read own rate buckets"
  ON public.submission_rate_buckets FOR SELECT
  USING (
    (bucket_kind = 'user' AND bucket_key = auth.uid()::text)
    OR public.has_role(auth.uid(), 'admin')
  );

-- ============================================================
-- match_reports (user flags a wrong auto-match)
-- ============================================================
CREATE TABLE public.match_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  matched_code_id uuid REFERENCES public.medical_codes(id),
  matched_alias_id uuid REFERENCES public.code_aliases(id),
  redacted_input text NOT NULL,
  reason text,
  resolved boolean NOT NULL DEFAULT false,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_match_reports_unresolved ON public.match_reports(resolved, created_at DESC);

ALTER TABLE public.match_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporter reads own match reports"
  ON public.match_reports FOR SELECT
  USING (reporter_id = auth.uid()
         OR public.has_role(auth.uid(), 'admin')
         OR public.has_role(auth.uid(), 'specialist'));

CREATE POLICY "Authenticated users insert match reports"
  ON public.match_reports FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND reporter_id = auth.uid());

CREATE POLICY "Specialists and admins resolve match reports"
  ON public.match_reports FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin')
         OR public.has_role(auth.uid(), 'specialist'))
  WITH CHECK (public.has_role(auth.uid(), 'admin')
              OR public.has_role(auth.uid(), 'specialist'));

-- ============================================================
-- Helpful index for submit-pending-term upsert key
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pending_redacted_kind
  ON public.pending_code_entries(redacted_text, code_system_hint);