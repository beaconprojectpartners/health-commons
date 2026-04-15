-- Fix 1: Replace overly permissive PII insert policy with ownership check
DROP POLICY IF EXISTS "Anon and auth can insert PII" ON public.submission_pii;

CREATE POLICY "Submitter can insert PII" ON public.submission_pii
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_id
      AND (
        (auth.role() = 'authenticated' AND s.submitter_account_id = auth.uid())
      )
    )
  );

-- Fix 2: Allow anyone to read anonymized submissions (conditions, symptoms, treatments)
DROP POLICY IF EXISTS "Researchers can read submissions" ON public.submissions;

CREATE POLICY "Anyone can read anonymized submissions" ON public.submissions
  FOR SELECT USING (true);