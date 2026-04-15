-- Add contact consent to patient_profiles
ALTER TABLE public.patient_profiles
ADD COLUMN contact_consent boolean NOT NULL DEFAULT false;

-- Create messages table
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text NOT NULL,
  wave_id uuid REFERENCES public.waves(id) ON DELETE SET NULL,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can read messages they sent or received
CREATE POLICY "Users can read own messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- Users can send messages only to people who have contact_consent=true or mutual wave exists
CREATE POLICY "Users can send messages to consenting users"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      -- Receiver has contact consent enabled
      EXISTS (
        SELECT 1 FROM public.patient_profiles pp
        WHERE pp.user_id = receiver_id AND pp.contact_consent = true
      )
      OR
      -- Mutual wave exists (either direction)
      EXISTS (
        SELECT 1 FROM public.waves w
        WHERE (w.from_user_id = auth.uid() AND w.to_user_id = receiver_id)
           OR (w.from_user_id = receiver_id AND w.to_user_id = auth.uid())
      )
    )
  );

-- Users can mark messages as read
CREATE POLICY "Users can mark messages read"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (receiver_id = auth.uid());

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;