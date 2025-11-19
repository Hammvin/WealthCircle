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
      // Add other table definitions from previous schema
    }
  }
}