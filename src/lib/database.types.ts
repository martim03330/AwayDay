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
      checkin: {
        Row: {
          club_id: string | null
          created_at: string
          ended_at: string | null
          expires_at: string
          id: string
          place_id: string
          place_visit_id: string | null
          profile_id: string
        }
        Insert: {
          club_id?: string | null
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          place_id: string
          place_visit_id?: string | null
          profile_id: string
        }
        Update: {
          club_id?: string | null
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          place_id?: string
          place_visit_id?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_place_visit_id_fkey"
            columns: ["place_visit_id"]
            isOneToOne: false
            referencedRelation: "place_visit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      club: {
        Row: {
          abbreviation: string
          country: string
          created_at: string
          european_venue_id: string | null
          football_data_id: number | null
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
          european_venue_id?: string | null
          football_data_id?: number | null
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
          european_venue_id?: string | null
          football_data_id?: number | null
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
            foreignKeyName: "club_european_venue_id_fkey"
            columns: ["european_venue_id"]
            isOneToOne: false
            referencedRelation: "venue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_home_venue_id_fkey"
            columns: ["home_venue_id"]
            isOneToOne: false
            referencedRelation: "venue"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_state: {
        Row: {
          created_at: string
          last_message_at: string | null
          last_opened_at: string | null
          last_passport_count: number | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          last_message_at?: string | null
          last_opened_at?: string | null
          last_passport_count?: number | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          last_message_at?: string | null
          last_opened_at?: string | null
          last_passport_count?: number | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_state_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profile"
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
      dish: {
        Row: {
          checked_on: string | null
          created_at: string
          currency: string
          id: string
          is_specialty: boolean
          name: string
          place_id: string
          prep_minutes: number | null
          price_cents: number | null
          recommendations_count: number
          source_url: string | null
          status: string
          submitted_by: string | null
          temperature: string | null
          updated_at: string
        }
        Insert: {
          checked_on?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_specialty?: boolean
          name: string
          place_id: string
          prep_minutes?: number | null
          price_cents?: number | null
          recommendations_count?: number
          source_url?: string | null
          status?: string
          submitted_by?: string | null
          temperature?: string | null
          updated_at?: string
        }
        Update: {
          checked_on?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_specialty?: boolean
          name?: string
          place_id?: string
          prep_minutes?: number | null
          price_cents?: number | null
          recommendations_count?: number
          source_url?: string | null
          status?: string
          submitted_by?: string | null
          temperature?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      dish_recommendation: {
        Row: {
          created_at: string
          dish_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          dish_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          dish_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dish_recommendation_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dish"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_recommendation_profile_id_fkey"
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
          kickoff_confirmed: boolean
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
          kickoff_confirmed?: boolean
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
          kickoff_confirmed?: boolean
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
          place_id: string | null
          profile_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fixture_id: string
          place_id?: string | null
          profile_id: string
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fixture_id?: string
          place_id?: string | null
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
            foreignKeyName: "fixture_attendance_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place"
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
      fixture_meeting_point: {
        Row: {
          address: string
          created_at: string
          fixture_id: string
          latitude: number | null
          longitude: number | null
          name: string
          note: string | null
          origin: string
          published_by: string
          published_on: string
          schedule: string
          source_title: string
          source_url: string
          transport: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          fixture_id: string
          latitude?: number | null
          longitude?: number | null
          name: string
          note?: string | null
          origin: string
          published_by: string
          published_on: string
          schedule: string
          source_title: string
          source_url: string
          transport: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          fixture_id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          note?: string | null
          origin?: string
          published_by?: string
          published_on?: string
          schedule?: string
          source_title?: string
          source_url?: string
          transport?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixture_meeting_point_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: true
            referencedRelation: "fixture"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_point_draft: {
        Row: {
          club_id: string
          decided_at: string | null
          decided_by: string | null
          excerpt: string
          fixture_id: string
          found_at: string
          id: string
          source_title: string
          source_url: string
          status: string
        }
        Insert: {
          club_id: string
          decided_at?: string | null
          decided_by?: string | null
          excerpt: string
          fixture_id: string
          found_at?: string
          id?: string
          source_title: string
          source_url: string
          status?: string
        }
        Update: {
          club_id?: string
          decided_at?: string | null
          decided_by?: string | null
          excerpt?: string
          fixture_id?: string
          found_at?: string
          id?: string
          source_title?: string
          source_url?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_point_draft_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_point_draft_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_point_draft_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixture"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_photo: {
        Row: {
          fixture_id: string | null
          mission_id: string
          profile_id: string
          storage_path: string
          taken_at: string
          venue_id: string | null
          verified: boolean
        }
        Insert: {
          fixture_id?: string | null
          mission_id: string
          profile_id: string
          storage_path: string
          taken_at?: string
          venue_id?: string | null
          verified?: boolean
        }
        Update: {
          fixture_id?: string | null
          mission_id?: string
          profile_id?: string
          storage_path?: string
          taken_at?: string
          venue_id?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "mission_photo_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixture"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_photo_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_photo_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue"
            referencedColumns: ["id"]
          },
        ]
      }
      noise_measurement: {
        Row: {
          fixture_id: string
          id: string
          level: number
          measured_at: string
          profile_id: string
        }
        Insert: {
          fixture_id: string
          id?: string
          level: number
          measured_at?: string
          profile_id: string
        }
        Update: {
          fixture_id?: string
          id?: string
          level?: number
          measured_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "noise_measurement_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixture"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "noise_measurement_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preference: {
        Row: {
          enabled: boolean
          kind: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          enabled: boolean
          kind: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          kind?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preference_profile_id_fkey"
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
          context_key: string | null
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
          context_key?: string | null
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
          context_key?: string | null
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
      parking_spot: {
        Row: {
          address: string | null
          checked_on: string
          confidence: string
          created_at: string
          distance_m: number | null
          id: string
          kind: string
          latitude: number | null
          location: unknown
          longitude: number | null
          name: string
          note: string | null
          open_on_matchdays: boolean | null
          operator: string | null
          price_note: string | null
          sources: Json
          venue_id: string
        }
        Insert: {
          address?: string | null
          checked_on: string
          confidence: string
          created_at?: string
          distance_m?: number | null
          id?: string
          kind: string
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          name: string
          note?: string | null
          open_on_matchdays?: boolean | null
          operator?: string | null
          price_note?: string | null
          sources: Json
          venue_id: string
        }
        Update: {
          address?: string | null
          checked_on?: string
          confidence?: string
          created_at?: string
          distance_m?: number | null
          id?: string
          kind?: string
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          name?: string
          note?: string | null
          open_on_matchdays?: boolean | null
          operator?: string | null
          price_note?: string | null
          sources?: Json
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parking_spot_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue"
            referencedColumns: ["id"]
          },
        ]
      }
      place: {
        Row: {
          attribution: string | null
          confirmation: string
          created_at: string
          distance_m: number
          home_fans_heavy: boolean | null
          id: string
          kind: string
          latitude: number | null
          location: unknown
          longitude: number | null
          matchday_note: string | null
          matchday_sources: Json
          name: string
          name_article: string
          opening_hours: string | null
          osm_id: string | null
          photo_author: string | null
          photo_license: string | null
          photo_source_url: string | null
          photo_url: string | null
          price_level: number | null
          quick_and_cheap: boolean
          rejection_reason: string | null
          source: string
          specialty: string | null
          suitability: number
          toilet_no: number
          toilet_yes: number
          updated_at: string
          venue_id: string
          votes_no: number
          votes_yes: number
          walking_minutes: number
        }
        Insert: {
          attribution?: string | null
          confirmation?: string
          created_at?: string
          distance_m: number
          home_fans_heavy?: boolean | null
          id: string
          kind: string
          latitude?: number | null
          location: unknown
          longitude?: number | null
          matchday_note?: string | null
          matchday_sources?: Json
          name: string
          name_article: string
          opening_hours?: string | null
          osm_id?: string | null
          photo_author?: string | null
          photo_license?: string | null
          photo_source_url?: string | null
          photo_url?: string | null
          price_level?: number | null
          quick_and_cheap?: boolean
          rejection_reason?: string | null
          source?: string
          specialty?: string | null
          suitability?: number
          toilet_no?: number
          toilet_yes?: number
          updated_at?: string
          venue_id: string
          votes_no?: number
          votes_yes?: number
          walking_minutes: number
        }
        Update: {
          attribution?: string | null
          confirmation?: string
          created_at?: string
          distance_m?: number
          home_fans_heavy?: boolean | null
          id?: string
          kind?: string
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          matchday_note?: string | null
          matchday_sources?: Json
          name?: string
          name_article?: string
          opening_hours?: string | null
          osm_id?: string | null
          photo_author?: string | null
          photo_license?: string | null
          photo_source_url?: string | null
          photo_url?: string | null
          price_level?: number | null
          quick_and_cheap?: boolean
          rejection_reason?: string | null
          source?: string
          specialty?: string | null
          suitability?: number
          toilet_no?: number
          toilet_yes?: number
          updated_at?: string
          venue_id?: string
          votes_no?: number
          votes_yes?: number
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
      place_candidate: {
        Row: {
          decision: string
          distance_m: number
          imported_at: string
          location: unknown
          name: string
          notes: string | null
          osm_id: string
          osm_tags: Json
          suggested_kind: string | null
          venue_id: string
          walking_minutes: number
        }
        Insert: {
          decision?: string
          distance_m: number
          imported_at?: string
          location: unknown
          name: string
          notes?: string | null
          osm_id: string
          osm_tags?: Json
          suggested_kind?: string | null
          venue_id: string
          walking_minutes: number
        }
        Update: {
          decision?: string
          distance_m?: number
          imported_at?: string
          location?: unknown
          name?: string
          notes?: string | null
          osm_id?: string
          osm_tags?: Json
          suggested_kind?: string | null
          venue_id?: string
          walking_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "place_candidate_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue"
            referencedColumns: ["id"]
          },
        ]
      }
      place_photo: {
        Row: {
          created_at: string
          id: string
          place_id: string
          status: string
          storage_path: string
          submitted_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          place_id: string
          status?: string
          storage_path: string
          submitted_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          place_id?: string
          status?: string
          storage_path?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "place_photo_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_photo_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      place_pulse: {
        Row: {
          clubs: Json
          others: number
          people: number
          place_id: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          clubs?: Json
          others?: number
          people: number
          place_id: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          clubs?: Json
          others?: number
          people?: number
          place_id?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_pulse_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_pulse_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue"
            referencedColumns: ["id"]
          },
        ]
      }
      place_rating: {
        Row: {
          beer_score: number | null
          created_at: string
          food_score: number | null
          place_id: string
          profile_id: string
          score: number
          updated_at: string
        }
        Insert: {
          beer_score?: number | null
          created_at?: string
          food_score?: number | null
          place_id: string
          profile_id: string
          score: number
          updated_at?: string
        }
        Update: {
          beer_score?: number | null
          created_at?: string
          food_score?: number | null
          place_id?: string
          profile_id?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_rating_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_rating_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      place_toilet_answer: {
        Row: {
          created_at: string
          has_toilet: boolean
          place_id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          has_toilet: boolean
          place_id: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          has_toilet?: boolean
          place_id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_toilet_answer_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_toilet_answer_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
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
      place_vote: {
        Row: {
          created_at: string
          is_good: boolean
          place_id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_good: boolean
          place_id: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_good?: boolean
          place_id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_vote_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "place"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_vote_profile_id_fkey"
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
          is_admin: boolean
          nudges_enabled: boolean
          recap_enabled: boolean
          show_in_rankings: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          is_admin?: boolean
          nudges_enabled?: boolean
          recap_enabled?: boolean
          show_in_rankings?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_admin?: boolean
          nudges_enabled?: boolean
          recap_enabled?: boolean
          show_in_rankings?: boolean
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
      rate_limit_hit: {
        Row: {
          bucket: string
          created_at: string
          id: number
          profile_id: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: never
          profile_id: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: never
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limit_hit_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      restroom: {
        Row: {
          access: string
          attribution: string
          distance_m: number
          fee: string
          id: string
          imported_at: string
          latitude: number | null
          location: unknown
          longitude: number | null
          name: string | null
          opening_hours: string | null
          osm_id: string
          venue_id: string
          walking_minutes: number
          wheelchair: string
        }
        Insert: {
          access?: string
          attribution?: string
          distance_m: number
          fee?: string
          id: string
          imported_at?: string
          latitude?: number | null
          location: unknown
          longitude?: number | null
          name?: string | null
          opening_hours?: string | null
          osm_id: string
          venue_id: string
          walking_minutes: number
          wheelchair?: string
        }
        Update: {
          access?: string
          attribution?: string
          distance_m?: number
          fee?: string
          id?: string
          imported_at?: string
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          name?: string | null
          opening_hours?: string | null
          osm_id?: string
          venue_id?: string
          walking_minutes?: number
          wheelchair?: string
        }
        Relationships: [
          {
            foreignKeyName: "restroom_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue"
            referencedColumns: ["id"]
          },
        ]
      }
      ride: {
        Row: {
          consumption_cl_per_100km: number
          created_at: string
          departure_at: string
          distance_m: number
          driver_id: string
          duration_s: number
          fixture_id: string
          fuel_cents: number
          fuel_price_milli_per_litre: number
          id: string
          note: string | null
          origin: unknown
          origin_name: string
          round_trip: boolean
          route_option: string
          seats_offered: number
          status: string
          toll_cents: number
          toll_m: number
          total_cents: number
          updated_at: string
        }
        Insert: {
          consumption_cl_per_100km: number
          created_at?: string
          departure_at: string
          distance_m: number
          driver_id: string
          duration_s: number
          fixture_id: string
          fuel_cents: number
          fuel_price_milli_per_litre: number
          id?: string
          note?: string | null
          origin: unknown
          origin_name: string
          round_trip: boolean
          route_option: string
          seats_offered: number
          status?: string
          toll_cents: number
          toll_m: number
          total_cents: number
          updated_at?: string
        }
        Update: {
          consumption_cl_per_100km?: number
          created_at?: string
          departure_at?: string
          distance_m?: number
          driver_id?: string
          duration_s?: number
          fixture_id?: string
          fuel_cents?: number
          fuel_price_milli_per_litre?: number
          id?: string
          note?: string | null
          origin?: unknown
          origin_name?: string
          round_trip?: boolean
          route_option?: string
          seats_offered?: number
          status?: string
          toll_cents?: number
          toll_m?: number
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixture"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_passenger: {
        Row: {
          created_at: string
          profile_id: string
          ride_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          ride_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          ride_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_passenger_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_passenger_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride"
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
      toll_rate: {
        Row: {
          checked_on: string
          motorway: string
          reference_cents: number
          reference_m: number
          reference_trip: string
          source_url: string
        }
        Insert: {
          checked_on: string
          motorway: string
          reference_cents: number
          reference_m: number
          reference_trip: string
          source_url: string
        }
        Update: {
          checked_on?: string
          motorway?: string
          reference_cents?: number
          reference_m?: number
          reference_trip?: string
          source_url?: string
        }
        Relationships: []
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
          photo_author: string | null
          photo_license: string | null
          photo_source_url: string | null
          photo_url: string | null
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
          photo_author?: string | null
          photo_license?: string | null
          photo_source_url?: string | null
          photo_url?: string | null
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
          photo_author?: string | null
          photo_license?: string | null
          photo_source_url?: string | null
          photo_url?: string | null
          region?: string
          roof_coverage?: string | null
          short_name?: string | null
          short_name_article?: string | null
        }
        Relationships: []
      }
      venue_parking: {
        Row: {
          checked_on: string
          summary: string | null
          summary_sources: Json
          venue_id: string
          warnings: Json
        }
        Insert: {
          checked_on: string
          summary?: string | null
          summary_sources?: Json
          venue_id: string
          warnings?: Json
        }
        Update: {
          checked_on?: string
          summary?: string | null
          summary_sources?: Json
          venue_id?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "venue_parking_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venue"
            referencedColumns: ["id"]
          },
        ]
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
      venue_safety_note: {
        Row: {
          created_at: string
          description: string
          id: string
          kind: string
          latitude: number | null
          longitude: number | null
          radius_m: number | null
          reference_date: string
          sources: Json
          title: string
          updated_at: string
          venue_id: string
          visiting_club_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id: string
          kind: string
          latitude?: number | null
          longitude?: number | null
          radius_m?: number | null
          reference_date: string
          sources: Json
          title: string
          updated_at?: string
          venue_id: string
          visiting_club_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          kind?: string
          latitude?: number | null
          longitude?: number | null
          radius_m?: number | null
          reference_date?: string
          sources?: Json
          title?: string
          updated_at?: string
          venue_id?: string
          visiting_club_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_safety_note_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_safety_note_visiting_club_id_fkey"
            columns: ["visiting_club_id"]
            isOneToOne: false
            referencedRelation: "club"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ai_usage_since: {
        Args: { p_profile_id: string; p_since: string }
        Returns: {
          nudge_input_tokens: number
          nudge_output_tokens: number
          profile_model_messages: number
          recap_input_tokens: number
          recap_output_tokens: number
        }[]
      }
      answer_ride_request: {
        Args: { p_accept: boolean; p_profile_id: string; p_ride_id: string }
        Returns: undefined
      }
      cancel_ride: { Args: { p_ride_id: string }; Returns: undefined }
      club_supporter_counts: {
        Args: never
        Returns: {
          club_id: string
          supporters: number
        }[]
      }
      coach_club_facts: { Args: { p_club_id: string }; Returns: Json }
      coach_context: {
        Args: { p_now?: string; p_profile_id: string }
        Returns: Json
      }
      coach_nearby_place: { Args: { p_venue_id: string }; Returns: Json }
      coach_push_candidates: {
        Args: { p_now?: string }
        Returns: {
          context: Json
          profile_id: string
        }[]
      }
      coach_venue_facts: { Args: { p_venue_id: string }; Returns: Json }
      confirm_place: { Args: { p_place_id: string }; Returns: undefined }
      end_checkin: {
        Args: { p_place_id: string; p_profile_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      leave_ride: { Args: { p_ride_id: string }; Returns: undefined }
      noise_ranking: {
        Args: { p_fixture_id: string; p_limit?: number }
        Returns: {
          club_id: string
          display_name: string
          is_me: boolean
          level: number
          rank_position: number
        }[]
      }
      place_scores: {
        Args: { p_venue_id: string }
        Returns: {
          beer_score: number
          food_score: number
          place_id: string
          ratings: number
          score: number
        }[]
      }
      place_scores_all: {
        Args: never
        Returns: {
          beer_score: number
          food_score: number
          place_id: string
          ratings: number
          score: number
        }[]
      }
      publish_place_candidate: {
        Args: {
          p_kind: string
          p_name_article: string
          p_osm_id: string
          p_place_id: string
          p_price_level?: number
          p_specialty?: string
        }
        Returns: undefined
      }
      record_noise_measurement: {
        Args: { p_fixture_id: string; p_level: number }
        Returns: {
          fixture_id: string
          id: string
          level: number
          measured_at: string
          profile_id: string
        }
        SetofOptions: {
          from: "*"
          to: "noise_measurement"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refresh_place_pulse: { Args: never; Returns: number }
      register_device_token: {
        Args: { p_platform: string; p_token: string }
        Returns: undefined
      }
      reject_place: { Args: { p_place_id: string }; Returns: undefined }
      request_ride_seat: { Args: { p_ride_id: string }; Returns: undefined }
      ride_board: {
        Args: { p_fixture_id: string }
        Returns: {
          departure_at: string
          distance_m: number
          driver_name: string
          duration_s: number
          fuel_cents: number
          id: string
          is_mine: boolean
          my_status: string
          note: string
          origin_latitude: number
          origin_longitude: number
          origin_name: string
          round_trip: boolean
          route_option: string
          seats_offered: number
          seats_taken: number
          share_full_cents: number
          share_now_cents: number
          status: string
          toll_cents: number
          toll_m: number
          total_cents: number
        }[]
      }
      ride_people: {
        Args: { p_ride_id: string }
        Returns: {
          display_name: string
          is_driver: boolean
          profile_id: string
          status: string
        }[]
      }
      ride_share_cents: {
        Args: { p_people: number; p_total_cents: number }
        Returns: number
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
      start_checkin: {
        Args: { p_place_id: string; p_profile_id: string }
        Returns: Json
      }
      suggest_place_candidates: { Args: never; Returns: number }
      take_rate_limit: {
        Args: {
          p_bucket: string
          p_limit: number
          p_profile_id: string
          p_window: string
        }
        Returns: boolean
      }
      verified_places_ranking: {
        Args: { p_limit?: number }
        Returns: {
          club_id: string
          display_name: string
          is_me: boolean
          rank_position: number
          verified_places: number
        }[]
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
