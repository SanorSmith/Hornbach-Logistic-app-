export type UserRole = 'ADMIN' | 'TEAM_LEADER' | 'LINEFEEDER' | 'MONITOR' | 'DEPARTMENT';
export type PointStatus = 'LEDIG' | 'UPPTAGEN' | 'SKRAP' | 'KUNDORDER';
export type ActionType = 'PICKUP' | 'COMPLETE' | 'SCAN' | 'STATUS_CHANGE';
export type NotificationType = 'KUNDORDER' | 'SKRAP' | 'URGENT';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          department_id: string | null;
          is_active: boolean;
          created_at: string;
          last_login: string | null;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          department_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          last_login?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: UserRole;
          department_id?: string | null;
          is_active?: boolean;
          last_login?: string | null;
        };
      };
      departments: {
        Row: {
          id: string;
          name: string;
          location: string | null;
          created_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          location?: string | null;
          created_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          location?: string | null;
          is_active?: boolean;
        };
      };
      red_points: {
        Row: {
          id: string;
          point_number: number;
          department_id: string;
          status: PointStatus;
          qr_code: string;
          location_x: number | null;
          location_y: number | null;
          current_user_id: string | null;
          last_updated: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          point_number: number;
          department_id: string;
          status?: PointStatus;
          qr_code: string;
          location_x?: number | null;
          location_y?: number | null;
          current_user_id?: string | null;
          last_updated?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          point_number?: number;
          department_id?: string;
          status?: PointStatus;
          qr_code?: string;
          location_x?: number | null;
          location_y?: number | null;
          current_user_id?: string | null;
          last_updated?: string;
          is_active?: boolean;
        };
      };
      status_history: {
        Row: {
          id: string;
          point_id: string;
          user_id: string;
          old_status: PointStatus;
          new_status: PointStatus;
          action_type: ActionType;
          timestamp: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          point_id: string;
          user_id: string;
          old_status: PointStatus;
          new_status: PointStatus;
          action_type: ActionType;
          timestamp?: string;
          notes?: string | null;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          point_id: string;
          type: NotificationType;
          message: string;
          is_read: boolean;
          created_at: string;
          priority: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          point_id: string;
          type: NotificationType;
          message: string;
          is_read?: boolean;
          created_at?: string;
          priority?: number;
        };
        Update: {
          is_read?: boolean;
        };
      };
    };
  };
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department_id: string | null;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
  department?: Department;
}

export interface Department {
  id: string;
  name: string;
  location: string | null;
  created_at: string;
  is_active: boolean;
}

export interface RedPoint {
  id: string;
  point_number: number;
  department_id: string;
  department?: Department;
  status: PointStatus;
  qr_code: string;
  location_x: number | null;
  location_y: number | null;
  current_user_id: string | null;
  current_user?: Pick<User, 'id' | 'full_name'>;
  last_updated: string;
  is_active: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  point_id: string;
  point?: Pick<RedPoint, 'point_number'>;
  type: NotificationType;
  message: string;
  is_read: boolean;
  created_at: string;
  priority: number;
}

export interface StatusHistory {
  id: string;
  point_id: string;
  user_id: string;
  user?: Pick<User, 'full_name'>;
  old_status: PointStatus;
  new_status: PointStatus;
  action_type: ActionType;
  timestamp: string;
  notes: string | null;
}
