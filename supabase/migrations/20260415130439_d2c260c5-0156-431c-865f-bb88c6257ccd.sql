
-- Patient profiles for social features
CREATE TABLE public.patient_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  sharing_mode TEXT NOT NULL DEFAULT 'anonymous' CHECK (sharing_mode IN ('named', 'anonymous', 'private')),
  bio TEXT,
  condition_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.patient_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Named profiles visible to authenticated"
  ON public.patient_profiles FOR SELECT
  TO authenticated
  USING (sharing_mode = 'named');

CREATE POLICY "Users can insert own profile"
  ON public.patient_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.patient_profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own profile"
  ON public.patient_profiles FOR DELETE
  USING (user_id = auth.uid());

CREATE TRIGGER update_patient_profiles_updated_at
  BEFORE UPDATE ON public.patient_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Waves table (like Bumble's wave)
CREATE TABLE public.waves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  condition_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  seen_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (from_user_id, to_user_id, condition_id)
);

ALTER TABLE public.waves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own waves"
  ON public.waves FOR SELECT
  TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "Users can send waves"
  ON public.waves FOR INSERT
  TO authenticated
  WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "Users can mark waves seen"
  ON public.waves FOR UPDATE
  TO authenticated
  USING (to_user_id = auth.uid());
