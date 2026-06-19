
-- Lock down api_key column on researchers: only service_role may modify
REVOKE UPDATE (api_key) ON public.researchers FROM authenticated;
REVOKE INSERT (api_key) ON public.researchers FROM authenticated;

-- Restrictive policy: only admins can insert into user_roles, regardless of any other policy
CREATE POLICY "Only admins can self-insert roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Only admins can update roles"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
