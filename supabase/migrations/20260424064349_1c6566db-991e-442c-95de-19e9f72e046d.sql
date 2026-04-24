
-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.specialist_application_status AS ENUM (
  'draft','pending','in_review','approved','rejected','needs_info','withdrawn'
);

CREATE TYPE public.vetting_vote AS ENUM ('approve','reject','needs_info');

CREATE TYPE public.specialist_tier AS ENUM ('contributing','core','moderator');

CREATE TYPE public.governance_scope_type AS ENUM ('specialty','cluster');

CREATE TYPE public.election_status AS ENUM ('upcoming','open','closed','certified','cancelled');

CREATE TYPE public.recall_status AS ENUM ('initiated','open','passed','failed','cancelled');

CREATE TYPE public.jury_status AS ENUM ('forming','deliberating','decided','closed');

CREATE TYPE public.jury_decision_type AS ENUM ('contested_edit','application_appeal','moderator_action_challenge');

-- =========================================================================
-- SPECIALIST APPLICATIONS
-- =========================================================================
CREATE TABLE public.specialist_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  npi text,
  full_name text,
  institutional_email text,
  email_verification_token text,
  email_verified_at timestamptz,
  document_url text,
  primary_taxonomy text,
  primary_taxonomy_display text,
  secondary_taxonomies jsonb NOT NULL DEFAULT '[]'::jsonb,
  nppes_payload jsonb,
  status public.specialist_application_status NOT NULL DEFAULT 'draft',
  decision_notes text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_spec_app_user ON public.specialist_applications(user_id);
CREATE INDEX idx_spec_app_status ON public.specialist_applications(status);

ALTER TABLE public.specialist_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicant reads own application"
ON public.specialist_applications FOR SELECT
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Applicant inserts own application"
ON public.specialist_applications FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Applicant or admin updates application"
ON public.specialist_applications FOR UPDATE
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- =========================================================================
-- VETTING PANELS
-- =========================================================================
CREATE TABLE public.vetting_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.specialist_applications(id) ON DELETE CASCADE,
  sla_due_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  closed_at timestamptz,
  outcome public.vetting_vote,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_panel_app ON public.vetting_panels(application_id);

CREATE TABLE public.vetting_panel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id uuid NOT NULL REFERENCES public.vetting_panels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'panelist',
  invited_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(panel_id, user_id)
);
CREATE INDEX idx_panel_member_user ON public.vetting_panel_members(user_id);

CREATE TABLE public.vetting_panel_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id uuid NOT NULL REFERENCES public.vetting_panels(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL,
  vote public.vetting_vote NOT NULL,
  reasoning text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(panel_id, voter_id)
);
CREATE INDEX idx_panel_vote_panel ON public.vetting_panel_votes(panel_id);

ALTER TABLE public.vetting_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vetting_panel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vetting_panel_votes ENABLE ROW LEVEL SECURITY;

-- helper: is user on panel
CREATE OR REPLACE FUNCTION public.is_panel_member(_panel_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.vetting_panel_members WHERE panel_id = _panel_id AND user_id = _user_id);
$$;

CREATE POLICY "Panelists and admins read panels"
ON public.vetting_panels FOR SELECT
USING (public.has_role(auth.uid(),'admin') OR public.is_panel_member(id, auth.uid())
       OR EXISTS(SELECT 1 FROM public.specialist_applications a WHERE a.id = application_id AND a.user_id = auth.uid()));

CREATE POLICY "Admins manage panels"
ON public.vetting_panels FOR ALL
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Panelists and admins read members"
ON public.vetting_panel_members FOR SELECT
USING (public.has_role(auth.uid(),'admin') OR user_id = auth.uid()
       OR public.is_panel_member(panel_id, auth.uid()));

