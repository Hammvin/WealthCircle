// lib/database.types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          phone_number: string
          full_name: string
          email: string | null
          profile_data: Json | null
          risk_score: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          phone_number: string
          full_name: string
          email?: string | null
          profile_data?: Json | null
          risk_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone_number?: string
          full_name?: string
          email?: string | null
          profile_data?: Json | null
          risk_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      chamas: {
        Row: {
          id: string
          name: string
          description: string | null
          contribution_amount: number
          contribution_cycle: string
          savings_goal: number | null
          settings: Json | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          contribution_amount: number
          contribution_cycle: string
          savings_goal?: number | null
          settings?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          contribution_amount?: number
          contribution_cycle?: string
          savings_goal?: number | null
          settings?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamas_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      chama_members: {
        Row: {
          id: string
          chama_id: string | null
          user_id: string | null
          role: string | null
          join_date: string | null
          status: string | null
        }
        Insert: {
          id?: string
          chama_id?: string | null
          user_id?: string | null
          role?: string | null
          join_date?: string | null
          status?: string | null
        }
        Update: {
          id?: string
          chama_id?: string | null
          user_id?: string | null
          role?: string | null
          join_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chama_members_chama_id_fkey"
            columns: ["chama_id"]
            referencedRelation: "chamas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chama_members_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      transactions: {
        Row: {
          id: string
          chama_id: string | null
          user_id: string | null
          amount: number
          transaction_type: string
          mpesa_code: string | null
          status: string | null
          description: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          chama_id?: string | null
          user_id?: string | null
          amount: number
          transaction_type: string
          mpesa_code?: string | null
          status?: string | null
          description?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          chama_id?: string | null
          user_id?: string | null
          amount?: number
          transaction_type?: string
          mpesa_code?: string | null
          status?: string | null
          description?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_chama_id_fkey"
            columns: ["chama_id"]
            referencedRelation: "chamas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      loans: {
        Row: {
          id: string
          chama_id: string | null
          user_id: string | null
          amount: number
          interest_rate: number | null
          total_amount: number
          purpose: string | null
          status: string | null
          due_date: string | null
          approved_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          chama_id?: string | null
          user_id?: string | null
          amount: number
          interest_rate?: number | null
          total_amount: number
          purpose?: string | null
          status?: string | null
          due_date?: string | null
          approved_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          chama_id?: string | null
          user_id?: string | null
          amount?: number
          interest_rate?: number | null
          total_amount?: number
          purpose?: string | null
          status?: string | null
          due_date?: string | null
          approved_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_chama_id_fkey"
            columns: ["chama_id"]
            referencedRelation: "chamas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_approved_by_fkey"
            columns: ["approved_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      investment_opportunities: {
        Row: {
          id: string
          title: string
          description: string | null
          category: string | null
          risk_level: string | null
          expected_return: number | null
          min_investment: number | null
          opportunity_data: Json | null
          is_active: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          category?: string | null
          risk_level?: string | null
          expected_return?: number | null
          min_investment?: number | null
          opportunity_data?: Json | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          category?: string | null
          risk_level?: string | null
          expected_return?: number | null
          min_investment?: number | null
          opportunity_data?: Json | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Relationships: []
      }
      chama_investment_interests: {
        Row: {
          id: string
          chama_id: string | null
          opportunity_id: string | null
          interest_level: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          chama_id?: string | null
          opportunity_id?: string | null
          interest_level?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          chama_id?: string | null
          opportunity_id?: string | null
          interest_level?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chama_investment_interests_chama_id_fkey"
            columns: ["chama_id"]
            referencedRelation: "chamas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chama_investment_interests_opportunity_id_fkey"
            columns: ["opportunity_id"]
            referencedRelation: "investment_opportunities"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_logs: {
        Row: {
          id: string
          table_name: string
          record_id: string
          action: string
          old_data: Json | null
          new_data: Json | null
          changed_by: string | null
          changed_at: string | null
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          table_name: string
          record_id: string
          action: string
          old_data?: Json | null
          new_data?: Json | null
          changed_by?: string | null
          changed_at?: string | null
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          table_name?: string
          record_id?: string
          action?: string
          old_data?: Json | null
          new_data?: Json | null
          changed_by?: string | null
          changed_at?: string | null
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_changed_by_fkey"
            columns: ["changed_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      security_events: {
        Row: {
          id: string
          user_id: string | null
          event_type: string
          severity: string
          description: string
          ip_address: string | null
          user_agent: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          event_type: string
          severity: string
          description: string
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          event_type?: string
          severity?: string
          description?: string
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_events_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      failed_login_attempts: {
        Row: {
          id: string
          phone_number: string
          ip_address: string
          user_agent: string | null
          attempted_at: string | null
          is_blocked: boolean | null
        }
        Insert: {
          id?: string
          phone_number: string
          ip_address: string
          user_agent?: string | null
          attempted_at?: string | null
          is_blocked?: boolean | null
        }
        Update: {
          id?: string
          phone_number?: string
          ip_address?: string
          user_agent?: string | null
          attempted_at?: string | null
          is_blocked?: boolean | null
        }
        Relationships: []
      }
      payout_requests: {
        Row: {
          id: string
          chama_id: string
          member_id: string
          amount: number
          request_type: string
          purpose: string
          interest_rate: number | null
          repayment_period: number | null
          status: string
          created_at: string
          updated_at: string
          approved_at: string | null
          approved_by: string | null
        }
        Insert: {
          id?: string
          chama_id: string
          member_id: string
          amount: number
          request_type: string
          purpose: string
          interest_rate?: number | null
          repayment_period?: number | null
          status?: string
          created_at?: string
          updated_at?: string
          approved_at?: string | null
          approved_by?: string | null
        }
        Update: {
          id?: string
          chama_id?: string
          member_id?: string
          amount?: number
          request_type?: string
          purpose?: string
          interest_rate?: number | null
          repayment_period?: number | null
          status?: string
          created_at?: string
          updated_at?: string
          approved_at?: string | null
          approved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_chama_id_fkey"
            columns: ["chama_id"]
            referencedRelation: "chamas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_member_id_fkey"
            columns: ["member_id"]
            referencedRelation: "chama_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_approved_by_fkey"
            columns: ["approved_by"]
            referencedRelation: "chama_members"
            referencedColumns: ["id"]
          }
        ]
      }
      payout_votes: {
        Row: {
          id: string
          payout_request_id: string
          member_id: string
          vote: string
          voted_at: string | null
          comments: string | null
        }
        Insert: {
          id?: string
          payout_request_id: string
          member_id: string
          vote: string
          voted_at?: string | null
          comments?: string | null
        }
        Update: {
          id?: string
          payout_request_id?: string
          member_id?: string
          vote?: string
          voted_at?: string | null
          comments?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_votes_member_id_fkey"
            columns: ["member_id"]
            referencedRelation: "chama_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_votes_payout_request_id_fkey"
            columns: ["payout_request_id"]
            referencedRelation: "payout_requests"
            referencedColumns: ["id"]
          }
        ]
      }
      contributions: {
        Row: {
          id: string
          chama_id: string
          member_id: string
          amount: number
          contribution_date: string
          cycle_period: string
          is_paid: boolean | null
          paid_at: string | null
          transaction_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          chama_id: string
          member_id: string
          amount: number
          contribution_date?: string
          cycle_period: string
          is_paid?: boolean | null
          paid_at?: string | null
          transaction_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          chama_id?: string
          member_id?: string
          amount?: number
          contribution_date?: string
          cycle_period?: string
          is_paid?: boolean | null
          paid_at?: string | null
          transaction_id?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contributions_chama_id_fkey"
            columns: ["chama_id"]
            referencedRelation: "chamas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_member_id_fkey"
            columns: ["member_id"]
            referencedRelation: "chama_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_transaction_id_fkey"
            columns: ["transaction_id"]
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          }
        ]
      }
      loan_repayments: {
        Row: {
          id: string
          payout_request_id: string
          amount: number
          due_date: string
          paid_date: string | null
          is_paid: boolean | null
          penalty_amount: number | null
          transaction_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          payout_request_id: string
          amount: number
          due_date: string
          paid_date?: string | null
          is_paid?: boolean | null
          penalty_amount?: number | null
          transaction_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          payout_request_id?: string
          amount?: number
          due_date?: string
          paid_date?: string | null
          is_paid?: boolean | null
          penalty_amount?: number | null
          transaction_id?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayments_payout_request_id_fkey"
            columns: ["payout_request_id"]
            referencedRelation: "payout_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_repayments_transaction_id_fkey"
            columns: ["transaction_id"]
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          notification_type: string
          is_read: boolean | null
          related_entity_type: string | null
          related_entity_id: string | null
          action_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          notification_type?: string
          is_read?: boolean | null
          related_entity_type?: string | null
          related_entity_id?: string | null
          action_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          notification_type?: string
          is_read?: boolean | null
          related_entity_type?: string | null
          related_entity_id?: string | null
          action_url?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      meetings: {
        Row: {
          id: string
          chama_id: string
          title: string
          description: string | null
          meeting_date: string
          duration_minutes: number | null
          location: string | null
          is_virtual: boolean | null
          meeting_link: string | null
          created_by: string
          created_at: string | null
        }
        Insert: {
          id?: string
          chama_id: string
          title: string
          description?: string | null
          meeting_date: string
          duration_minutes?: number | null
          location?: string | null
          is_virtual?: boolean | null
          meeting_link?: string | null
          created_by: string
          created_at?: string | null
        }
        Update: {
          id?: string
          chama_id?: string
          title?: string
          description?: string | null
          meeting_date?: string
          duration_minutes?: number | null
          location?: string | null
          is_virtual?: boolean | null
          meeting_link?: string | null
          created_by?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_chama_id_fkey"
            columns: ["chama_id"]
            referencedRelation: "chamas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "chama_members"
            referencedColumns: ["id"]
          }
        ]
      }
      meeting_attendees: {
        Row: {
          id: string
          meeting_id: string
          member_id: string
          will_attend: boolean | null
          attended: boolean | null
          joined_at: string | null
          left_at: string | null
        }
        Insert: {
          id?: string
          meeting_id: string
          member_id: string
          will_attend?: boolean | null
          attended?: boolean | null
          joined_at?: string | null
          left_at?: string | null
        }
        Update: {
          id?: string
          meeting_id?: string
          member_id?: string
          will_attend?: boolean | null
          attended?: boolean | null
          joined_at?: string | null
          left_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendees_member_id_fkey"
            columns: ["member_id"]
            referencedRelation: "chama_members"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      member_dashboard: {
        Row: {
          user_id: string | null
          full_name: string | null
          phone_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Functions: {
      get_chama_stats: {
        Args: { chama_id: string }
        Returns: {
          total_savings: number
          member_count: number
          total_loans: number
          active_loans: number
        }[]
      }
      calculate_member_risk_score: {
        Args: { member_id: string }
        Returns: number
      }
      get_comprehensive_chama_stats: {
        Args: { p_chama_id: string }
        Returns: Json
      }
      log_security_event: {
        Args: {
          p_user_id: string
          p_event_type: string
          p_severity: string
          p_description: string
          p_ip_address?: string
          p_user_agent?: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      process_payout_votes: {
        Args: { request_id: string }
        Returns: undefined
      }
    }
    Enums: {
      user_role: 'member' | 'treasurer' | 'chairperson' | 'secretary'
      request_status: 'pending' | 'approved' | 'rejected' | 'paid' | 'defaulted'
      transaction_type: 'contribution' | 'payout' | 'loan' | 'fine' | 'dividend'
      transaction_status: 'pending' | 'completed' | 'failed' | 'cancelled'
      vote_type: 'approve' | 'reject'
      contribution_cycle: 'daily' | 'weekly' | 'monthly' | 'quarterly'
      notification_type: 'info' | 'warning' | 'success' | 'error' | 'vote_required'
    }
  }
}