export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      post_groups: {
        Row: {
          created_at: string
          description: string | null
          id: number
          kind: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: never
          kind: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: never
          kind?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      post_tags: {
        Row: {
          post_id: number
          tag_id: number
        }
        Insert: {
          post_id: number
          tag_id: number
        }
        Update: {
          post_id?: number
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          archive_note: string | null
          archived_at: string | null
          body_markdown: string
          comments_enabled: boolean
          created_at: string
          group_id: number | null
          id: number
          kind: string
          published_at: string | null
          slug: string | null
          status: string
          summary: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          archive_note?: string | null
          archived_at?: string | null
          body_markdown?: string
          comments_enabled?: boolean
          created_at?: string
          group_id?: number | null
          id?: never
          kind: string
          published_at?: string | null
          slug?: string | null
          status?: string
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          archive_note?: string | null
          archived_at?: string | null
          body_markdown?: string
          comments_enabled?: boolean
          created_at?: string
          group_id?: number | null
          id?: never
          kind?: string
          published_at?: string | null
          slug?: string | null
          status?: string
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_group_kind_fkey"
            columns: ["group_id", "kind"]
            isOneToOne: false
            referencedRelation: "post_groups"
            referencedColumns: ["id", "kind"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ai_delete_model: {
        Args: { p_expected_revision: number; p_id: string }
        Returns: undefined
      }
      ai_list_configuration: { Args: never; Returns: Json }
      ai_model_snapshot: { Args: { p_id?: string }; Returns: Json }
      ai_save_model: {
        Args: {
          p_credential: Json
          p_expected_revision: number
          p_model: Json
          p_replace_credential: boolean
        }
        Returns: string
      }
      ai_update_settings: { Args: { p_patch: Json }; Returns: undefined }
      create_and_publish_post: {
        Args: {
          p_body_markdown: string
          p_expected_kind: string
          p_group_id: number
          p_slug: string
          p_summary: string
          p_tag_ids?: number[]
          p_title: string
        }
        Returns: {
          archive_note: string | null
          archived_at: string | null
          body_markdown: string
          comments_enabled: boolean
          created_at: string
          group_id: number | null
          id: number
          kind: string
          published_at: string | null
          slug: string | null
          status: string
          summary: string | null
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_post_draft: {
        Args: {
          p_body_markdown?: string
          p_group_id?: number
          p_kind: string
          p_slug?: string
          p_summary?: string
          p_tag_ids?: number[]
          p_title?: string
        }
        Returns: {
          archive_note: string | null
          archived_at: string | null
          body_markdown: string
          comments_enabled: boolean
          created_at: string
          group_id: number | null
          id: number
          kind: string
          published_at: string | null
          slug: string | null
          status: string
          summary: string | null
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_post_group: {
        Args: {
          p_description?: string
          p_kind: string
          p_name: string
          p_slug: string
        }
        Returns: {
          created_at: string
          description: string | null
          id: number
          kind: string
          name: string
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "post_groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_tag: {
        Args: { p_name: string }
        Returns: {
          created_at: string
          id: number
          name: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tags"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_post: {
        Args: {
          p_expected_kind: string
          p_expected_updated_at: string
          p_post_id: number
        }
        Returns: {
          archive_note: string | null
          archived_at: string | null
          body_markdown: string
          comments_enabled: boolean
          created_at: string
          group_id: number | null
          id: number
          kind: string
          published_at: string | null
          slug: string | null
          status: string
          summary: string | null
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_post_group: {
        Args: { p_expected_updated_at: string; p_group_id: number }
        Returns: {
          created_at: string
          description: string | null
          id: number
          kind: string
          name: string
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "post_groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_tag: {
        Args: { p_expected_updated_at: string; p_tag_id: number }
        Returns: {
          created_at: string
          id: number
          name: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tags"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_admin: { Args: never; Returns: boolean }
      publish_post: {
        Args: {
          p_body_markdown: string
          p_expected_kind: string
          p_expected_updated_at: string
          p_group_id: number
          p_new_group_name: string
          p_new_group_slug: string
          p_post_id: number
          p_slug: string
          p_summary: string
          p_tag_ids?: number[]
          p_title: string
        }
        Returns: {
          archive_note: string | null
          archived_at: string | null
          body_markdown: string
          comments_enabled: boolean
          created_at: string
          group_id: number | null
          id: number
          kind: string
          published_at: string | null
          slug: string | null
          status: string
          summary: string | null
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_post: {
        Args: {
          p_archive_note?: string
          p_expected_kind: string
          p_expected_updated_at: string
          p_post_id: number
          p_transition: string
        }
        Returns: {
          archive_note: string | null
          archived_at: string | null
          body_markdown: string
          comments_enabled: boolean
          created_at: string
          group_id: number | null
          id: number
          kind: string
          published_at: string | null
          slug: string | null
          status: string
          summary: string | null
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_post_content: {
        Args: {
          p_body_markdown?: string
          p_expected_updated_at: string
          p_group_id?: number
          p_post_id: number
          p_slug?: string
          p_summary?: string
          p_tag_ids?: number[]
          p_title?: string
        }
        Returns: {
          archive_note: string | null
          archived_at: string | null
          body_markdown: string
          comments_enabled: boolean
          created_at: string
          group_id: number | null
          id: number
          kind: string
          published_at: string | null
          slug: string | null
          status: string
          summary: string | null
          title: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_post_group: {
        Args: {
          p_description?: string
          p_expected_updated_at: string
          p_group_id: number
          p_name: string
        }
        Returns: {
          created_at: string
          description: string | null
          id: number
          kind: string
          name: string
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "post_groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_tag: {
        Args: {
          p_expected_updated_at: string
          p_name: string
          p_tag_id: number
        }
        Returns: {
          created_at: string
          id: number
          name: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tags"
          isOneToOne: true
          isSetofReturn: false
        }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

