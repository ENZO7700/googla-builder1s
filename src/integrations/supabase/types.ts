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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wp_about: {
        Row: {
          content_html: string | null
          created_at: string
          id: string
          image_url: string | null
          site_id: string
          subtitle: string | null
          title: string | null
          updated_at: string
          wp_post_id: number | null
        }
        Insert: {
          content_html?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          site_id: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
          wp_post_id?: number | null
        }
        Update: {
          content_html?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          site_id?: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string
          wp_post_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wp_about_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "wp_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      wp_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          error_message: string | null
          id: string
          resource_id: string | null
          resource_type: string | null
          site_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          resource_id?: string | null
          resource_type?: string | null
          site_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          resource_id?: string | null
          resource_type?: string | null
          site_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wp_audit_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "wp_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      wp_company_info: {
        Row: {
          address: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string | null
          phone: string | null
          site_id: string
          social: Json
          tagline: string | null
          updated_at: string
          vat_id: string | null
          wp_post_id: number | null
        }
        Insert: {
          address?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string | null
          phone?: string | null
          site_id: string
          social?: Json
          tagline?: string | null
          updated_at?: string
          vat_id?: string | null
          wp_post_id?: number | null
        }
        Update: {
          address?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string | null
          phone?: string | null
          site_id?: string
          social?: Json
          tagline?: string | null
          updated_at?: string
          vat_id?: string | null
          wp_post_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wp_company_info_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "wp_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      wp_footer: {
        Row: {
          columns: Json
          copyright: string | null
          created_at: string
          id: string
          legal_links: Json
          logo_url: string | null
          site_id: string
          updated_at: string
        }
        Insert: {
          columns?: Json
          copyright?: string | null
          created_at?: string
          id?: string
          legal_links?: Json
          logo_url?: string | null
          site_id: string
          updated_at?: string
        }
        Update: {
          columns?: Json
          copyright?: string | null
          created_at?: string
          id?: string
          legal_links?: Json
          logo_url?: string | null
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wp_footer_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "wp_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      wp_header: {
        Row: {
          created_at: string
          cta_label: string | null
          cta_url: string | null
          id: string
          logo_url: string | null
          menu: Json
          site_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          logo_url?: string | null
          menu?: Json
          site_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          logo_url?: string | null
          menu?: Json
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wp_header_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "wp_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      wp_inquiries: {
        Row: {
          created_at: string
          email: string | null
          form_slug: string
          id: string
          ip_hash: string | null
          message: string | null
          name: string | null
          payload: Json
          phone: string | null
          read: boolean
          site_id: string
          source_url: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          form_slug?: string
          id?: string
          ip_hash?: string | null
          message?: string | null
          name?: string | null
          payload?: Json
          phone?: string | null
          read?: boolean
          site_id: string
          source_url?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          form_slug?: string
          id?: string
          ip_hash?: string | null
          message?: string | null
          name?: string | null
          payload?: Json
          phone?: string | null
          read?: boolean
          site_id?: string
          source_url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wp_inquiries_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "wp_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      wp_inquiry_forms: {
        Row: {
          created_at: string
          fields: Json
          id: string
          name: string
          recipient_email: string | null
          site_id: string
          slug: string
          success_message: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fields?: Json
          id?: string
          name: string
          recipient_email?: string | null
          site_id: string
          slug: string
          success_message?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fields?: Json
          id?: string
          name?: string
          recipient_email?: string | null
          site_id?: string
          slug?: string
          success_message?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wp_inquiry_forms_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "wp_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      wp_members: {
        Row: {
          bio: string | null
          created_at: string
          email: string | null
          id: string
          link_url: string | null
          name: string
          order_index: number
          photo_url: string | null
          published: boolean
          role: string | null
          site_id: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          link_url?: string | null
          name: string
          order_index?: number
          photo_url?: string | null
          published?: boolean
          role?: string | null
          site_id: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          link_url?: string | null
          name?: string
          order_index?: number
          photo_url?: string | null
          published?: boolean
          role?: string | null
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wp_members_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "wp_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      wp_news: {
        Row: {
          content_html: string | null
          cover_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          order_index: number
          published: boolean
          published_at: string | null
          site_id: string
          slug: string | null
          title: string
          updated_at: string
          wp_post_id: number | null
        }
        Insert: {
          content_html?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          order_index?: number
          published?: boolean
          published_at?: string | null
          site_id: string
          slug?: string | null
          title: string
          updated_at?: string
          wp_post_id?: number | null
        }
        Update: {
          content_html?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          order_index?: number
          published?: boolean
          published_at?: string | null
          site_id?: string
          slug?: string | null
          title?: string
          updated_at?: string
          wp_post_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wp_news_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "wp_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      wp_references: {
        Row: {
          client_name: string | null
          completed_at: string | null
          created_at: string
          description_html: string | null
          id: string
          image_url: string | null
          link_url: string | null
          order_index: number
          project_title: string
          published: boolean
          site_id: string
          updated_at: string
          wp_post_id: number | null
        }
        Insert: {
          client_name?: string | null
          completed_at?: string | null
          created_at?: string
          description_html?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          order_index?: number
          project_title: string
          published?: boolean
          site_id: string
          updated_at?: string
          wp_post_id?: number | null
        }
        Update: {
          client_name?: string | null
          completed_at?: string | null
          created_at?: string
          description_html?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          order_index?: number
          project_title?: string
          published?: boolean
          site_id?: string
          updated_at?: string
          wp_post_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wp_references_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "wp_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      wp_services: {
        Row: {
          created_at: string
          description_html: string | null
          excerpt: string | null
          icon: string | null
          id: string
          image_url: string | null
          link_url: string | null
          order_index: number
          price: string | null
          published: boolean
          site_id: string
          slug: string | null
          title: string
          updated_at: string
          wp_post_id: number | null
        }
        Insert: {
          created_at?: string
          description_html?: string | null
          excerpt?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          order_index?: number
          price?: string | null
          published?: boolean
          site_id: string
          slug?: string | null
          title: string
          updated_at?: string
          wp_post_id?: number | null
        }
        Update: {
          created_at?: string
          description_html?: string | null
          excerpt?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          order_index?: number
          price?: string | null
          published?: boolean
          site_id?: string
          slug?: string | null
          title?: string
          updated_at?: string
          wp_post_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wp_services_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "wp_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      wp_sites: {
        Row: {
          app_password_encrypted: string | null
          base_url: string
          created_at: string
          id: string
          label: string
          last_sync_at: string | null
          site_type: string
          user_id: string
          username: string | null
        }
        Insert: {
          app_password_encrypted?: string | null
          base_url: string
          created_at?: string
          id?: string
          label: string
          last_sync_at?: string | null
          site_type: string
          user_id: string
          username?: string | null
        }
        Update: {
          app_password_encrypted?: string | null
          base_url?: string
          created_at?: string
          id?: string
          label?: string
          last_sync_at?: string | null
          site_type?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_wp_site_owner: { Args: { _site_id: string }; Returns: boolean }
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
    Enums: {},
  },
} as const
