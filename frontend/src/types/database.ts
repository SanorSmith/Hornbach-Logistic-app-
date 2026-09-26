// Generated from the live Supabase schema (Supabase "generate TypeScript types").
// Regenerate after database migrations instead of editing by hand.

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
      department_point_assignments: {
        Row: {
          created_at: string | null
          department_id: string
          department_number: string
          facility_id: string
          id: string
          point_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department_id: string
          department_number: string
          facility_id: string
          id?: string
          point_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department_id?: string
          department_number?: string
          facility_id?: string
          id?: string
          point_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "department_point_assignments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_point_assignments_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_point_assignments_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: true
            referencedRelation: "red_points"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string | null
          facility_id: string
          id: string
          is_active: boolean | null
          location: string | null
          name: string
        }
        Insert: {
          created_at?: string | null
          facility_id?: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          name: string
        }
        Update: {
          created_at?: string | null
          facility_id?: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          location: string | null
          name: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          facility_id: string
          id: string
          is_read: boolean | null
          message: string
          point_id: string
          priority: number | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          facility_id: string
          id?: string
          is_read?: boolean | null
          message: string
          point_id: string
          priority?: number | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          facility_id?: string
          id?: string
          is_read?: boolean | null
          message?: string
          point_id?: string
          priority?: number | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "red_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      point_images: {
        Row: {
          created_at: string
          created_by: string
          facility_id: string
          id: string
          note: string | null
          point_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          facility_id: string
          id?: string
          note?: string | null
          point_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          created_by?: string
          facility_id?: string
          id?: string
          note?: string | null
          point_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_images_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_images_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_images_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "red_points"
            referencedColumns: ["id"]
          },
        ]
      }
      red_points: {
        Row: {
          created_at: string | null
          current_user_id: string | null
          department_id: string
          facility_id: string
          id: string
          is_active: boolean | null
          last_updated: string | null
          location_x: number | null
          location_y: number | null
          point_number: number
          qr_code: string
          status: Database["public"]["Enums"]["point_status"] | null
          status_changed_at: string
        }
        Insert: {
          created_at?: string | null
          current_user_id?: string | null
          department_id: string
          facility_id?: string
          id?: string
          is_active?: boolean | null
          last_updated?: string | null
          location_x?: number | null
          location_y?: number | null
          point_number: number
          qr_code: string
          status?: Database["public"]["Enums"]["point_status"] | null
          status_changed_at?: string
        }
        Update: {
          created_at?: string | null
          current_user_id?: string | null
          department_id?: string
          facility_id?: string
          id?: string
          is_active?: boolean | null
          last_updated?: string | null
          location_x?: number | null
          location_y?: number | null
          point_number?: number
          qr_code?: string
          status?: Database["public"]["Enums"]["point_status"] | null
          status_changed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "red_points_current_user_id_fkey"
            columns: ["current_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_points_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_points_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      status_history: {
        Row: {
          action_type: Database["public"]["Enums"]["action_type"]
          facility_id: string
          id: string
          new_status: Database["public"]["Enums"]["point_status"]
          notes: string | null
          old_status: Database["public"]["Enums"]["point_status"]
          point_id: string
          timestamp: string | null
          user_id: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["action_type"]
          facility_id: string
          id?: string
          new_status: Database["public"]["Enums"]["point_status"]
          notes?: string | null
          old_status: Database["public"]["Enums"]["point_status"]
          point_id: string
          timestamp?: string | null
          user_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["action_type"]
          facility_id?: string
          id?: string
          new_status?: Database["public"]["Enums"]["point_status"]
          notes?: string | null
          old_status?: Database["public"]["Enums"]["point_status"]
          point_id?: string
          timestamp?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_history_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_history_point_id_fkey"
            columns: ["point_id"]
            isOneToOne: false
            referencedRelation: "red_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          department_id: string | null
          email: string
          full_name: string
          id: number
          is_active: boolean | null
          role: string
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          email: string
          full_name: string
          id?: number
          is_active?: boolean | null
          role?: string
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          email?: string
          full_name?: string
          id?: number
          is_active?: boolean | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          department_id: string | null
          email: string
          facility_id: string | null
          full_name: string
          id: string
          is_active: boolean | null
          last_login: string | null
          must_change_password: boolean
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          email: string
          facility_id?: string | null
          full_name: string
          id: string
          is_active?: boolean | null
          last_login?: string | null
          must_change_password?: boolean
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          email?: string
          facility_id?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          must_change_password?: boolean
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_facility: {
        Args: {
          p_address?: string
          p_code: string
          p_location?: string
          p_name: string
          p_phone?: string
        }
        Returns: string
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      current_facility_id: { Args: never; Returns: string }
      delete_facility_data: {
        Args: { p_facility_id: string }
        Returns: undefined
      }
      facility_deletion_plan: { Args: { p_facility_id: string }; Returns: Json }
      facility_overview: {
        Args: never
        Returns: {
          address: string
          admins: Json
          code: string
          created_at: string
          department_count: number
          id: string
          is_active: boolean
          location: string
          name: string
          phone: string
          point_count: number
          user_count: number
        }[]
      }
      get_report: {
        Args: {
          p_bucket?: string
          p_department_id?: string
          p_from: string
          p_to: string
        }
        Returns: Json
      }
      has_app_role: {
        Args: { roles: Database["public"]["Enums"]["user_role"][] }
        Returns: boolean
      }
      is_limited_status_change: {
        Args: {
          p_new: Database["public"]["Enums"]["point_status"]
          p_old: Database["public"]["Enums"]["point_status"]
        }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      limited_change_wait_seconds: { Args: never; Returns: number }
      save_department_assignments: {
        Args: { p_assignments: Json; p_department_id: string }
        Returns: undefined
      }
    }
    Enums: {
      action_type: "PICKUP" | "COMPLETE" | "SCAN" | "STATUS_CHANGE"
      notification_type: "KUNDORDER" | "SKRAP" | "URGENT"
      point_status: "LEDIG" | "UPPTAGEN" | "SKRAP" | "KUNDORDER"
      user_role:
        | "ADMIN"
        | "TEAM_LEADER"
        | "LINEFEEDER"
        | "MONITOR"
        | "DEPARTMENT"
        | "SUPER_ADMIN"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
