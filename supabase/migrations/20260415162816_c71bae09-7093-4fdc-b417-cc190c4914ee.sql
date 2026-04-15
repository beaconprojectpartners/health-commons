
-- Drop the overly broad policy
DROP POLICY IF EXISTS "Named profiles visible to authenticated" ON public.patient_profiles;

-- Create a security-definer helper to avoid recursive RLS issues
CREATE OR REPLACE FUNCTION public.get_my_condition_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(condition_ids, '{}')
  FROM public.patient_profiles
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- New policy: named profiles visible only if the viewer shares a condition or has a wave relationship
CREATE POLICY "Named profiles visible to peers"
ON public.patient_profiles
FOR SELECT
TO authenticated
USING (
  sharing_mode = 'named'
  AND user_id <> auth.uid()
  AND (
    -- Shares at least one condition with the viewer
    condition_ids && public.get_my_condition_ids(auth.uid())
    -- OR has a wave relationship (either direction)
    OR EXISTS (
      SELECT 1 FROM public.waves w
      WHERE (w.from_user_id = auth.uid() AND w.to_user_id = patient_profiles.user_id)
         OR (w.to_user_id = auth.uid() AND w.from_user_id = patient_profiles.user_id)
    )
  )
);
