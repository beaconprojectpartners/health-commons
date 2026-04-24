-- Allow authenticated users to propose new conditions (pending approval)
CREATE POLICY "Authenticated can propose conditions"
ON public.conditions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by = auth.uid()
  AND approved = false
);