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
      activity_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          attachments: Json
          body: string
          created_at: string
          created_by: string | null
          id: string
          pinned: boolean
          priority: Database["public"]["Enums"]["announcement_priority"]
          published_at: string | null
          scheduled_for: string | null
          title: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          pinned?: boolean
          priority?: Database["public"]["Enums"]["announcement_priority"]
          published_at?: string | null
          scheduled_for?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          pinned?: boolean
          priority?: Database["public"]["Enums"]["announcement_priority"]
          published_at?: string | null
          scheduled_for?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          banner_url: string | null
          id: boolean
          logo_url: string | null
          paid_leads_note: string | null
          paid_leads_price: number | null
          paid_leads_qr_url: string | null
          paid_leads_upi: string | null
          rewards_banner_url: string | null
          site_name: string | null
          tagline: string | null
          theme: string | null
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          id?: boolean
          logo_url?: string | null
          paid_leads_note?: string | null
          paid_leads_price?: number | null
          paid_leads_qr_url?: string | null
          paid_leads_upi?: string | null
          rewards_banner_url?: string | null
          site_name?: string | null
          tagline?: string | null
          theme?: string | null
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          id?: boolean
          logo_url?: string | null
          paid_leads_note?: string | null
          paid_leads_price?: number | null
          paid_leads_qr_url?: string | null
          paid_leads_upi?: string | null
          rewards_banner_url?: string | null
          site_name?: string | null
          tagline?: string | null
          theme?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          id: string
          is_late: boolean | null
          minutes_worked: number | null
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          id?: string
          is_late?: boolean | null
          minutes_worked?: number | null
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          id?: string
          is_late?: boolean | null
          minutes_worked?: number | null
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_details: {
        Row: {
          account_holder_name: string | null
          account_number: string | null
          bank_name: string | null
          created_at: string
          id: string
          ifsc_code: string | null
          updated_at: string
          upi_id: string
          user_id: string
        }
        Insert: {
          account_holder_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          ifsc_code?: string | null
          updated_at?: string
          upi_id: string
          user_id: string
        }
        Update: {
          account_holder_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          ifsc_code?: string | null
          updated_at?: string
          upi_id?: string
          user_id?: string
        }
        Relationships: []
      }
      brand_settings: {
        Row: {
          id: number
          logo_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          logo_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          logo_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      broker_legality: {
        Row: {
          broker_name: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_legal: boolean
          launched_year: string | null
          play_store_downloads: string | null
          play_store_rating: number | null
          play_store_url: string | null
          poster_path: string | null
          registration_no: string | null
          regulator: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          broker_name: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_legal?: boolean
          launched_year?: string | null
          play_store_downloads?: string | null
          play_store_rating?: number | null
          play_store_url?: string | null
          poster_path?: string | null
          registration_no?: string | null
          regulator?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          broker_name?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_legal?: boolean
          launched_year?: string | null
          play_store_downloads?: string | null
          play_store_rating?: number | null
          play_store_url?: string | null
          poster_path?: string | null
          registration_no?: string | null
          regulator?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      broker_reports: {
        Row: {
          broker: string
          broker_link_id: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          hr_id: string
          id: string
          mime_type: string | null
          notes: string | null
          sent_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          broker: string
          broker_link_id?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          hr_id: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          sent_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          broker?: string
          broker_link_id?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          hr_id?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          sent_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_reports_broker_link_id_fkey"
            columns: ["broker_link_id"]
            isOneToOne: false
            referencedRelation: "important_links"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reports: {
        Row: {
          broker: string | null
          client_name: string
          created_at: string
          created_by: string | null
          hr_id: string | null
          id: string
          income: number
          mobile: string | null
          notes: string | null
          opening_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          broker?: string | null
          client_name: string
          created_at?: string
          created_by?: string | null
          hr_id?: string | null
          id?: string
          income?: number
          mobile?: string | null
          notes?: string | null
          opening_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          broker?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          hr_id?: string | null
          id?: string
          income?: number
          mobile?: string | null
          notes?: string | null
          opening_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_income: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          body: string
          broadcast_scope: string | null
          created_at: string
          edited_at: string | null
          id: string
          read_at: string | null
          recipient_id: string | null
          sender_id: string
        }
        Insert: {
          body: string
          broadcast_scope?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          read_at?: string | null
          recipient_id?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          broadcast_scope?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      hr_profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          email: string
          full_name: string
          hr_code: string | null
          id: string
          mobile: string | null
          referral_code: string | null
          state: string | null
          status: Database["public"]["Enums"]["hr_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email: string
          full_name: string
          hr_code?: string | null
          id: string
          mobile?: string | null
          referral_code?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["hr_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string
          full_name?: string
          hr_code?: string | null
          id?: string
          mobile?: string | null
          referral_code?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["hr_status"]
          updated_at?: string
        }
        Relationships: []
      }
      important_links: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          help_video_url: string | null
          icon: string | null
          id: string
          is_active: boolean
          sort_order: number
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          help_video_url?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          help_video_url?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      income_overrides: {
        Row: {
          created_at: string
          id: string
          lifetime: number
          month: number
          today: number
          updated_at: string
          updated_by: string | null
          user_id: string
          week: number
        }
        Insert: {
          created_at?: string
          id?: string
          lifetime?: number
          month?: number
          today?: number
          updated_at?: string
          updated_by?: string | null
          user_id: string
          week?: number
        }
        Update: {
          created_at?: string
          id?: string
          lifetime?: number
          month?: number
          today?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          week?: number
        }
        Relationships: []
      }
      leaderboard_entries: {
        Row: {
          avatar_url: string | null
          badge: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          points: number
          sort_order: number
          subtitle: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          badge?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          points?: number
          sort_order?: number
          subtitle?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          badge?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          points?: number
          sort_order?: number
          subtitle?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          bucket: Database["public"]["Enums"]["lead_bucket"]
          created_at: string
          created_by: string | null
          id: string
          mobile: string
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          bucket?: Database["public"]["Enums"]["lead_bucket"]
          created_at?: string
          created_by?: string | null
          id?: string
          mobile: string
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          bucket?: Database["public"]["Enums"]["lead_bucket"]
          created_at?: string
          created_by?: string | null
          id?: string
          mobile?: string
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: []
      }
      legal_documents: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          is_active: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_status: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          link_url: string | null
          media_type: string
          media_url: string
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          media_type?: string
          media_url: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          media_type?: string
          media_url?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      paid_lead_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          fulfilled_at: string | null
          hr_id: string
          id: string
          leads_uploaded: number | null
          note: string | null
          quantity: number
          screenshot_url: string | null
          status: string
          updated_at: string
          utr: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          fulfilled_at?: string | null
          hr_id: string
          id?: string
          leads_uploaded?: number | null
          note?: string | null
          quantity: number
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          utr?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          fulfilled_at?: string | null
          hr_id?: string
          id?: string
          leads_uploaded?: number | null
          note?: string | null
          quantity?: number
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          utr?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      rewards: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          milestone_amount: number
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          milestone_amount?: number
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          milestone_amount?: number
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      special_offer_posters: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string
          is_active: boolean
          month_label: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          month_label?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          month_label?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          attachments: Json
          body: string
          created_at: string
          edited_at: string | null
          id: string
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Insert: {
          attachments?: Json
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          sender_id: string
          sender_role?: string
          ticket_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          sender_id?: string
          sender_role?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string | null
          created_at: string
          id: string
          last_message_at: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_rewards: {
        Row: {
          awarded_by: string | null
          id: string
          reward_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          awarded_by?: string | null
          id?: string
          reward_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          awarded_by?: string | null
          id?: string
          reward_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_rewards_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          type: Database["public"]["Enums"]["wallet_txn_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          type: Database["public"]["Enums"]["wallet_txn_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          type?: Database["public"]["Enums"]["wallet_txn_type"]
          user_id?: string
        }
        Relationships: []
      }
      withdraw_requests: {
        Row: {
          amount: number
          created_at: string
          details: Json | null
          id: string
          method: string | null
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["withdraw_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          details?: Json | null
          id?: string
          method?: string | null
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdraw_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          details?: Json | null
          id?: string
          method?: string | null
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdraw_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      work_videos: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          sort_order: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_admin_user_ids: {
        Args: never
        Returns: {
          user_id: string
        }[]
      }
      get_leaderboard: {
        Args: never
        Returns: {
          avatar_url: string
          bonus: number
          full_name: string
          hr_code: string
          id: string
          points: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      announcement_priority: "low" | "normal" | "high" | "urgent"
      app_role: "admin" | "hr"
      hr_status: "pending" | "approved" | "rejected" | "suspended"
      lead_bucket: "today" | "tomorrow" | "previous" | "open" | "pending"
      lead_status:
        | "new"
        | "assigned"
        | "calling"
        | "interested"
        | "not_interested"
        | "follow_up"
        | "joined"
        | "rejected"
      wallet_txn_type:
        | "salary"
        | "incentive"
        | "bonus"
        | "withdraw"
        | "adjustment"
      withdraw_status: "pending" | "approved" | "rejected" | "paid"
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
      announcement_priority: ["low", "normal", "high", "urgent"],
      app_role: ["admin", "hr"],
      hr_status: ["pending", "approved", "rejected", "suspended"],
      lead_bucket: ["today", "tomorrow", "previous", "open", "pending"],
      lead_status: [
        "new",
        "assigned",
        "calling",
        "interested",
        "not_interested",
        "follow_up",
        "joined",
        "rejected",
      ],
      wallet_txn_type: [
        "salary",
        "incentive",
        "bonus",
        "withdraw",
        "adjustment",
      ],
      withdraw_status: ["pending", "approved", "rejected", "paid"],
    },
  },
} as const
