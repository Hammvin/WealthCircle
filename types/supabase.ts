export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          phone_number: string
          full_name: string
          profile_picture_url: string | null
          pin_hash: string | null
          biometric_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          phone_number: string
          full_name: string
          profile_picture_url?: string | null
          pin_hash?: string | null
          biometric_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone_number?: string
          full_name?: string
          profile_picture_url?: string | null
          pin_hash?: string | null
          biometric_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      chamas: {
        Row: {
          id: string
          name: string
          description: string | null
          savings_goal: string
          contribution_cycle: 'weekly' | 'monthly'
          contribution_amount: number
          total_kitty: number
          invite_code: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          savings_goal: string
          contribution_cycle: 'weekly' | 'monthly'
          contribution_amount: number
          total_kitty?: number
          invite_code: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          savings_goal?: string
          contribution_cycle?: 'weekly' | 'monthly'
          contribution_amount?: number
          total_kitty?: number
          invite_code?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      chama_members: {
        Row: {
          id: string
          chama_id: string
          user_id: string
          role: 'chairperson' | 'treasurer' | 'secretary' | 'member'
          joined_at: string
        }
        Insert: {
          id?: string
          chama_id: string
          user_id: string
          role?: 'chairperson' | 'treasurer' | 'secretary' | 'member'
          joined_at?: string
        }
        Update: {
          id?: string
          chama_id?: string
          user_id?: string
          role?: 'chairperson' | 'treasurer' | 'secretary' | 'member'
          joined_at?: string
        }
      }
      contributions: {
        Row: {
          id: string
          chama_id: string
          member_id: string
          amount: number
          transaction_code: string | null
          payment_method: 'mpesa' | 'cash' | 'bank'
          status: 'pending' | 'completed' | 'failed'
          contribution_date: string
          created_at: string
        }
        Insert: {
          id?: string
          chama_id: string
          member_id: string
          amount: number
          transaction_code?: string | null
          payment_method?: 'mpesa' | 'cash' | 'bank'
          status?: 'pending' | 'completed' | 'failed'
          contribution_date?: string
          created_at?: string
        }
        Update: {
          id?: string
          chama_id?: string
          member_id?: string
          amount?: number
          transaction_code?: string | null
          payment_method?: 'mpesa' | 'cash' | 'bank'
          status?: 'pending' | 'completed' | 'failed'
          contribution_date?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}