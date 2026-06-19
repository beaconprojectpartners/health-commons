
-- 1) Legal documents: editable JSON content for terms/privacy/dua/conduct
CREATE TABLE public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  version text NOT NULL DEFAULT '1.0',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.legal_documents TO anon, authenticated;
GRANT ALL ON public.legal_documents TO service_role;

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read legal documents"
  ON public.legal_documents FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage legal documents"
  ON public.legal_documents FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_legal_documents_updated_at
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Consent log: timestamped acceptance of legal docs
CREATE TABLE public.consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_slug text NOT NULL,
  doc_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  context text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX consent_log_user_idx ON public.consent_log(user_id);

GRANT SELECT, INSERT ON public.consent_log TO authenticated;
GRANT ALL ON public.consent_log TO service_role;

ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own consents"
  ON public.consent_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can record their own consents"
  ON public.consent_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3) Seed initial legal documents (placeholders, edit anytime via /admin or DB)
INSERT INTO public.legal_documents (slug, title, version, content) VALUES
('terms', 'Terms of Service', '1.0', jsonb_build_object(
  'updated', 'June 2026',
  'sections', jsonb_build_array(
    jsonb_build_object('heading', 'Acceptance of Terms', 'body', 'By using DxCommons you agree to these Terms. If you do not agree, do not use the service.'),
    jsonb_build_object('heading', 'Eligibility', 'body', 'You must be 18 or older, or have a guardian submit on your behalf. Specialists must be licensed clinicians.'),
    jsonb_build_object('heading', 'Acceptable Use', 'body', 'No PHI of others. No re-identification attempts. No commercial resale of data. No harassment.'),
    jsonb_build_object('heading', 'No Medical Advice', 'body', 'DxCommons is research infrastructure, not a medical service. Nothing here is medical advice or a substitute for clinical care.'),
    jsonb_build_object('heading', 'Account Termination', 'body', 'We may suspend accounts that violate these terms. You may delete your account at any time from your profile.'),
    jsonb_build_object('heading', 'Disclaimers', 'body', 'Service is provided as-is, without warranty. Liability is limited to the maximum extent permitted by law.'),
    jsonb_build_object('heading', 'Governing Law', 'body', 'These Terms are governed by the laws of the jurisdiction where DxCommons is operated.')
  )
)),
('privacy', 'Privacy Policy', '1.0', jsonb_build_object(
  'updated', 'June 2026',
  'sections', jsonb_build_array(
    jsonb_build_object('heading', 'Data We Collect', 'body', 'Account info, submissions you choose to share, and minimal logs needed to operate the service.'),
    jsonb_build_object('heading', 'How We Use It', 'body', 'To run the service, to power research access under sharing settings you control, and to maintain safety.'),
    jsonb_build_object('heading', 'Sharing Modes', 'body', 'Private (only you), Anonymous (de-identified aggregates), or Named (your chosen display name).'),
    jsonb_build_object('heading', 'PHI Scrubbing', 'body', 'Free-text submissions are screened for PHI before storage; high-risk PHI is blocked until redacted.'),
    jsonb_build_object('heading', 'Your Rights', 'body', 'You may export, correct, or delete your data from your profile. Account deletion cascades to all your submissions.'),
    jsonb_build_object('heading', 'Subprocessors', 'body', 'Lovable Cloud (database, auth, storage, edge functions), Stripe (researcher billing), AWS Comprehend Medical (PHI detection).'),
    jsonb_build_object('heading', 'Contact', 'body', 'privacy@dxcommons.com')
  )
)),
('dua', 'Data Use Agreement (Researchers)', '1.0', jsonb_build_object(
  'updated', 'June 2026',
  'sections', jsonb_build_array(
    jsonb_build_object('heading', 'Purpose', 'body', 'Access is granted solely for non-commercial research and analysis.'),
    jsonb_build_object('heading', 'No Re-identification', 'body', 'You will not attempt to re-identify any patient, link records across datasets to a named person, or contact patients without consent.'),
    jsonb_build_object('heading', 'No Resale', 'body', 'You will not resell, sublicense, or redistribute the dataset or API output as a product.'),
    jsonb_build_object('heading', 'Citation', 'body', 'Publications must cite DxCommons and reference the dataset version used.'),
    jsonb_build_object('heading', 'Security', 'body', 'You will store downloads on access-controlled systems and delete them when the project ends.'),
    jsonb_build_object('heading', 'Revocation', 'body', 'Access may be revoked for any violation; remaining copies must be destroyed.')
  )
)),
('conduct', 'Specialist Code of Conduct', '1.0', jsonb_build_object(
  'updated', 'June 2026',
  'sections', jsonb_build_array(
    jsonb_build_object('heading', 'Scope Discipline', 'body', 'Vote and edit only within your verified specialty or declared cluster, except as Moderator.'),
    jsonb_build_object('heading', 'Evidence-Based Edits', 'body', 'Cite sources for vocabulary changes when reasonably available; flag disputed terminology.'),
    jsonb_build_object('heading', 'Confidentiality', 'body', 'Panel deliberations are visible to other panelists and admins; do not share applicant materials externally.'),
    jsonb_build_object('heading', 'Conflicts of Interest', 'body', 'Disclose financial or personal conflicts before voting.'),
    jsonb_build_object('heading', 'No Harassment', 'body', 'Civility is required. Harassment results in immediate removal and recall vote.')
  )
));