CREATE POLICY "Admins manage panel members"
ON public.vetting_panel_members FOR ALL
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Panelists and admins read votes"
ON public.vetting_panel_votes FOR SELECT
USING (public.has_role(auth.uid(),'admin') OR public.is_panel_member(panel_id, auth.uid()));

CREATE POLICY "Panelist inserts own vote"
ON public.vetting_panel_votes FOR INSERT
WITH CHECK (voter_id = auth.uid() AND public.is_panel_member(panel_id, auth.uid()));

CREATE POLICY "Admins update votes"
ON public.vetting_panel_votes FOR UPDATE
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================================
-- SPECIALTY CLUSTERS
-- =========================================================================
CREATE TABLE public.specialty_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  terminology_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cluster_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cluster_id uuid NOT NULL REFERENCES public.specialty_clusters(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, cluster_id)
);

CREATE TABLE public.cluster_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  scope text,
  supporters uuid[] NOT NULL DEFAULT '{}'::uuid[],
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.specialty_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cluster_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cluster_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clusters readable by all" ON public.specialty_clusters FOR SELECT USING (true);
CREATE POLICY "Admins manage clusters" ON public.specialty_clusters FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Memberships readable by all signed in" ON public.cluster_memberships FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Users add own membership" ON public.cluster_memberships FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(),'specialist'));
CREATE POLICY "Users remove own membership" ON public.cluster_memberships FOR DELETE
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Proposals readable by signed in" ON public.cluster_proposals FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Specialists propose clusters" ON public.cluster_proposals FOR INSERT
  WITH CHECK (proposer_id = auth.uid() AND (public.has_role(auth.uid(),'specialist') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "Admins manage proposals" ON public.cluster_proposals FOR UPDATE
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================================
-- SPECIALIST TIERS (per scope)
-- =========================================================================
CREATE TABLE public.specialist_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scope_type public.governance_scope_type NOT NULL,
  scope_id text NOT NULL, -- specialty taxonomy code OR cluster uuid as text
  tier public.specialist_tier NOT NULL DEFAULT 'contributing',
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid,
  granted_reason text,
  revoked_at timestamptz,
  UNIQUE(user_id, scope_type, scope_id)
);
CREATE INDEX idx_spec_tier_user ON public.specialist_tiers(user_id);

ALTER TABLE public.specialist_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tiers readable by signed-in (transparency)" ON public.specialist_tiers FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Admins manage tiers" ON public.specialist_tiers FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- helper: max tier for a user/scope
CREATE OR REPLACE FUNCTION public.user_tier_in_scope(_user_id uuid, _scope_type public.governance_scope_type, _scope_id text)
RETURNS public.specialist_tier LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tier FROM public.specialist_tiers
  WHERE user_id = _user_id AND scope_type = _scope_type AND scope_id = _scope_id AND revoked_at IS NULL
  ORDER BY CASE tier WHEN 'moderator' THEN 3 WHEN 'core' THEN 2 ELSE 1 END DESC
  LIMIT 1;
$$;

-- =========================================================================
-- ELECTIONS / SEATS / RECALLS
-- =========================================================================
CREATE TABLE public.moderator_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type public.governance_scope_type NOT NULL,
  scope_id text NOT NULL,
  seat_number int NOT NULL DEFAULT 1,
  holder_id uuid,
  term_start timestamptz,
  term_end timestamptz,
  consecutive_terms int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.elections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type public.governance_scope_type NOT NULL,
  scope_id text NOT NULL,
  seat_id uuid REFERENCES public.moderator_seats(id) ON DELETE SET NULL,
  status public.election_status NOT NULL DEFAULT 'upcoming',
  nominations_open_at timestamptz,
  voting_open_at timestamptz,
  voting_close_at timestamptz,
  min_turnout_pct int NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.election_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL,
  statement text,
  nominated_by uuid,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(election_id, candidate_id)
);

CREATE TABLE public.election_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id uuid NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  weight numeric(4,2) NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(election_id, voter_id)
);

