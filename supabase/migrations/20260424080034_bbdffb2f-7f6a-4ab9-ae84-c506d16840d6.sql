
CREATE TABLE public.researcher_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  condition_id uuid REFERENCES public.conditions(id) ON DELETE SET NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.researcher_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Researchers read own favorites"
  ON public.researcher_favorites FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Researchers insert own favorites"
  ON public.researcher_favorites FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.researchers r WHERE r.user_id = auth.uid())
  );

CREATE POLICY "Researchers delete own favorites"
  ON public.researcher_favorites FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX researcher_favorites_user_id_idx ON public.researcher_favorites(user_id);
