
-- Drop overly permissive policies
DROP POLICY "Anyone can create submissions" ON public.submissions;
DROP POLICY "Anyone can insert PII" ON public.submission_pii;

-- Re-create with role-based checks (anon and authenticated can both insert)
CREATE POLICY "Anon and auth can create submissions" ON public.submissions
  FOR INSERT WITH CHECK (
    (auth.role() = 'anon' AND submitter_account_id IS NULL) OR
    (auth.role() = 'authenticated' AND (submitter_account_id = auth.uid() OR submitter_account_id IS NULL))
  );

CREATE POLICY "Anon and auth can insert PII" ON public.submission_pii
  FOR INSERT WITH CHECK (
    auth.role() IN ('anon', 'authenticated')
  );
