export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '11.1.0 (1f13e43)';
  };
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string;
          data: Json | null;
          display_order: number | null;
          farcaster_api_key: string | null;
          id: string;
          name: string | null;
          platform: string | null;
          platform_account_id: string | null;
          private_key: string;
          public_key: string | null;
          status: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          display_order?: number | null;
          farcaster_api_key?: string | null;
          id?: string;
          name?: string | null;
          platform?: string | null;
          platform_account_id?: string | null;
          private_key: string;
          public_key?: string | null;
          status?: string | null;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          display_order?: number | null;
          farcaster_api_key?: string | null;
          id?: string;
          name?: string | null;
          platform?: string | null;
          platform_account_id?: string | null;
          private_key?: string;
          public_key?: string | null;
          status?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      accounts_to_channel: {
        Row: {
          account_id: string;
          channel_id: string;
          created_at: string;
          id: string;
          index: number | null;
          last_read: string | null;
        };
        Insert: {
          account_id: string;
          channel_id: string;
          created_at?: string;
          id?: string;
          index?: number | null;
          last_read?: string | null;
        };
        Update: {
          account_id?: string;
          channel_id?: string;
          created_at?: string;
          id?: string;
          index?: number | null;
          last_read?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'accounts_to_channel_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'accounts_to_channel_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'decrypted_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'accounts_to_channel_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'decrypted_dm_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'accounts_to_channel_channel_id_fkey';
            columns: ['channel_id'];
            isOneToOne: false;
            referencedRelation: 'channel';
            referencedColumns: ['id'];
          },
        ];
      };
      analytics: {
        Row: {
          data: Json | null;
          fid: number;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          data?: Json | null;
          fid: number;
          status: string;
          updated_at?: string | null;
        };
        Update: {
          data?: Json | null;
          fid?: number;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      auto_interaction_history: {
        Row: {
          action: string;
          cast_hash: string;
          error_message: string | null;
          list_id: string;
          processed_at: string | null;
          status: string | null;
        };
        Insert: {
          action: string;
          cast_hash: string;
          error_message?: string | null;
          list_id: string;
          processed_at?: string | null;
          status?: string | null;
        };
        Update: {
          action?: string;
          cast_hash?: string;
          error_message?: string | null;
          list_id?: string;
          processed_at?: string | null;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'auto_interaction_history_list_id_fkey';
            columns: ['list_id'];
            isOneToOne: false;
            referencedRelation: 'list';
            referencedColumns: ['id'];
          },
        ];
      };
      channel: {
        Row: {
          created_at: string;
          data: Json | null;
          description: string | null;
          icon_url: string | null;
          id: string;
          name: string | null;
          source: string | null;
          url: string | null;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          description?: string | null;
          icon_url?: string | null;
          id?: string;
          name?: string | null;
          source?: string | null;
          url?: string | null;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          description?: string | null;
          icon_url?: string | null;
          id?: string;
          name?: string | null;
          source?: string | null;
          url?: string | null;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          created_at: string | null;
          hypersub_token_id: string | null;
          id: string;
          product: string | null;
          stripe_customer_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          hypersub_token_id?: string | null;
          id?: string;
          product?: string | null;
          stripe_customer_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          hypersub_token_id?: string | null;
          id?: string;
          product?: string | null;
          stripe_customer_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      draft: {
        Row: {
          account_id: string;
          created_at: string;
          data: Json | null;
          encoded_message_bytes: number[] | null;
          id: string;
          published_at: string | null;
          scheduled_for: string | null;
          status: string | null;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          data?: Json | null;
          encoded_message_bytes?: number[] | null;
          id?: string;
          published_at?: string | null;
          scheduled_for?: string | null;
          status?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          data?: Json | null;
          encoded_message_bytes?: number[] | null;
          id?: string;
          published_at?: string | null;
          scheduled_for?: string | null;
          status?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'public_draft_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'public_draft_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'decrypted_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'public_draft_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'decrypted_dm_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      list: {
        Row: {
          account_id: string | null;
          contents: Json;
          created_at: string;
          id: string;
          idx: number;
          name: string;
          type: Database['public']['Enums']['list_type'];
          user_id: string | null;
        };
        Insert: {
          account_id?: string | null;
          contents: Json;
          created_at?: string;
          id?: string;
          idx: number;
          name: string;
          type: Database['public']['Enums']['list_type'];
          user_id?: string | null;
        };
        Update: {
          account_id?: string | null;
          contents?: Json;
          created_at?: string;
          id?: string;
          idx?: number;
          name?: string;
          type?: Database['public']['Enums']['list_type'];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'list_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'list_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'decrypted_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'list_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'decrypted_dm_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'public_list_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profile';
            referencedColumns: ['user_id'];
          },
        ];
      };
      notification_read_states: {
        Row: {
          created_at: string;
          id: string;
          notification_id: string;
          notification_type: string;
          read_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notification_id: string;
          notification_type: string;
          read_at: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notification_id?: string;
          notification_type?: string;
          read_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profile: {
        Row: {
          email: string | null;
          user_id: string;
        };
        Insert: {
          email?: string | null;
          user_id: string;
        };
        Update: {
          email?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          created_at: string;
          preferences: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          preferences?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          preferences?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      decrypted_accounts: {
        Row: {
          created_at: string | null;
          data: Json | null;
          decrypted_farcaster_api_key: string | null;
          decrypted_private_key: string | null;
          display_order: number | null;
          farcaster_api_key: string | null;
          id: string | null;
          name: string | null;
          platform: string | null;
          platform_account_id: string | null;
          private_key: string | null;
          public_key: string | null;
          status: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          data?: Json | null;
          decrypted_farcaster_api_key?: never;
          decrypted_private_key?: never;
          display_order?: number | null;
          farcaster_api_key?: string | null;
          id?: string | null;
          name?: string | null;
          platform?: string | null;
          platform_account_id?: string | null;
          private_key?: string | null;
          public_key?: string | null;
          status?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          data?: Json | null;
          decrypted_farcaster_api_key?: never;
          decrypted_private_key?: never;
          display_order?: number | null;
          farcaster_api_key?: string | null;
          id?: string | null;
          name?: string | null;
          platform?: string | null;
          platform_account_id?: string | null;
          private_key?: string | null;
          public_key?: string | null;
          status?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      decrypted_dm_accounts: {
        Row: {
          decrypted_farcaster_api_key: string | null;
          id: string | null;
          platform_account_id: string | null;
          user_id: string | null;
        };
        Insert: {
          decrypted_farcaster_api_key?: never;
          id?: string | null;
          platform_account_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          decrypted_farcaster_api_key?: never;
          id?: string | null;
          platform_account_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      decrypted_account: {
        Args: { account_id: string };
        Returns: {
          created_at: string;
          data: Json;
          decrypted_private_key: string;
          id: string;
          name: string;
          platform: string;
          platform_account_id: string;
          private_key: string;
          public_key: string;
          status: string;
          user_id: string;
        }[];
      };
      is_account_of_user: {
        Args: { _account_id: string; _user_id: string };
        Returns: boolean;
      };
      trigger_process_auto_interactions: { Args: never; Returns: undefined };
    };
    Enums: {
      list_type: 'fids' | 'search' | 'auto_interaction';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      list_type: ['fids', 'search', 'auto_interaction'],
    },
  },
} as const;

// Convenience type aliases for common table row types
export type List = Database['public']['Tables']['list']['Row'];
export type Account = Database['public']['Tables']['accounts']['Row'];
