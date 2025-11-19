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
      // Add other table definitions as needed
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