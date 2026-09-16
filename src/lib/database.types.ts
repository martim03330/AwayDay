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
      fan_group: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invite_code: string
          name: string
          ride_id: string | null
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_code: string
          name: string
          ride_id?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_code?: string
          name?: string
          ride_id?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fan_group_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fan_group_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride"
            referencedColumns: ["id"]
          },
        ]
      }
      fan_group_member: {
        Row: {
          group_id: string
          joined_at: string
          profile_id: string
          role: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          profile_id: string
          role?: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "fan_group_member_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "fan_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fan_group_member_profile_id_fkey"
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
      friendship: {
        Row: {
          addressee_id: string
          created_at: string
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          requester_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendship_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendship_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invite: {
        Row: {
          created_at: string
          group_id: string
          invited_by: string | null
          profile_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          invited_by?: string | null
          profile_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          invited_by?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invite_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "fan_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invite_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invite_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      home_fan_cell: {
        Row: {
          cell_latitude: number
          cell_longitude: number
          fixtures: number
          last_seen_at: string
          reporters: number
          venue_id: string
        }
        Insert: {
          cell_latitude: number
          cell_longitude: number
          fixtures?: number
          last_seen_at?: string
          reporters?: number
          venue_id: string
        }
        Update: {
          cell_latitude?: number
          cell_longitude?: number
          fixtures?: number
          last_seen_at?: string
          reporters?: number
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_fan_cell_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue"
            referencedColumns: ["id"]
          },
        ]
      }
      home_fan_report: {
        Row: {
          cell_latitude: number
          cell_longitude: number
          created_at: string
          fixture_id: string
          reporter_id: string
        }
        Insert: {
          cell_latitude: number
          cell_longitude: number
          created_at?: string
          fixture_id: string
          reporter_id: string
        }
        Update: {
          cell_latitude?: number
          cell_longitude?: number
          created_at?: string
          fixture_id?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_fan_report_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixture"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_fan_report_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      home_fan_rollup: {
        Row: {
          done_at: string
          fixture_id: string
        }
        Insert: {
          done_at?: string
          fixture_id: string
        }
        Update: {
          done_at?: string
          fixture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_fan_rollup_fixture_id_fkey"
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
          capacity: number | null
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
          osm_id: string | null
          price_note: string | null
          source: string
          sources: Json
          venue_id: string
        }
        Insert: {
          address?: string | null
          capacity?: number | null
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
          osm_id?: string | null
          price_note?: string | null
          source?: string
          sources: Json
          venue_id: string
        }
        Update: {
          address?: string | null
          capacity?: number | null
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
          osm_id?: string | null
          price_note?: string | null
          source?: string
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
          fan_note: string | null
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
          suggested_at: string | null
          suggested_by: string | null
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
          fan_note?: string | null
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
          suggested_at?: string | null
          suggested_by?: string | null
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
          fan_note?: string | null
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
          suggested_at?: string | null
          suggested_by?: string | null
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
            foreignKeyName: "place_suggested_by_fkey"
            columns: ["suggested_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
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
          moderated_at: string | null
          moderated_by: string | null
          place_id: string
          status: string
          storage_path: string
          submitted_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          place_id: string
          status?: string
          storage_path: string
          submitted_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          place_id?: string
          status?: string
          storage_path?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "place_photo_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
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
          accepts_return_requests: boolean
          cancelled_at: string | null
          consumption_cl_per_100km: number
          created_at: string
          departure_at: string
          distance_m: number
          driver_id: string
          duration_s: number
          fixture_id: string
          fuel_cents: number
          fuel_price_milli_per_litre: number
          group_id: string | null
          id: string
          note: string | null
          origin: unknown
          origin_city: string | null
          origin_name: string
          parking_spot_id: string | null
          round_trip: boolean
          route_option: string
          rules_accepted_at: string
          seats_offered: number
          settled_at: string | null
          status: string
          toll_cents: number
          toll_m: number
          total_cents: number
          updated_at: string
          visibility: string
        }
        Insert: {
          accepts_return_requests?: boolean
          cancelled_at?: string | null
          consumption_cl_per_100km: number
          created_at?: string
          departure_at: string
          distance_m: number
          driver_id: string
          duration_s: number
          fixture_id: string
          fuel_cents: number
          fuel_price_milli_per_litre: number
          group_id?: string | null
          id?: string
          note?: string | null
          origin: unknown
          origin_city?: string | null
          origin_name: string
          parking_spot_id?: string | null
          round_trip: boolean
          route_option: string
          rules_accepted_at?: string
          seats_offered: number
          settled_at?: string | null
          status?: string
          toll_cents: number
          toll_m: number
          total_cents: number
          updated_at?: string
          visibility?: string
        }
        Update: {
          accepts_return_requests?: boolean
          cancelled_at?: string | null
          consumption_cl_per_100km?: number
          created_at?: string
          departure_at?: string
          distance_m?: number
          driver_id?: string
          duration_s?: number
          fixture_id?: string
          fuel_cents?: number
          fuel_price_milli_per_litre?: number
          group_id?: string | null
          id?: string
          note?: string | null
          origin?: unknown
          origin_city?: string | null
          origin_name?: string
          parking_spot_id?: string | null
          round_trip?: boolean
          route_option?: string
          rules_accepted_at?: string
          seats_offered?: number
          settled_at?: string | null
          status?: string
          toll_cents?: number
          toll_m?: number
          total_cents?: number
          updated_at?: string
          visibility?: string
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
          {
            foreignKeyName: "ride_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "fan_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_parking_spot_id_fkey"
            columns: ["parking_spot_id"]
            isOneToOne: false
            referencedRelation: "parking_spot"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_attendance: {
        Row: {
          created_at: string
          reporter_id: string
          ride_id: string
          showed_up: boolean
          subject_id: string
        }
        Insert: {
          created_at?: string
          reporter_id: string
          ride_id: string
          showed_up: boolean
          subject_id: string
        }
        Update: {
          created_at?: string
          reporter_id?: string
          ride_id?: string
          showed_up?: boolean
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_attendance_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_attendance_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_attendance_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_incident: {
        Row: {
          created_at: string
          id: string
          note: string | null
          profile_id: string
          reason: string
          ride_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          profile_id: string
          reason: string
          ride_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          profile_id?: string
          reason?: string
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_incident_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_incident_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_incident_vote: {
        Row: {
          accept: boolean
          created_at: string
          incident_id: string
          voter_id: string
        }
        Insert: {
          accept: boolean
          created_at?: string
          incident_id: string
          voter_id: string
        }
        Update: {
          accept?: boolean
          created_at?: string
          incident_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_incident_vote_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "ride_incident"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_incident_vote_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_invite: {
        Row: {
          created_at: string
          invited_by: string | null
          profile_id: string
          ride_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          profile_id: string
          ride_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          profile_id?: string
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_invite_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_invite_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_invite_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_outcome: {
        Row: {
          created_at: string
          outcome: string
          profile_id: string
          ride_id: string
          role: string
        }
        Insert: {
          created_at?: string
          outcome: string
          profile_id: string
          ride_id: string
          role: string
        }
        Update: {
          created_at?: string
          outcome?: string
          profile_id?: string
          ride_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_outcome_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_outcome_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_passenger: {
        Row: {
          created_at: string
          left_at: string | null
          profile_id: string
          ride_id: string
          rules_accepted_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          left_at?: string | null
          profile_id: string
          ride_id: string
          rules_accepted_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          left_at?: string | null
          profile_id?: string
          ride_id?: string
          rules_accepted_at?: string | null
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
      ride_return_request: {
        Row: {
          answered_at: string | null
          created_at: string
          distance_to_car_m: number
          profile_id: string
          ride_id: string
          rules_accepted_at: string
          share_cents: number
          status: string
          updated_at: string
        }
        Insert: {
          answered_at?: string | null
          created_at?: string
          distance_to_car_m: number
          profile_id: string
          ride_id: string
          rules_accepted_at: string
          share_cents: number
          status?: string
          updated_at?: string
        }
        Update: {
          answered_at?: string | null
          created_at?: string
          distance_to_car_m?: number
          profile_id?: string
          ride_id?: string
          rules_accepted_at?: string
          share_cents?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_return_request_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_return_request_ride_id_fkey"
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
      stadium_visit: {
        Row: {
          created_at: string
          fixture_id: string | null
          profile_id: string
          venue_id: string
          visited_on: string
        }
        Insert: {
          created_at?: string
          fixture_id?: string | null
          profile_id: string
          venue_id: string
          visited_on: string
        }
        Update: {
          created_at?: string
          fixture_id?: string | null
          profile_id?: string
          venue_id?: string
          visited_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "stadium_visit_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixture"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stadium_visit_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stadium_visit_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue"
            referencedColumns: ["id"]
          },
        ]
      }
      stay_place: {
        Row: {
          created_at: string
          plan_id: string
          profile_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          plan_id: string
          profile_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          plan_id?: string
          profile_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stay_place_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "stay_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_place_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      stay_plan: {
        Row: {
          commitment: string
          created_at: string
          fixture_id: string
          group_id: string | null
          id: string
          listing_seen_on: string | null
          listing_url: string | null
          nights: number
          note: string | null
          profile_id: string
          spare_places: number
          status: string
          total_cents: number
          updated_at: string
          visibility: string
        }
        Insert: {
          commitment: string
          created_at?: string
          fixture_id: string
          group_id?: string | null
          id?: string
          listing_seen_on?: string | null
          listing_url?: string | null
          nights: number
          note?: string | null
          profile_id: string
          spare_places: number
          status?: string
          total_cents: number
          updated_at?: string
          visibility?: string
        }
        Update: {
          commitment?: string
          created_at?: string
          fixture_id?: string
          group_id?: string | null
          id?: string
          listing_seen_on?: string | null
          listing_url?: string | null
          nights?: number
          note?: string | null
          profile_id?: string
          spare_places?: number
          status?: string
          total_cents?: number
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "stay_plan_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixture"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_plan_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "fan_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_plan_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
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
      trip_expense: {
        Row: {
          category: string
          cents: number
          created_at: string
          created_by: string | null
          description: string
          id: string
          payer_id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          category: string
          cents: number
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          payer_id: string
          session_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          cents?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          payer_id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_expense_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expense_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expense_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "trip_session"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_expense_share: {
        Row: {
          expense_id: string
          profile_id: string
        }
        Insert: {
          expense_id: string
          profile_id: string
        }
        Update: {
          expense_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_expense_share_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "trip_expense"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expense_share_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_session: {
        Row: {
          created_at: string
          fixture_id: string
          group_id: string | null
          id: string
          opened_by: string | null
          ride_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fixture_id: string
          group_id?: string | null
          id?: string
          opened_by?: string | null
          ride_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fixture_id?: string
          group_id?: string | null
          id?: string
          opened_by?: string | null
          ride_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_session_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixture"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_session_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "fan_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_session_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_session_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_settlement: {
        Row: {
          cents: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          from_profile_id: string
          id: string
          session_id: string
          to_profile_id: string
          updated_at: string
        }
        Insert: {
          cents: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          from_profile_id: string
          id?: string
          session_id: string
          to_profile_id: string
          updated_at?: string
        }
        Update: {
          cents?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          from_profile_id?: string
          id?: string
          session_id?: string
          to_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_settlement_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_settlement_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_settlement_from_profile_id_fkey"
            columns: ["from_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_settlement_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "trip_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_settlement_to_profile_id_fkey"
            columns: ["to_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
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
      venue_street: {
        Row: {
          created_at: string
          id: string
          name: string
          osm_id: string
          path: unknown
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          osm_id: string
          path: unknown
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          osm_id?: string
          path?: unknown
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_street_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_friend_request: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
      accept_group_invite: { Args: { p_group_id: string }; Returns: undefined }
      accept_ride_invite: { Args: { p_ride_id: string }; Returns: undefined }
      add_trip_expense: {
        Args: {
          p_category: string
          p_cents: number
          p_description: string
          p_participants?: string[]
          p_payer_id?: string
          p_session_id: string
        }
        Returns: string
      }
      add_trip_settlement: {
        Args: {
          p_cents: number
          p_from_profile_id?: string
          p_session_id: string
          p_to_profile_id: string
        }
        Returns: string
      }
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
      answer_return_request: {
        Args: { p_accept: boolean; p_profile_id: string; p_ride_id: string }
        Returns: undefined
      }
      answer_ride_request: {
        Args: { p_accept: boolean; p_profile_id: string; p_ride_id: string }
        Returns: undefined
      }
      answer_stay_place: {
        Args: { p_accept: boolean; p_plan_id: string; p_profile_id: string }
        Returns: undefined
      }
      are_friends: {
        Args: { p_one: string; p_other: string }
        Returns: boolean
      }
      can_share_house: { Args: { p_profile_id: string }; Returns: boolean }
      cancel_return_request: { Args: { p_ride_id: string }; Returns: undefined }
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
      confirm_trip_settlement: {
        Args: { p_settlement_id: string }
        Returns: undefined
      }
      create_group: { Args: { p_name: string }; Returns: string }
      decline_group_invite: { Args: { p_group_id: string }; Returns: undefined }
      decline_ride_invite: { Args: { p_ride_id: string }; Returns: undefined }
      delete_old_home_fan_reports: { Args: never; Returns: number }
      delete_old_stay_plans: { Args: never; Returns: number }
      delete_stale_fan_places: { Args: never; Returns: number }
      end_checkin: {
        Args: { p_place_id: string; p_profile_id: string }
        Returns: boolean
      }
      expire_ride_requests: { Args: never; Returns: number }
      fixture_going_count: { Args: { p_fixture_id: string }; Returns: number }
      fixture_needs_stay: { Args: { p_fixture_id: string }; Returns: boolean }
      fixture_stay_plans: {
        Args: { p_fixture_id: string }
        Returns: {
          commitment: string
          display_name: string
          group_id: string
          group_name: string
          id: string
          is_mine: boolean
          listing_seen_on: string
          listing_url: string
          member_since: string
          my_status: string
          nights: number
          note: string
          pending: number
          rides_completed: number
          rides_faults: number
          share_full_cents: number
          share_now_cents: number
          spare_places: number
          status: string
          taken: number
          total_cents: number
          updated_on: string
          visibility: string
        }[]
      }
      friendship_states: {
        Args: { p_profile_ids: string[] }
        Returns: {
          profile_id: string
          state: string
        }[]
      }
      group_by_code: {
        Args: { p_code: string }
        Returns: {
          already_in: boolean
          id: string
          members: number
          name: string
        }[]
      }
      group_members: {
        Args: { p_group_id: string }
        Returns: {
          display_name: string
          is_mine: boolean
          member_since: string
          profile_id: string
          rides_completed: number
          rides_faults: number
          role: string
        }[]
      }
      group_plans: {
        Args: { p_group_id: string }
        Returns: {
          departure_at: string
          fixture_id: string
          id: string
          is_mine: boolean
          kickoff_at: string
          kind: string
          my_status: string
          owner_name: string
          seats_total: number
          share_now_cents: number
          status: string
          taken: number
          visibility: string
        }[]
      }
      group_trips: {
        Args: { p_group_id: string }
        Returns: {
          expenses: number
          fixture_id: string
          houses: number
          kickoff_at: string
          rides: number
          seats_taken: number
          total_cents: number
        }[]
      }
      have_crossed_paths: {
        Args: { p_one: string; p_other: string }
        Returns: boolean
      }
      home_fan_usual_streets: {
        Args: { p_venue_id: string }
        Returns: {
          fixtures: number
          name: string
          path: Json
        }[]
      }
      home_fan_zones: {
        Args: { p_fixture_id: string }
        Returns: {
          latitude: number
          longitude: number
          reporters: number
        }[]
      }
      in_ride: {
        Args: { p_profile_id: string; p_ride_id: string }
        Returns: boolean
      }
      invite_friend_to_group: {
        Args: { p_group_id: string; p_profile_id: string }
        Returns: undefined
      }
      invite_friend_to_ride: {
        Args: { p_profile_id: string; p_ride_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_group_member: {
        Args: { p_group_id: string; p_profile_id: string }
        Returns: boolean
      }
      is_trip_member: {
        Args: { p_profile_id: string; p_session_id: string }
        Returns: boolean
      }
      join_group_with_code: { Args: { p_code: string }; Returns: string }
      leave_group: { Args: { p_group_id: string }; Returns: undefined }
      leave_ride: { Args: { p_ride_id: string }; Returns: undefined }
      leave_stay_place: { Args: { p_plan_id: string }; Returns: undefined }
      mark_stay_house: {
        Args: { p_booked: boolean; p_plan_id: string }
        Returns: undefined
      }
      moderate_place_photo: {
        Args: { p_approve: boolean; p_photo_id: string }
        Returns: undefined
      }
      my_friend_requests: {
        Args: never
        Returns: {
          asked_at: string
          direction: string
          display_name: string
          profile_id: string
          trips_together: number
        }[]
      }
      my_friends: {
        Args: never
        Returns: {
          display_name: string
          friends_since: string
          profile_id: string
          trips_together: number
        }[]
      }
      my_group_invites: {
        Args: never
        Returns: {
          group_id: string
          group_name: string
          invited_at: string
          invited_by_name: string
          members: number
        }[]
      }
      my_groups: {
        Args: never
        Returns: {
          created_on: string
          id: string
          invite_code: string
          members: number
          name: string
          role: string
          source: string
        }[]
      }
      my_live_trips: {
        Args: never
        Returns: {
          departure_at: string
          driver_name: string
          expenses: number
          fixture_id: string
          i_drive: boolean
          kickoff_at: string
          my_balance_cents: number
          people: number
          people_names: string[]
          ride_id: string
          session_id: string
          total_cents: number
        }[]
      }
      my_ride_alerts: {
        Args: never
        Returns: {
          departure_at: string
          driver_name: string
          fixture_id: string
          kind: string
          pending: number
          requests_close_at: string
          ride_id: string
        }[]
      }
      my_ride_attendance: {
        Args: { p_ride_id: string }
        Returns: {
          showed_up: boolean
          subject_id: string
        }[]
      }
      my_ride_invites: {
        Args: never
        Returns: {
          departure_at: string
          driver_name: string
          fixture_id: string
          invited_at: string
          kickoff_at: string
          origin_name: string
          ride_id: string
          seats_left: number
          share_cents: number
        }[]
      }
      my_rides: {
        Args: never
        Returns: {
          departure_at: string
          fixture_id: string
          id: string
          origin_name: string
          role: string
          status: string
        }[]
      }
      my_stadium_stamps: {
        Args: never
        Returns: {
          last_visit: string
          venue_id: string
          visits: number
        }[]
      }
      my_trip_accounts: {
        Args: { p_fixture_id: string }
        Returns: {
          expenses: number
          kind: string
          my_balance_cents: number
          owner_id: string
          people: number
          people_names: string[]
          session_id: string
          title: string
          total_cents: number
        }[]
      }
      my_trip_history: {
        Args: never
        Returns: {
          companion_names: string[]
          companions: number
          expenses: number
          fixture_id: string
          kickoff_at: string
          my_balance_cents: number
          total_cents: number
        }[]
      }
      new_invite_code: { Args: never; Returns: string }
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
      open_ride_trip_session: { Args: { p_ride_id: string }; Returns: string }
      open_trip_session: {
        Args: { p_fixture_id: string; p_group_id: string }
        Returns: string
      }
      place_name_key: { Args: { p_name: string }; Returns: string }
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
      remove_friend: { Args: { p_profile_id: string }; Returns: undefined }
      remove_group_member: {
        Args: { p_group_id: string; p_profile_id: string }
        Returns: undefined
      }
      remove_stay_plan: { Args: { p_fixture_id: string }; Returns: undefined }
      remove_trip_expense: {
        Args: { p_expense_id: string }
        Returns: undefined
      }
      remove_trip_settlement: {
        Args: { p_settlement_id: string }
        Returns: undefined
      }
      rename_group: {
        Args: { p_group_id: string; p_name: string }
        Returns: undefined
      }
      report_home_fans: {
        Args: { p_fixture_id: string; p_latitude: number; p_longitude: number }
        Returns: undefined
      }
      report_ride_attendance: {
        Args: { p_ride_id: string; p_showed_up: boolean; p_subject_id: string }
        Returns: undefined
      }
      report_ride_incident: {
        Args: { p_note: string; p_reason: string; p_ride_id: string }
        Returns: undefined
      }
      request_return_seat: {
        Args: {
          p_accept_rules: boolean
          p_latitude: number
          p_longitude: number
          p_ride_id: string
        }
        Returns: undefined
      }
      request_ride_seat: {
        Args: { p_accept_rules: boolean; p_ride_id: string }
        Returns: undefined
      }
      request_stay_place: { Args: { p_plan_id: string }; Returns: undefined }
      ride_ban_until: { Args: { p_profile_id: string }; Returns: string }
      ride_board: {
        Args: { p_fixture_id: string }
        Returns: {
          accepts_return_requests: boolean
          departure_at: string
          distance_m: number
          driver_completed: number
          driver_faults: number
          driver_id: string
          driver_is_friend: boolean
          driver_name: string
          duration_s: number
          fuel_cents: number
          group_id: string
          group_name: string
          id: string
          is_mine: boolean
          my_status: string
          note: string
          origin_city: string
          origin_latitude: number
          origin_longitude: number
          origin_name: string
          parking_distance_m: number
          parking_latitude: number
          parking_longitude: number
          parking_name: string
          requests_close_at: string
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
          visibility: string
        }[]
      }
      ride_incidents: {
        Args: { p_ride_id: string }
        Returns: {
          accepts: number
          created_at: string
          display_name: string
          id: string
          my_vote: boolean
          note: string
          profile_id: string
          reason: string
          rejects: number
        }[]
      }
      ride_people: {
        Args: { p_ride_id: string }
        Returns: {
          completed: number
          display_name: string
          faults: number
          is_driver: boolean
          profile_id: string
          status: string
        }[]
      }
      ride_reputation: {
        Args: { p_profile_ids: string[] }
        Returns: {
          banned_until: string
          completed: number
          excused: number
          faults: number
          profile_id: string
        }[]
      }
      ride_requests_close_at: {
        Args: { p_departure_at: string }
        Returns: string
      }
      ride_return_board: {
        Args: { p_fixture_id: string }
        Returns: {
          driver_completed: number
          driver_faults: number
          driver_name: string
          my_status: string
          origin_city: string
          origin_name: string
          parking_latitude: number
          parking_longitude: number
          parking_name: string
          price_cents: number
          ride_id: string
          seats_left: number
        }[]
      }
      ride_return_closes_at: { Args: { p_kickoff: string }; Returns: string }
      ride_return_opens_at: { Args: { p_kickoff: string }; Returns: string }
      ride_return_people: {
        Args: { p_ride_id: string }
        Returns: {
          completed: number
          display_name: string
          distance_to_car_m: number
          faults: number
          profile_id: string
          share_cents: number
          status: string
        }[]
      }
      ride_return_people_count: { Args: { p_ride_id: string }; Returns: number }
      ride_return_share_cents: {
        Args: { p_people: number; p_total_cents: number }
        Returns: number
      }
      ride_role: {
        Args: { p_profile_id: string; p_ride_id: string }
        Returns: string
      }
      ride_share_cents: {
        Args: { p_people: number; p_total_cents: number }
        Returns: number
      }
      ride_trip_session: {
        Args: { p_ride_id: string }
        Returns: {
          expenses: number
          fixture_id: string
          id: string
          total_cents: number
        }[]
      }
      roll_up_home_fan_reports: { Args: never; Returns: number }
      rotate_group_invite: { Args: { p_group_id: string }; Returns: string }
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
      send_friend_request: { Args: { p_profile_id: string }; Returns: string }
      set_ride_group: {
        Args: { p_group_id?: string; p_ride_id: string }
        Returns: undefined
      }
      set_ride_return_requests: {
        Args: { p_accepts: boolean; p_ride_id: string }
        Returns: undefined
      }
      set_ride_visibility: {
        Args: { p_public: boolean; p_ride_id: string }
        Returns: undefined
      }
      set_stay_group: {
        Args: { p_group_id?: string; p_plan_id: string }
        Returns: undefined
      }
      set_stay_plan:
        | {
            Args: {
              p_cents_per_person: number
              p_commitment?: string
              p_fixture_id: string
              p_kind: string
              p_nights: number
              p_note?: string
              p_spare_places?: number
            }
            Returns: string
          }
        | {
            Args: {
              p_commitment: string
              p_fixture_id: string
              p_listing_url?: string
              p_nights: number
              p_note?: string
              p_spare_places: number
              p_total_cents: number
            }
            Returns: string
          }
      set_stay_visibility: {
        Args: { p_plan_id: string; p_public: boolean }
        Returns: undefined
      }
      settle_rides: { Args: never; Returns: number }
      stadium_ranking: {
        Args: { p_limit?: number }
        Returns: {
          display_name: string
          is_me: boolean
          profile_id: string
          stadiums: number
          visits: number
        }[]
      }
      stadium_stamp_window: { Args: { p_kickoff: string }; Returns: unknown }
      stamp_stadium: {
        Args: { p_fixture_id: string; p_latitude: number; p_longitude: number }
        Returns: number
      }
      start_checkin: {
        Args: { p_place_id: string; p_profile_id: string }
        Returns: Json
      }
      stay_people_count: { Args: { p_plan_id: string }; Returns: number }
      stay_place_people: {
        Args: { p_plan_id: string }
        Returns: {
          display_name: string
          is_mine: boolean
          member_since: string
          profile_id: string
          rides_completed: number
          rides_faults: number
          status: string
        }[]
      }
      stay_share_cents: {
        Args: { p_people: number; p_total_cents: number }
        Returns: number
      }
      suggest_place: {
        Args: {
          p_kind: string
          p_latitude: number
          p_longitude: number
          p_name: string
          p_note: string
        }
        Returns: string
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
      trip_balances: {
        Args: { p_session_id: string }
        Returns: {
          balance_cents: number
          display_name: string
          is_me: boolean
          owed_cents: number
          paid_cents: number
          profile_id: string
          settled_cents: number
        }[]
      }
      trip_companions: {
        Args: { p_fixture_id: string }
        Returns: {
          display_name: string
          profile_id: string
          state: string
          trips_together: number
        }[]
      }
      trip_expenses: {
        Args: { p_session_id: string }
        Returns: {
          category: string
          cents: number
          created_on: string
          description: string
          i_am_in: boolean
          id: string
          mine: boolean
          participant_names: string[]
          participants: number
          payer_id: string
          payer_name: string
        }[]
      }
      trip_people: {
        Args: { p_session_id: string }
        Returns: {
          display_name: string
          is_me: boolean
          profile_id: string
        }[]
      }
      trip_session_of: {
        Args: { p_fixture_id: string; p_group_id: string }
        Returns: {
          expenses: number
          id: string
          total_cents: number
        }[]
      }
      trip_session_people: {
        Args: { p_session_id: string }
        Returns: {
          profile_id: string
        }[]
      }
      trip_settlements: {
        Args: { p_session_id: string }
        Returns: {
          cents: number
          confirmed: boolean
          created_on: string
          from_name: string
          from_profile_id: string
          i_receive: boolean
          id: string
          mine: boolean
          to_name: string
          to_profile_id: string
        }[]
      }
      trips_together: {
        Args: { p_one: string; p_other: string }
        Returns: number
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
      vote_ride_incident: {
        Args: { p_accept: boolean; p_incident_id: string }
        Returns: undefined
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
