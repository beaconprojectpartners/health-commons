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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "specialist" | "researcher"
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
    },
  },
} as const