CREATE TABLE public.recalls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id uuid NOT NULL REFERENCES public.moderator_seats(id) ON DELETE CASCADE,
  initiator_id uuid NOT NULL,
  reason text NOT NULL,
  status public.recall_status NOT NULL DEFAULT 'initiated',
  initiated_at timestamptz NOT NULL DEFAULT now(),
  voting_close_at timestamptz,
  decided_at timestamptz
);

CREATE TABLE public.recall_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recall_id uuid NOT NULL REFERENCES public.recalls(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL,
  vote boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(recall_id, voter_id)
);

ALTER TABLE public.moderator_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recall_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seats readable by signed in" ON public.moderator_seats FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins manage seats" ON public.moderator_seats FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Elections readable by signed in" ON public.elections FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins manage elections" ON public.elections FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Candidates readable by signed in" ON public.election_candidates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Specialists nominate" ON public.election_candidates FOR INSERT
  WITH CHECK ((candidate_id = auth.uid() OR nominated_by = auth.uid()) AND public.has_role(auth.uid(),'specialist'));
CREATE POLICY "Candidate withdraws or admin manages" ON public.election_candidates FOR UPDATE
  USING (candidate_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (candidate_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Voter reads own vote, admin reads all" ON public.election_votes FOR SELECT
  USING (voter_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Specialists vote" ON public.election_votes FOR INSERT
  WITH CHECK (voter_id = auth.uid() AND public.has_role(auth.uid(),'specialist'));

CREATE POLICY "Recalls readable by signed in" ON public.recalls FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Specialists initiate recall" ON public.recalls FOR INSERT
  WITH CHECK (initiator_id = auth.uid() AND public.has_role(auth.uid(),'specialist'));
CREATE POLICY "Admins manage recalls" ON public.recalls FOR UPDATE
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Voter reads own recall vote, admin all" ON public.recall_votes FOR SELECT
  USING (voter_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Specialists vote on recall" ON public.recall_votes FOR INSERT
  WITH CHECK (voter_id = auth.uid() AND public.has_role(auth.uid(),'specialist'));

-- =========================================================================
-- JURIES
-- =========================================================================
CREATE TABLE public.juries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_type public.jury_decision_type NOT NULL,
  subject_ref text NOT NULL,
  subject_summary text,
  status public.jury_status NOT NULL DEFAULT 'forming',
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE TABLE public.jury_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jury_id uuid NOT NULL REFERENCES public.juries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(jury_id, user_id)
);

CREATE TABLE public.jury_deliberations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jury_id uuid NOT NULL REFERENCES public.juries(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.jury_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jury_id uuid NOT NULL REFERENCES public.juries(id) ON DELETE CASCADE,
  outcome text NOT NULL,
  reasoning text NOT NULL,
  decided_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.juries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jury_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jury_deliberations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jury_decisions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_jury_member(_jury_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.jury_members WHERE jury_id = _jury_id AND user_id = _user_id);
$$;

CREATE POLICY "Juries readable by signed in" ON public.juries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins manage juries" ON public.juries FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Members and admins read jury members" ON public.jury_members FOR SELECT
  USING (public.has_role(auth.uid(),'admin') OR user_id = auth.uid() OR public.is_jury_member(jury_id, auth.uid()));
CREATE POLICY "Admins manage jury members" ON public.jury_members FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Jury members and admins read deliberations" ON public.jury_deliberations FOR SELECT
  USING (public.has_role(auth.uid(),'admin') OR public.is_jury_member(jury_id, auth.uid())
         OR EXISTS(SELECT 1 FROM public.juries j WHERE j.id = jury_id AND j.status IN ('decided','closed')));
CREATE POLICY "Jury members post deliberations" ON public.jury_deliberations FOR INSERT
  WITH CHECK (author_id = auth.uid() AND public.is_jury_member(jury_id, auth.uid()));

CREATE POLICY "Decisions readable by signed in (post-decision)" ON public.jury_decisions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Jury members or admin record decision" ON public.jury_decisions FOR INSERT
  WITH CHECK (decided_by = auth.uid() AND (public.is_jury_member(jury_id, auth.uid()) OR public.has_role(auth.uid(),'admin')));

-- =========================================================================
-- VOCABULARY EDIT LOG (immutable, public to signed in)
-- =========================================================================
CREATE TABLE public.vocabulary_edit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  target_type text NOT NULL, -- medical_code | code_alias | disease_profile | condition
  target_id uuid,
  action text NOT NULL,      -- create | update | retire | approve | reject
  scope_type public.governance_scope_type,
  scope_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  effective_at timestamptz NOT NULL DEFAULT now(),
  high_impact boolean NOT NULL DEFAULT false,
  review_window_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vocab_log_target ON public.vocabulary_edit_log(target_type, target_id);
CREATE INDEX idx_vocab_log_created ON public.vocabulary_edit_log(created_at DESC);

ALTER TABLE public.vocabulary_edit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vocab log readable by signed in" ON public.vocabulary_edit_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Specialists or admins or service insert vocab log" ON public.vocabulary_edit_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'specialist'));

-- =========================================================================
-- NPI RE-VERIFICATION LOG
-- =========================================================================
CREATE TABLE public.npi_reverification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  npi text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  taxonomy_drift boolean NOT NULL DEFAULT false,
  payload jsonb
);
ALTER TABLE public.npi_reverification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User reads own NPI re-verify, admin all" ON public.npi_reverification_log FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Service or admin inserts re-verify" ON public.npi_reverification_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR public.has_role(auth.uid(),'admin'));

