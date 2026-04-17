-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Enums
DO $$ BEGIN
  CREATE TYPE public.medical_code_kind AS ENUM ('diagnosis','symptom','procedure','medication','finding');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.code_alias_status AS ENUM ('approved','pending','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pending_code_status AS ENUM ('pending','mapped','new_code_created','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.code_mapping_relation AS ENUM ('equivalent','broader','narrower','related');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- code_systems registry
CREATE TABLE public.code_systems (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  current_version text NOT NULL,
  url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.code_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Code systems readable by all"
  ON public.code_systems FOR SELECT USING (true);

CREATE POLICY "Admins manage code systems"
  ON public.code_systems FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_code_systems_updated
  BEFORE UPDATE ON public.code_systems
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed registry
INSERT INTO public.code_systems (id, name, description, current_version, url) VALUES
  ('ICD-10-CM',  'ICD-10 Clinical Modification', 'US diagnosis & symptom codes (incl. Ch.18 signs/symptoms)', '2025', 'https://www.cms.gov/medicare/coding-billing/icd-10-codes'),
  ('ICD-10-PCS', 'ICD-10 Procedure Coding System', 'US inpatient procedure codes', '2025', 'https://www.cms.gov/medicare/coding-billing/icd-10-codes'),
  ('ORPHA',      'Orphanet rare-disease nomenclature', 'Rare-disease codes layered where ICD is too coarse', '2024', 'https://www.orphadata.com/'),
  ('RxNorm',     'RxNorm', 'US standardized drug nomenclature (RXCUI)', '2025-01', 'https://www.nlm.nih.gov/research/umls/rxnorm/'),
  ('ICD-11-MMS', 'ICD-11 MMS (placeholder)', 'Reserved for future ICD-11 swap; not loaded', 'unloaded', 'https://icd.who.int/');

-- specialist_scopes
CREATE TABLE public.specialist_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  specialty text NOT NULL,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, specialty)
);

ALTER TABLE public.specialist_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own specialist scopes"
  ON public.specialist_scopes FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage specialist scopes"
  ON public.specialist_scopes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- has_specialty helper
CREATE OR REPLACE FUNCTION public.has_specialty(_user_id uuid, _specialty text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.specialist_scopes
    WHERE user_id = _user_id AND specialty = _specialty
  );
$$;

-- medical_codes
CREATE TABLE public.medical_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_system text NOT NULL REFERENCES public.code_systems(id),
  code_system_version text NOT NULL,
  code text NOT NULL,
  display text NOT NULL,
  kind public.medical_code_kind NOT NULL,
  specialty_scope text[] NOT NULL DEFAULT '{}',
  parent_code_id uuid REFERENCES public.medical_codes(id),
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code_system, code_system_version, code)
);

CREATE INDEX idx_medical_codes_system_kind ON public.medical_codes (code_system, kind) WHERE retired_at IS NULL;
CREATE INDEX idx_medical_codes_parent ON public.medical_codes (parent_code_id);
CREATE INDEX idx_medical_codes_specialty ON public.medical_codes USING GIN (specialty_scope);
CREATE INDEX idx_medical_codes_embedding ON public.medical_codes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.medical_codes ENABLE ROW LEVEL SECURITY;

-- scope helper (after table exists)
CREATE OR REPLACE FUNCTION public.code_in_user_scope(_code_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.medical_codes mc
      WHERE mc.id = _code_id
        AND (
          cardinality(mc.specialty_scope) = 0
          OR EXISTS (
            SELECT 1 FROM public.specialist_scopes ss
            WHERE ss.user_id = _user_id
              AND ss.specialty = ANY (mc.specialty_scope)
          )
        )
    );
$$;

CREATE POLICY "Medical codes readable by all"
  ON public.medical_codes FOR SELECT USING (true);

CREATE POLICY "Admins insert medical codes"
  ON public.medical_codes FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update medical codes"
  ON public.medical_codes FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- code_aliases
CREATE TABLE public.code_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medical_code_id uuid NOT NULL REFERENCES public.medical_codes(id) ON DELETE CASCADE,
  label text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  embedding vector(1536),
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  status public.code_alias_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medical_code_id, locale, label)
);

CREATE INDEX idx_code_aliases_code ON public.code_aliases (medical_code_id);
CREATE INDEX idx_code_aliases_status ON public.code_aliases (status);
CREATE INDEX idx_code_aliases_embedding ON public.code_aliases USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.code_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved aliases readable by all"
  ON public.code_aliases FOR SELECT
  USING (status = 'approved' OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'specialist'));

CREATE POLICY "Specialists in scope can propose aliases"
  ON public.code_aliases FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (public.has_role(auth.uid(), 'specialist') AND public.code_in_user_scope(medical_code_id, auth.uid()))
    )
  );

CREATE POLICY "Specialists in scope can update aliases"
  ON public.code_aliases FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'specialist') AND public.code_in_user_scope(medical_code_id, auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'specialist') AND public.code_in_user_scope(medical_code_id, auth.uid()))
  );

CREATE TRIGGER trg_code_aliases_updated
  BEFORE UPDATE ON public.code_aliases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- pending_code_entries
CREATE TABLE public.pending_code_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_text text NOT NULL,
  code_system_hint text REFERENCES public.code_systems(id),
  submission_id uuid REFERENCES public.submissions(id) ON DELETE SET NULL,
  submitter_id uuid,
  candidate_code_id uuid REFERENCES public.medical_codes(id) ON DELETE SET NULL,
  candidate_score real,
  status public.pending_code_status NOT NULL DEFAULT 'pending',
  resolved_alias_id uuid REFERENCES public.code_aliases(id) ON DELETE SET NULL,
  resolved_code_id uuid REFERENCES public.medical_codes(id) ON DELETE SET NULL,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_code_status ON public.pending_code_entries (status);
CREATE INDEX idx_pending_code_submitter ON public.pending_code_entries (submitter_id);

ALTER TABLE public.pending_code_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submitters read own pending entries"
  ON public.pending_code_entries FOR SELECT
  USING (
    submitter_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'specialist')
  );

CREATE POLICY "Anyone authed or anon can submit pending entries"
  ON public.pending_code_entries FOR INSERT
  WITH CHECK (
    (auth.role() = 'anon' AND submitter_id IS NULL)
    OR (auth.role() = 'authenticated' AND (submitter_id = auth.uid() OR submitter_id IS NULL))
  );

CREATE POLICY "Specialists and admins resolve pending entries"
  ON public.pending_code_entries FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'specialist'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'specialist'));

CREATE TRIGGER trg_pending_code_updated
  BEFORE UPDATE ON public.pending_code_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- code_mappings (cross-system / cross-version)
CREATE TABLE public.code_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_code_id uuid NOT NULL REFERENCES public.medical_codes(id) ON DELETE CASCADE,
  to_code_id uuid NOT NULL REFERENCES public.medical_codes(id) ON DELETE CASCADE,
  relation public.code_mapping_relation NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_code_id, to_code_id, relation)
);

CREATE INDEX idx_code_mappings_from ON public.code_mappings (from_code_id);
CREATE INDEX idx_code_mappings_to ON public.code_mappings (to_code_id);

ALTER TABLE public.code_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Code mappings readable by all"
  ON public.code_mappings FOR SELECT USING (true);

CREATE POLICY "Admins manage code mappings"
  ON public.code_mappings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));