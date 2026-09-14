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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_run: {
        Row: {
          candidates: number
          created: number
          errors: number
          finished_at: string | null
          from_model: number
          from_template: number
          id: number
          input_tokens: number
          job: string
          output_tokens: number
          pushed: number
          started_at: string
        }
        Insert: {
          candidates?: number
          created?: number
          errors?: number
          finished_at?: string | null
          from_model?: number
          from_template?: number
          id?: never
          input_tokens?: number
          job: string
          output_tokens?: number
          pushed?: number
          started_at?: string
        }
        Update: {
          candidates?: number
          created?: number
          errors?: number
          finished_at?: string | null
          from_model?: number
          from_template?: number
          id?: never
          input_tokens?: number
          job?: string
          output_tokens?: number
          pushed?: number
          started_at?: string
        }
        Relationships: []
      }
      club: {
        Row: {
          abbreviation: string
          country: string
          created_at: string
          home_venue_id: string | null
          id: string
          name: string
          name_article: string
          primary_color: string
          secondary_color: string
          short_name: string
          tier: number | null
        }
        Insert: {
          abbreviation: string
          country: string
          created_at?: string
          home_venue_id?: string | null
          id: string
          name: string
          name_article?: string
          primary_color: string
          secondary_color: string
          short_name: string
          tier?: number | null
        }
        Update: {
          abbreviation?: string
          country?: string
          created_at?: string
          home_venue_id?: string | null
          id?: string
          name?: string
          name_article?: string
          primary_color?: string
          secondary_color?: string
          short_name?: string
          tier?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "club_home_venue_id_fkey"
            columns: ["home_venue_id"]
            isOneToOne: false
            referencedRelation: "venue"
            referencedColumns: ["id"]
          },
        ]
      }
      competition: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          tier: number | null
        }
        Insert: {
          created_at?: string
          id: string
          kind: string
          name: string
          tier?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          tier?: number | null
        }
        Relationships: []
      }
      device_token: {
        Row: {
          created_at: string
          last_seen_at: string
          platform: string
          profile_id: string
          token: string
        }
        Insert: {
          created_at?: string
          last_seen_at?: string
          platform: string
          profile_id: string
          token: string
        }
        Update: {
          created_at?: string
          last_seen_at?: string
          platform?: string
          profile_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_token_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture: {
        Row: {
          away_club_id: string
          competition_id: string
          created_at: string
          external_id: string | null
          home_club_id: string
          id: string
          kickoff_at: string
          season_id: string | null
          stage: string
          venue_id: string
        }
        Insert: {
          away_club_id: string
          competition_id: string
          created_at?: string
          external_id?: string | null
          home_club_id: string
          id: string
          kickoff_at: string
          season_id?: string | null
          stage: string
          venue_id: string
        }
        Update: {
          away_club_id?: string
          competition_id?: string
          created_at?: string
          external_id?: string | null
          home_club_id?: string
          id?: string
          kickoff_at?: string
          season_id?: string | null
          stage?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_away_club_id_fkey"
            columns: ["away_club_id"]
            isOneToOne: false
            referencedRelation: "club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competition"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_home_club_id_fkey"
            columns: ["home_club_id"]
            isOneToOne: false
            referencedRelation: "club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_attendance: {
        Row: {
          created_at: string
          fixture_id: string
          profile_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fixture_id: string
          profile_id: string
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fixture_id?: string
          profile_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_attendance_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixture"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_attendance_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      nudge: {
        Row: {
          body: string
          created_at: string
          facts: Json
          fixture_id: string | null
          id: string
          input_tokens: number
          kind: string
          local_date: string
          model: string | null
          output_tokens: number
          profile_id: string
          push_status: string
          read_at: string | null
          source: string
        }
        Insert: {
          body: string
          created_at?: string
          facts: Json
          fixture_id?: string | null
          id?: string
          input_tokens?: number
          kind: string
          local_date: string
          model?: string | null
          output_tokens?: number
          profile_id: string
          push_status?: string
          read_at?: string | null
          source: string
        }
        Update: {
          body?: string
          created_at?: string
          facts?: Json
          fixture_id?: string | null
          id?: string
          input_tokens?: number
          kind?: string
          local_date?: string
          model?: string | null
          output_tokens?: number
          profile_id?: string
          push_status?: string
          read_at?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "nudge_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixture"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudge_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      place: {
        Row: {
          created_at: string
          distance_m: number
          id: string
          kind: string
          location: unknown
          name: string
          name_article: string
          venue_id: string
          walking_minutes: number
        }
        Insert: {
          created_at?: string
          distance_m: number
          id: string
          kind: string
          location: unknown
          name: string
          name_article: string
          venue_id: string
          walking_minutes: number
        }
        Update: {
          created_at?: string
          distance_m?: number
          id?: string
          kind?: string
          location?: unknown
          name?: string
          name_article?: string
          venue_id?: string
          walking_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "place_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue"
            referencedColumns: ["id"]
          },
        ]
      }
      place_visit: {
        Row: {
          created_at: string
          id: string
          place_id: string
          profile_id: string
          source: string
          visited_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          place_id: string
          profile_id: string
          source: string
          visited_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          place_id?: string
          profile_id?: string
          source?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_visit_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_visit_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          created_at: string
          display_name: string
          id: string
          nudges_enabled: boolean
          recap_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          nudges_enabled?: boolean
          recap_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          nudges_enabled?: boolean
          recap_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profile_club: {
        Row: {
          club_id: string
          created_at: string
          profile_id: string
          relation: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          profile_id: string
          relation: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          profile_id?: string
          relation?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_club_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_club_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      season: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          starts_on: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id: string
          starts_on: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          starts_on?: string
        }
        Relationships: []
      }
      season_recap: {
        Row: {
          body: string
          created_at: string
          headline: string
          id: string
          input_tokens: number
          model: string | null
          output_tokens: number
          profile_id: string
          push_status: string
          season_id: string
          shared_at: string | null
          source: string
          stats: Json
        }
        Insert: {
          body: string
          created_at?: string
          headline: string
          id?: string
          input_tokens?: number
          model?: string | null
          output_tokens?: number
          profile_id: string
          push_status?: string
          season_id: string
          shared_at?: string | null
          source: string
          stats: Json
        }
        Update: {
          body?: string
          created_at?: string
          headline?: string
          id?: string
          input_tokens?: number
          model?: string | null
          output_tokens?: number
          profile_id?: string
          push_status?: string
          season_id?: string
          shared_at?: string | null
          source?: string
          stats?: Json
        }
        Relationships: [
          {
            foreignKeyName: "season_recap_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_recap_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["id"]
          },
        ]
      }
      venue: {
        Row: {
          address: string | null
          capacity: number | null
          city: string
          country: string
          created_at: string
          district: string | null
          id: string
          latitude: number | null
          location: unknown
          longitude: number | null
          name: string
          name_article: string
          region: string
          roof_coverage: string | null
          short_name: string | null
          short_name_article: string | null
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          city: string
          country: string
          created_at?: string
          district?: string | null
          id: string
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          name: string
          name_article?: string
          region: string
          roof_coverage?: string | null
          short_name?: string | null
          short_name_article?: string | null
        }
        Update: {
          address?: string | null
          capacity?: number | null
          city?: string
          country?: string
          created_at?: string
          district?: string | null
          id?: string
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          name?: string
          name_article?: string
          region?: string
          roof_coverage?: string | null
          short_name?: string | null
          short_name_article?: string | null
        }
        Relationships: []
      }
      venue_review: {
        Row: {
          access_score: number
          atmosphere_score: number
          comment: string
          created_at: string
          fixture_id: string
          profile_id: string
          stadium_score: number
          updated_at: string
        }
        Insert: {
          access_score: number
          atmosphere_score: number
          comment?: string
          created_at?: string
          fixture_id: string
          profile_id: string
          stadium_score: number
          updated_at?: string
        }
        Update: {
          access_score?: number
          atmosphere_score?: number
          comment?: string
          created_at?: string
          fixture_id?: string
          profile_id?: string
          stadium_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_review_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixture"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_review_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      club_supporter_counts: {
        Args: never
        Returns: {
          club_id: string
          supporters: number
        }[]
      }
      nudge_candidates: {
        Args: { p_now?: string }
        Returns: {
          facts: Json
          fixture_id: string
          kind: string
          profile_id: string
        }[]
      }
      register_device_token: {
        Args: { p_platform: string; p_token: string }
        Returns: undefined
      }
      season_recap_candidates: {
        Args: { p_season_id: string }
        Returns: {
          profile_id: string
        }[]
      }
      season_recap_stats: {
        Args: { p_profile_id: string; p_season_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
