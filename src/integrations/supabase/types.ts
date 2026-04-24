export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_usage: {
        Row: {
          billed: boolean | null
          called_at: string
          endpoint: string
          id: string
          researcher_id: string
          response_rows: number | null
        }
        Insert: {
          billed?: boolean | null
          called_at?: string
          endpoint: string
          id?: string
          researcher_id: string
          response_rows?: number | null
        }
        Update: {
          billed?: boolean | null
          called_at?: string
          endpoint?: string
          id?: string
          researcher_id?: string
          response_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "researchers"
            referencedColumns: ["id"]
          },
        ]
      }
      calibration_items: {
        Row: {
          active: boolean
          created_at: string
          display_text: string
          expected_decision: string
          id: string
          rationale: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_text: string
          expected_decision: string
          id?: string
          rationale?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          display_text?: string
          expected_decision?: string
          id?: string
          rationale?: string | null
        }
        Relationships: []
      }
      cluster_memberships: {
        Row: {
          cluster_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          cluster_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          cluster_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cluster_memberships_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "specialty_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      cluster_proposals: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          proposer_id: string
          scope: string | null
          status: string
          supporters: string[]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          proposer_id: string
          scope?: string | null
          status?: string
          supporters?: string[]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          proposer_id?: string
          scope?: string | null
          status?: string
          supporters?: string[]
        }
        Relationships: []
      }
      code_aliases: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          embedding: string | null
          id: string
          label: string
          locale: string
          medical_code_id: string
          status: Database["public"]["Enums"]["code_alias_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          embedding?: string | null
          id?: string
          label: string
          locale?: string
          medical_code_id: string
          status?: Database["public"]["Enums"]["code_alias_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          embedding?: string | null
          id?: string
          label?: string
          locale?: string
          medical_code_id?: string
          status?: Database["public"]["Enums"]["code_alias_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_aliases_medical_code_id_fkey"
            columns: ["medical_code_id"]
            isOneToOne: false
            referencedRelation: "medical_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      code_mappings: {
        Row: {
          created_at: string
          from_code_id: string
          id: string
          relation: Database["public"]["Enums"]["code_mapping_relation"]
          source: string | null
          to_code_id: string
        }
        Insert: {
          created_at?: string
          from_code_id: string
          id?: string
          relation: Database["public"]["Enums"]["code_mapping_relation"]
          source?: string | null
          to_code_id: string
        }
        Update: {
          created_at?: string
          from_code_id?: string
          id?: string
          relation?: Database["public"]["Enums"]["code_mapping_relation"]
          source?: string | null
          to_code_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_mappings_from_code_id_fkey"
            columns: ["from_code_id"]
            isOneToOne: false
            referencedRelation: "medical_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "code_mappings_to_code_id_fkey"
            columns: ["to_code_id"]
            isOneToOne: false
            referencedRelation: "medical_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      code_systems: {
        Row: {
          created_at: string
          current_version: string
          description: string | null
          id: string
          name: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          current_version: string
          description?: string | null
          id: string
          name: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          current_version?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      conditions: {
        Row: {
          approved: boolean | null
          created_at: string | null
          created_by: string | null
          icd10_code: string | null
          id: string
          name: string
          slug: string
          submission_count: number | null
          updated_at: string | null
        }
        Insert: {
          approved?: boolean | null
          created_at?: string | null
          created_by?: string | null
          icd10_code?: string | null
          id?: string
          name: string
          slug: string
          submission_count?: number | null
          updated_at?: string | null
        }
        Update: {
          approved?: boolean | null
          created_at?: string | null
          created_by?: string | null
          icd10_code?: string | null
          id?: string
          name?: string
          slug?: string
          submission_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      disease_profiles: {
        Row: {
          approved_at: string | null
          citation: string | null
          condition_id: string
          contributor: string | null
          contributor_id: string | null
          created_at: string | null
          criteria: Json | null
          id: string
          imaging: Json | null
          labs: Json | null
          scoring_tools: Json | null
          status: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          approved_at?: string | null
          citation?: string | null
          condition_id: string
          contributor?: string | null
          contributor_id?: string | null
          created_at?: string | null
          criteria?: Json | null
          id?: string
          imaging?: Json | null
          labs?: Json | null
          scoring_tools?: Json | null
          status?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          approved_at?: string | null
          citation?: string | null
          condition_id?: string
          contributor?: string | null
          contributor_id?: string | null
          created_at?: string | null
          criteria?: Json | null
          id?: string
          imaging?: Json | null
          labs?: Json | null
          scoring_tools?: Json | null
          status?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "disease_profiles_condition_id_fkey"
            columns: ["condition_id"]
            isOneToOne: false
            referencedRelation: "conditions"
            referencedColumns: ["id"]
          },
        ]
      }
      download_log: {
        Row: {
          condition_filter: string | null
          export_format: string | null
          exported_at: string | null
          id: string
          researcher_id: string
          row_count: number | null
        }
        Insert: {
          condition_filter?: string | null
          export_format?: string | null
          exported_at?: string | null
          id?: string
          researcher_id: string
          row_count?: number | null
        }
        Update: {
          condition_filter?: string | null
          export_format?: string | null
          exported_at?: string | null
          id?: string
          researcher_id?: string
          row_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "download_log_researcher_id_fkey"
            columns: ["researcher_id"]
            isOneToOne: false
            referencedRelation: "researchers"
            referencedColumns: ["id"]
          },
        ]
      }
      election_candidates: {
        Row: {
          candidate_id: string
          created_at: string
          election_id: string
          id: string
          nominated_by: string | null
          statement: string | null
          withdrawn_at: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          election_id: string
          id?: string
          nominated_by?: string | null
          statement?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          election_id?: string
          id?: string
          nominated_by?: string | null
          statement?: string | null
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "election_candidates_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      election_votes: {
        Row: {
          candidate_id: string
          created_at: string
          election_id: string
          id: string
          voter_id: string
          weight: number
        }
        Insert: {
          candidate_id: string
          created_at?: string
          election_id: string
          id?: string
          voter_id: string
          weight?: number
        }
        Update: {
          candidate_id?: string
          created_at?: string
          election_id?: string
          id?: string
          voter_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "election_votes_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      elections: {
        Row: {
          created_at: string
          id: string
          min_turnout_pct: number
          nominations_open_at: string | null
          scope_id: string
          scope_type: Database["public"]["Enums"]["governance_scope_type"]
          seat_id: string | null
          status: Database["public"]["Enums"]["election_status"]
          voting_close_at: string | null
          voting_open_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          min_turnout_pct?: number
          nominations_open_at?: string | null
          scope_id: string
          scope_type: Database["public"]["Enums"]["governance_scope_type"]
          seat_id?: string | null
          status?: Database["public"]["Enums"]["election_status"]
          voting_close_at?: string | null
          voting_open_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          min_turnout_pct?: number
          nominations_open_at?: string | null
          scope_id?: string
          scope_type?: Database["public"]["Enums"]["governance_scope_type"]
          seat_id?: string | null
          status?: Database["public"]["Enums"]["election_status"]
          voting_close_at?: string | null
          voting_open_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "elections_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "moderator_seats"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_action_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          payload: Json
          reason: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          payload?: Json
          reason: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          payload?: Json
          reason?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      governance_phase: {
        Row: {
          commitment: string
          id: number
          phase: number
          trigger_description: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          commitment?: string
          id?: number
          phase?: number
          trigger_description?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          commitment?: string
          id?: number
          phase?: number
          trigger_description?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      juries: {
        Row: {
          created_at: string
          decided_at: string | null
          decision_type: Database["public"]["Enums"]["jury_decision_type"]
          id: string
          status: Database["public"]["Enums"]["jury_status"]
          subject_ref: string
          subject_summary: string | null
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decision_type: Database["public"]["Enums"]["jury_decision_type"]
          id?: string
          status?: Database["public"]["Enums"]["jury_status"]
          subject_ref: string
          subject_summary?: string | null
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decision_type?: Database["public"]["Enums"]["jury_decision_type"]
          id?: string
          status?: Database["public"]["Enums"]["jury_status"]
          subject_ref?: string
          subject_summary?: string | null
        }
        Relationships: []
      }
      jury_decisions: {
        Row: {
          created_at: string
          decided_by: string
          id: string
          jury_id: string
          outcome: string
          reasoning: string
        }
        Insert: {
          created_at?: string
          decided_by: string
          id?: string
          jury_id: string
          outcome: string
          reasoning: string
        }
        Update: {
          created_at?: string
          decided_by?: string
          id?: string
          jury_id?: string
          outcome?: string
          reasoning?: string
        }
        Relationships: [
          {
            foreignKeyName: "jury_decisions_jury_id_fkey"
            columns: ["jury_id"]
            isOneToOne: false
            referencedRelation: "juries"
            referencedColumns: ["id"]
          },
        ]
      }
      jury_deliberations: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          jury_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          jury_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          jury_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jury_deliberations_jury_id_fkey"
            columns: ["jury_id"]
            isOneToOne: false
            referencedRelation: "juries"
            referencedColumns: ["id"]
          },
        ]
      }
      jury_members: {
        Row: {
          id: string
          invited_at: string
          jury_id: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_at?: string
          jury_id: string
          user_id: string
        }
        Update: {
          id?: string
          invited_at?: string
          jury_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jury_members_jury_id_fkey"
            columns: ["jury_id"]
            isOneToOne: false
            referencedRelation: "juries"
            referencedColumns: ["id"]
          },
        ]
      }
      match_reports: {
        Row: {
          created_at: string
          id: string
          matched_alias_id: string | null
          matched_code_id: string | null
          reason: string | null
          redacted_input: string
          reporter_id: string
          resolution_notes: string | null
          resolved: boolean
          resolved_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          matched_alias_id?: string | null
          matched_code_id?: string | null
          reason?: string | null
          redacted_input: string
          reporter_id: string
          resolution_notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          matched_alias_id?: string | null
          matched_code_id?: string | null
          reason?: string | null
          redacted_input?: string
          reporter_id?: string
          resolution_notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_reports_matched_alias_id_fkey"
            columns: ["matched_alias_id"]
            isOneToOne: false
            referencedRelation: "code_aliases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_reports_matched_code_id_fkey"
            columns: ["matched_code_id"]
            isOneToOne: false
            referencedRelation: "medical_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_codes: {
        Row: {
          code: string
          code_system: string
          code_system_version: string
          created_at: string
          display: string
          embedding: string | null
          id: string
          kind: Database["public"]["Enums"]["medical_code_kind"]
          metadata: Json
          parent_code_id: string | null
          retired_at: string | null
          specialty_scope: string[]
        }
        Insert: {
          code: string
          code_system: string
          code_system_version: string
          created_at?: string
          display: string
          embedding?: string | null
          id?: string
          kind: Database["public"]["Enums"]["medical_code_kind"]
          metadata?: Json
          parent_code_id?: string | null
          retired_at?: string | null
          specialty_scope?: string[]
        }
        Update: {
          code?: string
          code_system?: string
          code_system_version?: string
          created_at?: string
          display?: string
          embedding?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["medical_code_kind"]
          metadata?: Json
          parent_code_id?: string | null
          retired_at?: string | null
          specialty_scope?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "medical_codes_code_system_fkey"
            columns: ["code_system"]
            isOneToOne: false
            referencedRelation: "code_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_codes_parent_code_id_fkey"
            columns: ["parent_code_id"]
            isOneToOne: false
            referencedRelation: "medical_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          receiver_id: string
          sender_id: string
          wave_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
          wave_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
          wave_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_wave_id_fkey"
            columns: ["wave_id"]
            isOneToOne: false
            referencedRelation: "waves"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_queue_items: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          id: string
          is_calibration: boolean
          pending_code_entry_id: string
          priority: number
          rejection_reason:
            | Database["public"]["Enums"]["moderation_rejection_reason"]
            | null
          required_tier: string | null
          resolution_alias_id: string | null
          resolution_code_id: string | null
          shadow_decision: Json | null
          source: Database["public"]["Enums"]["moderation_source"]
          status: Database["public"]["Enums"]["moderation_item_status"]
          updated_at: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          id?: string
          is_calibration?: boolean
          pending_code_entry_id: string
          priority?: number
          rejection_reason?:
            | Database["public"]["Enums"]["moderation_rejection_reason"]
            | null
          required_tier?: string | null
          resolution_alias_id?: string | null
          resolution_code_id?: string | null
          shadow_decision?: Json | null
          source: Database["public"]["Enums"]["moderation_source"]
          status?: Database["public"]["Enums"]["moderation_item_status"]
          updated_at?: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          id?: string
          is_calibration?: boolean
          pending_code_entry_id?: string
          priority?: number
          rejection_reason?:
            | Database["public"]["Enums"]["moderation_rejection_reason"]
            | null
          required_tier?: string | null
          resolution_alias_id?: string | null
          resolution_code_id?: string | null
          shadow_decision?: Json | null
          source?: Database["public"]["Enums"]["moderation_source"]
          status?: Database["public"]["Enums"]["moderation_item_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_queue_items_pending_code_entry_id_fkey"
            columns: ["pending_code_entry_id"]
            isOneToOne: true
            referencedRelation: "pending_code_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_queue_items_resolution_alias_id_fkey"
            columns: ["resolution_alias_id"]
            isOneToOne: false
            referencedRelation: "code_aliases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_queue_items_resolution_code_id_fkey"
            columns: ["resolution_code_id"]
            isOneToOne: false
            referencedRelation: "medical_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      moderator_seats: {
        Row: {
          consecutive_terms: number
          created_at: string
          holder_id: string | null
          id: string
          scope_id: string
          scope_type: Database["public"]["Enums"]["governance_scope_type"]
          seat_number: number
          term_end: string | null
          term_start: string | null
        }
        Insert: {
          consecutive_terms?: number
          created_at?: string
          holder_id?: string | null
          id?: string
          scope_id: string
          scope_type: Database["public"]["Enums"]["governance_scope_type"]
          seat_number?: number
          term_end?: string | null
          term_start?: string | null
        }
        Update: {
          consecutive_terms?: number
          created_at?: string
          holder_id?: string | null
          id?: string
          scope_id?: string
          scope_type?: Database["public"]["Enums"]["governance_scope_type"]
          seat_number?: number
          term_end?: string | null
          term_start?: string | null
        }
        Relationships: []
      }
      npi_reverification_log: {
        Row: {
          checked_at: string
          id: string
          npi: string
          payload: Json | null
          status: string
          taxonomy_drift: boolean
          user_id: string
        }
        Insert: {
          checked_at?: string
          id?: string
          npi: string
          payload?: Json | null
          status: string
          taxonomy_drift?: boolean
          user_id: string
        }
        Update: {
          checked_at?: string
          id?: string
          npi?: string
          payload?: Json | null
          status?: string
          taxonomy_drift?: boolean
          user_id?: string
        }
        Relationships: []
      }
      patient_profiles: {
        Row: {
          bio: string | null
          condition_ids: string[] | null
          contact_consent: boolean
          created_at: string
          display_name: string | null
          id: string
          sharing_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          condition_ids?: string[] | null
          contact_consent?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          sharing_mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          condition_ids?: string[] | null
          contact_consent?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          sharing_mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_code_entries: {
        Row: {
          candidate_code_id: string | null
          candidate_score: number | null
          code_system_hint: string | null
          created_at: string
          id: string
          redacted_text: string
          resolved_alias_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_code_id: string | null
          status: Database["public"]["Enums"]["pending_code_status"]
          submission_id: string | null
          submitter_id: string | null
          updated_at: string
        }
        Insert: {
          candidate_code_id?: string | null
          candidate_score?: number | null
          code_system_hint?: string | null
          created_at?: string
          id?: string
          redacted_text: string
          resolved_alias_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_code_id?: string | null
          status?: Database["public"]["Enums"]["pending_code_status"]
          submission_id?: string | null
          submitter_id?: string | null
          updated_at?: string
        }
        Update: {
          candidate_code_id?: string | null
          candidate_score?: number | null
          code_system_hint?: string | null
          created_at?: string
          id?: string
          redacted_text?: string
          resolved_alias_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_code_id?: string | null
          status?: Database["public"]["Enums"]["pending_code_status"]
          submission_id?: string | null
          submitter_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_code_entries_candidate_code_id_fkey"
            columns: ["candidate_code_id"]
            isOneToOne: false
            referencedRelation: "medical_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_code_entries_code_system_hint_fkey"
            columns: ["code_system_hint"]
            isOneToOne: false
            referencedRelation: "code_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_code_entries_resolved_alias_id_fkey"
            columns: ["resolved_alias_id"]
            isOneToOne: false
            referencedRelation: "code_aliases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_code_entries_resolved_code_id_fkey"
            columns: ["resolved_code_id"]
            isOneToOne: false
            referencedRelation: "medical_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_code_entries_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_term_occurrences: {
        Row: {
          created_at: string
          id: string
          pending_code_entry_id: string
          submitter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pending_code_entry_id: string
          submitter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pending_code_entry_id?: string
          submitter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_term_occurrences_pending_code_entry_id_fkey"
            columns: ["pending_code_entry_id"]
            isOneToOne: false
            referencedRelation: "pending_code_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      phi_eponym_allowlist: {
        Row: {
          added_by: string | null
          category: string
          created_at: string
          id: string
          term: string
        }
        Insert: {
          added_by?: string | null
          category?: string
          created_at?: string
          id?: string
          term: string
        }
        Update: {
          added_by?: string | null
          category?: string
          created_at?: string
          id?: string
          term?: string
        }
        Relationships: []
      }
      phi_reports: {
        Row: {
          created_at: string
          id: string
          moderation_queue_item_id: string
          reason: string
          reporter_id: string | null
          resolution_notes: string | null
          resolved: boolean
          resolved_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          moderation_queue_item_id: string
          reason: string
          reporter_id?: string | null
          resolution_notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          moderation_queue_item_id?: string
          reason?: string
          reporter_id?: string | null
          resolution_notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phi_reports_moderation_queue_item_id_fkey"
            columns: ["moderation_queue_item_id"]
            isOneToOne: false
            referencedRelation: "moderation_queue_items"
            referencedColumns: ["id"]
          },
        ]
      }
      recall_votes: {
        Row: {
          created_at: string
          id: string
          recall_id: string
          vote: boolean
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recall_id: string
          vote: boolean
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recall_id?: string
          vote?: boolean
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recall_votes_recall_id_fkey"
            columns: ["recall_id"]
            isOneToOne: false
            referencedRelation: "recalls"
            referencedColumns: ["id"]
          },
        ]
      }
      recalls: {
        Row: {
          decided_at: string | null
          id: string
          initiated_at: string
          initiator_id: string
          reason: string
          seat_id: string
          status: Database["public"]["Enums"]["recall_status"]
          voting_close_at: string | null
        }
        Insert: {
          decided_at?: string | null
          id?: string
          initiated_at?: string
          initiator_id: string
          reason: string
          seat_id: string
          status?: Database["public"]["Enums"]["recall_status"]
          voting_close_at?: string | null
        }
        Update: {
          decided_at?: string | null
          id?: string
          initiated_at?: string
          initiator_id?: string
          reason?: string
          seat_id?: string
          status?: Database["public"]["Enums"]["recall_status"]
          voting_close_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recalls_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "moderator_seats"
            referencedColumns: ["id"]
          },
        ]
      }
      redaction_log: {
        Row: {
          counts: Json
          created_at: string
          error_code: string | null
          id: string
          model_version: string | null
          moderation_queue_item_id: string | null
          pending_code_entry_id: string | null
          phase: Database["public"]["Enums"]["redaction_phase"]
          provider: string
        }
        Insert: {
          counts?: Json
          created_at?: string
          error_code?: string | null
          id?: string
          model_version?: string | null
          moderation_queue_item_id?: string | null
          pending_code_entry_id?: string | null
          phase: Database["public"]["Enums"]["redaction_phase"]
          provider: string
        }
        Update: {
          counts?: Json
          created_at?: string
          error_code?: string | null
          id?: string
          model_version?: string | null
          moderation_queue_item_id?: string | null
          pending_code_entry_id?: string | null
          phase?: Database["public"]["Enums"]["redaction_phase"]
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "redaction_log_moderation_queue_item_id_fkey"
            columns: ["moderation_queue_item_id"]
            isOneToOne: false
            referencedRelation: "moderation_queue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redaction_log_pending_code_entry_id_fkey"
            columns: ["pending_code_entry_id"]
            isOneToOne: false
            referencedRelation: "pending_code_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      researchers: {
        Row: {
          agreed_terms_at: string
          api_key: string | null
          created_at: string | null
          id: string
          institution: string | null
          intended_use: string | null
          name: string
          orcid: string | null
          research_focus: string | null
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          agreed_terms_at?: string
          api_key?: string | null
          created_at?: string | null
          id?: string
          institution?: string | null
          intended_use?: string | null
          name: string
          orcid?: string | null
          research_focus?: string | null
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          agreed_terms_at?: string
          api_key?: string | null
          created_at?: string | null
          id?: string
          institution?: string | null
          intended_use?: string | null
          name?: string
          orcid?: string | null
          research_focus?: string | null
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reviewer_calibration_attempts: {
        Row: {
          answered_at: string
          calibration_item_id: string
          chosen_decision: string
          correct: boolean
          id: string
          user_id: string
        }
        Insert: {
          answered_at?: string
          calibration_item_id: string
          chosen_decision: string
          correct: boolean
          id?: string
          user_id: string
        }
        Update: {
          answered_at?: string
          calibration_item_id?: string
          chosen_decision?: string
          correct?: boolean
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_calibration_attempts_calibration_item_id_fkey"
            columns: ["calibration_item_id"]
            isOneToOne: false
            referencedRelation: "calibration_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewer_status: {
        Row: {
          calibration_completed_at: string | null
          calibration_score: number | null
          created_at: string
          full_access_granted_at: string | null
          full_access_granted_by: string | null
          shadow_reviews_completed: number
          shadow_reviews_required: number
          updated_at: string
          user_id: string
        }
        Insert: {
          calibration_completed_at?: string | null
          calibration_score?: number | null
          created_at?: string
          full_access_granted_at?: string | null
          full_access_granted_by?: string | null
          shadow_reviews_completed?: number
          shadow_reviews_required?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          calibration_completed_at?: string | null
          calibration_score?: number | null
          created_at?: string
          full_access_granted_at?: string | null
          full_access_granted_by?: string | null
          shadow_reviews_completed?: number
          shadow_reviews_required?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shadow_review_decisions: {
        Row: {
          agreement: boolean | null
          created_at: string
          id: string
          moderation_queue_item_id: string
          senior_decision: Json | null
          trainee_decision: Json
          trainee_id: string
        }
        Insert: {
          agreement?: boolean | null
          created_at?: string
          id?: string
          moderation_queue_item_id: string
          senior_decision?: Json | null
          trainee_decision: Json
          trainee_id: string
        }
        Update: {
          agreement?: boolean | null
          created_at?: string
          id?: string
          moderation_queue_item_id?: string
          senior_decision?: Json | null
          trainee_decision?: Json
          trainee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shadow_review_decisions_moderation_queue_item_id_fkey"
            columns: ["moderation_queue_item_id"]
            isOneToOne: false
            referencedRelation: "moderation_queue_items"
            referencedColumns: ["id"]
          },
        ]
      }
      specialist_applications: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          document_url: string | null
          email_verification_token: string | null
          email_verified_at: string | null
          full_name: string | null
          id: string
          institutional_email: string | null
          npi: string | null
          nppes_payload: Json | null
          primary_taxonomy: string | null
          primary_taxonomy_display: string | null
          secondary_taxonomies: Json
          status: Database["public"]["Enums"]["specialist_application_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          document_url?: string | null
          email_verification_token?: string | null
          email_verified_at?: string | null
          full_name?: string | null
          id?: string
          institutional_email?: string | null
          npi?: string | null
          nppes_payload?: Json | null
          primary_taxonomy?: string | null
          primary_taxonomy_display?: string | null
          secondary_taxonomies?: Json
          status?: Database["public"]["Enums"]["specialist_application_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          document_url?: string | null
          email_verification_token?: string | null
          email_verified_at?: string | null
          full_name?: string | null
          id?: string
          institutional_email?: string | null
          npi?: string | null
          nppes_payload?: Json | null
          primary_taxonomy?: string | null
          primary_taxonomy_display?: string | null
          secondary_taxonomies?: Json
          status?: Database["public"]["Enums"]["specialist_application_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      specialist_scopes: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          specialty: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          specialty: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          specialty?: string
          user_id?: string
        }
        Relationships: []
      }
      specialist_tiers: {
        Row: {
          granted_at: string
          granted_by: string | null
          granted_reason: string | null
          id: string
          revoked_at: string | null
          scope_id: string
          scope_type: Database["public"]["Enums"]["governance_scope_type"]
          tier: Database["public"]["Enums"]["specialist_tier"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          granted_reason?: string | null
          id?: string
          revoked_at?: string | null
          scope_id: string
          scope_type: Database["public"]["Enums"]["governance_scope_type"]
          tier?: Database["public"]["Enums"]["specialist_tier"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          granted_reason?: string | null
          id?: string
          revoked_at?: string | null
          scope_id?: string
          scope_type?: Database["public"]["Enums"]["governance_scope_type"]
          tier?: Database["public"]["Enums"]["specialist_tier"]
          user_id?: string
        }
        Relationships: []
      }
      specialty_clusters: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          terminology_scope: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          terminology_scope?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          terminology_scope?: Json
          updated_at?: string
        }
        Relationships: []
      }
      submission_pii: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          submission_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          submission_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_pii_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_rate_buckets: {
        Row: {
          bucket_key: string
          bucket_kind: string
          count: number
          id: string
          window_kind: string
          window_start: string
        }
        Insert: {
          bucket_key: string
          bucket_kind: string
          count?: number
          id?: string
          window_kind: string
          window_start: string
        }
        Update: {
          bucket_key?: string
          bucket_kind?: string
          count?: number
          id?: string
          window_kind?: string
          window_start?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          condition_id: string
          dynamic_fields: Json | null
          id: string
          profile_version_id: string | null
          sharing_preference: string | null
          submitted_at: string | null
          submitter_account_id: string | null
          universal_fields: Json
        }
        Insert: {
          condition_id: string
          dynamic_fields?: Json | null
          id?: string
          profile_version_id?: string | null
          sharing_preference?: string | null
          submitted_at?: string | null
          submitter_account_id?: string | null
          universal_fields?: Json
        }
        Update: {
          condition_id?: string
          dynamic_fields?: Json | null
          id?: string
          profile_version_id?: string | null
          sharing_preference?: string | null
          submitted_at?: string | null
          submitter_account_id?: string | null
          universal_fields?: Json
        }
        Relationships: [
          {
            foreignKeyName: "submissions_condition_id_fkey"
            columns: ["condition_id"]
            isOneToOne: false
            referencedRelation: "conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_profile_version_id_fkey"
            columns: ["profile_version_id"]
            isOneToOne: false
            referencedRelation: "disease_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vetting_panel_members: {
        Row: {
          id: string
          invited_at: string
          panel_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_at?: string
          panel_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          invited_at?: string
          panel_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vetting_panel_members_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "vetting_panels"
            referencedColumns: ["id"]
          },
        ]
      }
      vetting_panel_votes: {
        Row: {
          created_at: string
          id: string
          panel_id: string
          reasoning: string
          vote: Database["public"]["Enums"]["vetting_vote"]
          voter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          panel_id: string
          reasoning: string
          vote: Database["public"]["Enums"]["vetting_vote"]
          voter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          panel_id?: string
          reasoning?: string
          vote?: Database["public"]["Enums"]["vetting_vote"]
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vetting_panel_votes_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "vetting_panels"
            referencedColumns: ["id"]
          },
        ]
      }
      vetting_panels: {
        Row: {
          application_id: string
          closed_at: string | null
          created_at: string
          id: string
          outcome: Database["public"]["Enums"]["vetting_vote"] | null
          sla_due_at: string
        }
        Insert: {
          application_id: string
          closed_at?: string | null
          created_at?: string
          id?: string
          outcome?: Database["public"]["Enums"]["vetting_vote"] | null
          sla_due_at?: string
        }
        Update: {
          application_id?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          outcome?: Database["public"]["Enums"]["vetting_vote"] | null
          sla_due_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vetting_panels_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "specialist_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary_edit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          effective_at: string
          high_impact: boolean
          id: string
          payload: Json
          reason: string | null
          review_window_ends_at: string | null
          scope_id: string | null
          scope_type:
            | Database["public"]["Enums"]["governance_scope_type"]
            | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          effective_at?: string
          high_impact?: boolean
          id?: string
          payload?: Json
          reason?: string | null
          review_window_ends_at?: string | null
          scope_id?: string | null
          scope_type?:
            | Database["public"]["Enums"]["governance_scope_type"]
            | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          effective_at?: string
          high_impact?: boolean
          id?: string
          payload?: Json
          reason?: string | null
          review_window_ends_at?: string | null
          scope_id?: string | null
          scope_type?:
            | Database["public"]["Enums"]["governance_scope_type"]
            | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      waves: {
        Row: {
          condition_id: string
          created_at: string
          from_user_id: string
          id: string
          seen_at: string | null
          to_user_id: string
        }
        Insert: {
          condition_id: string
          created_at?: string
          from_user_id: string
          id?: string
          seen_at?: string | null
          to_user_id: string
        }
        Update: {
          condition_id?: string
          created_at?: string
          from_user_id?: string
          id?: string
          seen_at?: string | null
          to_user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      code_in_user_scope: {
        Args: { _code_id: string; _user_id: string }
        Returns: boolean
      }
      get_my_condition_ids: { Args: { _user_id: string }; Returns: string[] }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_specialty: {
        Args: { _specialty: string; _user_id: string }
        Returns: boolean
      }
      is_jury_member: {
        Args: { _jury_id: string; _user_id: string }
        Returns: boolean
      }
      is_panel_member: {
        Args: { _panel_id: string; _user_id: string }
        Returns: boolean
      }
      user_tier_in_scope: {
        Args: {
          _scope_id: string
          _scope_type: Database["public"]["Enums"]["governance_scope_type"]
          _user_id: string
        }
        Returns: Database["public"]["Enums"]["specialist_tier"]
      }
    }
    Enums: {
      app_role: "admin" | "specialist" | "researcher"
      code_alias_status: "approved" | "pending" | "rejected"
      code_mapping_relation: "equivalent" | "broader" | "narrower" | "related"
      election_status:
        | "upcoming"
        | "open"
        | "closed"
        | "certified"
        | "cancelled"
      governance_scope_type: "specialty" | "cluster"
      jury_decision_type:
        | "contested_edit"
        | "application_appeal"
        | "moderator_action_challenge"
      jury_status: "forming" | "deliberating" | "decided" | "closed"
      medical_code_kind:
        | "diagnosis"
        | "symptom"
        | "procedure"
        | "medication"
        | "finding"
      moderation_item_status:
        | "awaiting"
        | "in_review"
        | "approved_new"
        | "mapped_alias"
        | "rejected"
        | "needs_info"
        | "deferred_to_moderator"
      moderation_rejection_reason:
        | "duplicate"
        | "not_medical"
        | "phi_leaked"
        | "nonsense"
        | "out_of_scope"
        | "other"
      moderation_source:
        | "threshold"
        | "specialist_suggestion"
        | "content_report"
      pending_code_status:
        | "pending"
        | "mapped"
        | "new_code_created"
        | "rejected"
      recall_status: "initiated" | "open" | "passed" | "failed" | "cancelled"
      redaction_phase: "client_preview" | "server_submit" | "review_rescrub"
      specialist_application_status:
        | "draft"
        | "pending"
        | "in_review"
        | "approved"
        | "rejected"
        | "needs_info"
        | "withdrawn"
      specialist_tier: "contributing" | "core" | "moderator"
      vetting_vote: "approve" | "reject" | "needs_info"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "specialist", "researcher"],
      code_alias_status: ["approved", "pending", "rejected"],
      code_mapping_relation: ["equivalent", "broader", "narrower", "related"],
      election_status: ["upcoming", "open", "closed", "certified", "cancelled"],
      governance_scope_type: ["specialty", "cluster"],
      jury_decision_type: [
        "contested_edit",
        "application_appeal",
        "moderator_action_challenge",
      ],
      jury_status: ["forming", "deliberating", "decided", "closed"],
      medical_code_kind: [
        "diagnosis",
        "symptom",
        "procedure",
        "medication",
        "finding",
      ],
      moderation_item_status: [
        "awaiting",
        "in_review",
        "approved_new",
        "mapped_alias",
        "rejected",
        "needs_info",
        "deferred_to_moderator",
      ],
      moderation_rejection_reason: [
        "duplicate",
        "not_medical",
        "phi_leaked",
        "nonsense",
        "out_of_scope",
        "other",
      ],
      moderation_source: [
        "threshold",
        "specialist_suggestion",
        "content_report",
      ],
      pending_code_status: [
        "pending",
        "mapped",
        "new_code_created",
        "rejected",
      ],
      recall_status: ["initiated", "open", "passed", "failed", "cancelled"],
      redaction_phase: ["client_preview", "server_submit", "review_rescrub"],
      specialist_application_status: [
        "draft",
        "pending",
        "in_review",
        "approved",
        "rejected",
        "needs_info",
        "withdrawn",
      ],
      specialist_tier: ["contributing", "core", "moderator"],
      vetting_vote: ["approve", "reject", "needs_info"],
    },
  },
} as const
