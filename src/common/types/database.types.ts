export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          name: string | null
          platform: string | null
          platform_account_id: string | null
          private_key: string
          public_key: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          name?: string | null
          platform?: string | null
          platform_account_id?: string | null
          private_key: string
          public_key?: string | null
          status?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          name?: string | null
          platform?: string | null
          platform_account_id?: string | null
          private_key?: string
          public_key?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_to_channel: {
        Row: {
          account_id: string
          channel_id: string
          created_at: string
          id: string
          index: number | null
          last_read: string | null
        }
        Insert: {
          account_id: string
          channel_id: string
          created_at?: string
          id?: string
          index?: number | null
          last_read?: string | null
        }
        Update: {
          account_id?: string
          channel_id?: string
          created_at?: string
          id?: string
          index?: number | null
          last_read?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_to_channel_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_to_channel_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "decrypted_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_to_channel_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channel"
            referencedColumns: ["id"]
          },
        ]
      }
      channel: {
        Row: {
          created_at: string
          data: Json | null
          description: string | null
          icon_url: string | null
          id: string
          name: string | null
          source: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          data?: Json | null
          description?: string | null
          icon_url?: string | null
          id?: string
          name?: string | null
          source?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          data?: Json | null
          description?: string | null
          icon_url?: string | null
          id?: string
          name?: string | null
          source?: string | null
          url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      decrypted_accounts: {
        Row: {
          created_at: string | null
          data: Json | null
          decrypted_private_key: string | null
          id: string | null
          name: string | null
          platform: string | null
          platform_account_id: string | null
          private_key: string | null
          public_key: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          decrypted_private_key?: never
          id?: string | null
          name?: string | null
          platform?: string | null
          platform_account_id?: string | null
          private_key?: string | null
          public_key?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          decrypted_private_key?: never
          id?: string | null
          name?: string | null
          platform?: string | null
          platform_account_id?: string | null
          private_key?: string | null
          public_key?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_account_of_user: {
        Args: {
          _user_id: string
          _account_id: string
        }
        Returns: boolean
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

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