-- =========================================================================
-- EMERGENCY ACTION LOG (public for post-hoc review)
-- =========================================================================
CREATE TABLE public.emergency_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  action text NOT NULL,
  reason text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.emergency_action_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Emergency log readable by signed in" ON public.emergency_action_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin or moderator inserts emergency log" ON public.emergency_action_log FOR INSERT
  WITH CHECK (actor_id = auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'specialist')));

-- =========================================================================
-- GOVERNANCE PHASE (single row)
-- =========================================================================
CREATE TABLE public.governance_phase (
  id int PRIMARY KEY DEFAULT 1,
  phase int NOT NULL DEFAULT 0,
  trigger_description text NOT NULL DEFAULT 'Phase 2 begins when ~50 active specialists are vetted across at least 5 disease/specialty clusters.',
  commitment text NOT NULL DEFAULT 'Founder authority dissolves into elected moderator seats at Phase 2. This commitment is public and the trigger will not be moved.',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT only_one_row CHECK (id = 1)
);
INSERT INTO public.governance_phase (id) VALUES (1);

ALTER TABLE public.governance_phase ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Phase readable by all" ON public.governance_phase FOR SELECT USING (true);
CREATE POLICY "Admins manage phase" ON public.governance_phase FOR UPDATE
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================================
-- TIMESTAMP TRIGGERS
-- =========================================================================
CREATE TRIGGER trg_spec_app_updated BEFORE UPDATE ON public.specialist_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_clusters_updated BEFORE UPDATE ON public.specialty_clusters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- SEED CLUSTERS
-- =========================================================================
INSERT INTO public.specialty_clusters (slug, name, description) VALUES
  ('complex-chronic','Complex chronic / multi-system','MCAS, EDS, POTS, fibromyalgia, ME/CFS and overlapping multi-system conditions'),
  ('long-covid','Long COVID / post-viral','Post-acute sequelae of COVID-19 and other post-viral syndromes'),
  ('pediatric-rare','Pediatric rare disease','Rare conditions presenting in childhood'),
  ('chronic-pain','Chronic pain','Chronic pain syndromes across specialty boundaries'),
  ('mental-health','Mental health / psychiatric','Psychiatric and mental-health conditions');
