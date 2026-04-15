
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'specialist', 'researcher');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Conditions registry
CREATE TABLE public.conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icd10_code TEXT,
  slug TEXT NOT NULL UNIQUE,
  submission_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Conditions readable by all" ON public.conditions FOR SELECT USING (true);
CREATE POLICY "Specialists can insert conditions" ON public.conditions
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'specialist') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update conditions" ON public.conditions
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Disease profiles
CREATE TABLE public.disease_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_id UUID REFERENCES public.conditions(id) ON DELETE CASCADE NOT NULL,
  version INTEGER DEFAULT 1,
  labs JSONB DEFAULT '[]',
  imaging JSONB DEFAULT '[]',
  criteria JSONB DEFAULT '[]',
  scoring_tools JSONB DEFAULT '[]',
  contributor TEXT,
  contributor_id UUID REFERENCES auth.users(id),
  citation TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.disease_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved profiles readable by all" ON public.disease_profiles
  FOR SELECT USING (status = 'approved' OR public.has_role(auth.uid(), 'admin') OR contributor_id = auth.uid());
CREATE POLICY "Specialists can insert profiles" ON public.disease_profiles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'specialist') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update profiles" ON public.disease_profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR contributor_id = auth.uid());

-- Submissions (anonymous, UUID-based)
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_id UUID REFERENCES public.conditions(id) NOT NULL,
  profile_version_id UUID REFERENCES public.disease_profiles(id),
  universal_fields JSONB NOT NULL DEFAULT '{}',
  dynamic_fields JSONB DEFAULT '{}',
  sharing_preference TEXT DEFAULT 'anonymized_public' CHECK (sharing_preference IN ('fully_public', 'anonymized_public', 'research_only')),
  submitter_account_id UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create submissions" ON public.submissions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Researchers can read submissions" ON public.submissions
  FOR SELECT USING (
    public.has_role(auth.uid(), 'researcher') OR
    public.has_role(auth.uid(), 'admin') OR
    submitter_account_id = auth.uid()
  );
CREATE POLICY "Submitters can update own" ON public.submissions
  FOR UPDATE USING (submitter_account_id = auth.uid());

-- PII table (separate, deletable)
CREATE TABLE public.submission_pii (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.submission_pii ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can read PII" ON public.submission_pii
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can insert PII" ON public.submission_pii
  FOR INSERT WITH CHECK (true);

-- Researchers
CREATE TABLE public.researchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  institution TEXT,
  research_focus TEXT,
  intended_use TEXT,
  orcid TEXT,
  api_key UUID DEFAULT gen_random_uuid(),
  agreed_terms_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
ALTER TABLE public.researchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Researchers can read own profile" ON public.researchers
  FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Researchers can insert own" ON public.researchers
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Researchers can update own" ON public.researchers
  FOR UPDATE USING (user_id = auth.uid());

-- Download log
CREATE TABLE public.download_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  researcher_id UUID REFERENCES public.researchers(id) ON DELETE CASCADE NOT NULL,
  condition_filter TEXT,
  export_format TEXT CHECK (export_format IN ('csv', 'json')),
  row_count INTEGER,
  exported_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.download_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Researchers can see own downloads" ON public.download_log
  FOR SELECT USING (
    researcher_id IN (SELECT id FROM public.researchers WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "System can insert downloads" ON public.download_log
  FOR INSERT WITH CHECK (
    researcher_id IN (SELECT id FROM public.researchers WHERE user_id = auth.uid())
  );

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_conditions_updated_at BEFORE UPDATE ON public.conditions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_disease_profiles_updated_at BEFORE UPDATE ON public.disease_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Increment submission count trigger
CREATE OR REPLACE FUNCTION public.increment_submission_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conditions SET submission_count = submission_count + 1 WHERE id = NEW.condition_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_submission_increment AFTER INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.increment_submission_count();

-- Indexes
CREATE INDEX idx_submissions_condition ON public.submissions(condition_id);
CREATE INDEX idx_submissions_submitted_at ON public.submissions(submitted_at);
CREATE INDEX idx_conditions_slug ON public.conditions(slug);
CREATE INDEX idx_disease_profiles_condition ON public.disease_profiles(condition_id);
