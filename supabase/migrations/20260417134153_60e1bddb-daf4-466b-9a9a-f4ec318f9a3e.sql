-- Validation trigger for submissions to enforce server-side length/format limits
CREATE OR REPLACE FUNCTION public.validate_submission_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  uf jsonb := COALESCE(NEW.universal_fields, '{}'::jsonb);
  df jsonb := COALESCE(NEW.dynamic_fields, '{}'::jsonb);
  symptoms jsonb;
  treatments jsonb;
  item jsonb;
  yod text;
  yod_int int;
  pcount_text text;
  pcount_int int;
BEGIN
  -- Cap overall payload sizes (rough byte estimate via text length)
  IF length(uf::text) > 50000 THEN
    RAISE EXCEPTION 'universal_fields payload too large (max 50KB)';
  END IF;
  IF length(df::text) > 50000 THEN
    RAISE EXCEPTION 'dynamic_fields payload too large (max 50KB)';
  END IF;

  -- sharing_preference allow-list
  IF NEW.sharing_preference IS NOT NULL AND NEW.sharing_preference NOT IN ('anonymized_public','research_only','private') THEN
    RAISE EXCEPTION 'invalid sharing_preference';
  END IF;

  -- diagnosis_status allow-list (when present)
  IF uf ? 'diagnosis_status' AND jsonb_typeof(uf->'diagnosis_status') = 'string'
     AND uf->>'diagnosis_status' NOT IN ('','confirmed','suspected','self-diagnosed','ruled-out') THEN
    RAISE EXCEPTION 'invalid diagnosis_status';
  END IF;

  -- year_of_diagnosis: 1900..current year + 1
  IF uf ? 'year_of_diagnosis' AND COALESCE(uf->>'year_of_diagnosis','') <> '' THEN
    yod := uf->>'year_of_diagnosis';
    IF yod !~ '^\d{4}$' THEN
      RAISE EXCEPTION 'year_of_diagnosis must be a 4-digit year';
    END IF;
    yod_int := yod::int;
    IF yod_int < 1900 OR yod_int > extract(year from now())::int + 1 THEN
      RAISE EXCEPTION 'year_of_diagnosis out of range';
    END IF;
  END IF;

  -- providers_count: 0..1000
  IF uf ? 'providers_count' AND COALESCE(uf->>'providers_count','') <> '' THEN
    pcount_text := uf->>'providers_count';
    IF pcount_text !~ '^\d{1,5}$' THEN
      RAISE EXCEPTION 'providers_count must be a non-negative integer';
    END IF;
    pcount_int := pcount_text::int;
    IF pcount_int < 0 OR pcount_int > 1000 THEN
      RAISE EXCEPTION 'providers_count out of range (0-1000)';
    END IF;
  END IF;

  -- misdiagnoses max 2000 chars
  IF uf ? 'misdiagnoses' AND jsonb_typeof(uf->'misdiagnoses') = 'string'
     AND length(uf->>'misdiagnoses') > 2000 THEN
    RAISE EXCEPTION 'misdiagnoses too long (max 2000 chars)';
  END IF;

  -- symptoms array: max 50 items, each name <= 200 chars
  IF uf ? 'symptoms' AND jsonb_typeof(uf->'symptoms') = 'array' THEN
    symptoms := uf->'symptoms';
    IF jsonb_array_length(symptoms) > 50 THEN
      RAISE EXCEPTION 'too many symptoms (max 50)';
    END IF;
    FOR item IN SELECT * FROM jsonb_array_elements(symptoms) LOOP
      IF item ? 'name' AND length(COALESCE(item->>'name','')) > 200 THEN
        RAISE EXCEPTION 'symptom name too long (max 200 chars)';
      END IF;
    END LOOP;
  END IF;

  -- treatments array: max 50 items, each name <= 200 chars, sideEffects <= 1000 chars
  IF uf ? 'treatments' AND jsonb_typeof(uf->'treatments') = 'array' THEN
    treatments := uf->'treatments';
    IF jsonb_array_length(treatments) > 50 THEN
      RAISE EXCEPTION 'too many treatments (max 50)';
    END IF;
    FOR item IN SELECT * FROM jsonb_array_elements(treatments) LOOP
      IF item ? 'name' AND length(COALESCE(item->>'name','')) > 200 THEN
        RAISE EXCEPTION 'treatment name too long (max 200 chars)';
      END IF;
      IF item ? 'sideEffects' AND length(COALESCE(item->>'sideEffects','')) > 1000 THEN
        RAISE EXCEPTION 'treatment sideEffects too long (max 1000 chars)';
      END IF;
    END LOOP;
  END IF;

  -- demographics.country max 100 chars
  IF uf ? 'demographics' AND jsonb_typeof(uf->'demographics') = 'object'
     AND uf->'demographics' ? 'country'
     AND length(COALESCE(uf->'demographics'->>'country','')) > 100 THEN
    RAISE EXCEPTION 'country too long (max 100 chars)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_submission_fields_trg ON public.submissions;
CREATE TRIGGER validate_submission_fields_trg
BEFORE INSERT OR UPDATE ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.validate_submission_fields();

-- Validation trigger for patient_profiles (bio length)
CREATE OR REPLACE FUNCTION public.validate_patient_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.bio IS NOT NULL AND length(NEW.bio) > 2000 THEN
    RAISE EXCEPTION 'bio too long (max 2000 chars)';
  END IF;
  IF NEW.display_name IS NOT NULL AND length(NEW.display_name) > 100 THEN
    RAISE EXCEPTION 'display_name too long (max 100 chars)';
  END IF;
  IF NEW.sharing_mode NOT IN ('anonymous','named','private') THEN
    RAISE EXCEPTION 'invalid sharing_mode';
  END IF;
  IF NEW.condition_ids IS NOT NULL AND array_length(NEW.condition_ids, 1) > 50 THEN
    RAISE EXCEPTION 'too many conditions (max 50)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_patient_profile_trg ON public.patient_profiles;
CREATE TRIGGER validate_patient_profile_trg
BEFORE INSERT OR UPDATE ON public.patient_profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_patient_profile();