export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEAM_LEADER' | 'LINEFEEDER' | 'MONITOR' | 'DEPARTMENT';
export type PointStatus = 'LEDIG' | 'UPPTAGEN' | 'SKRAP' | 'KUNDORDER';
export type ActionType = 'PICKUP' | 'COMPLETE' | 'SCAN' | 'STATUS_CHANGE';
export type NotificationType = 'KUNDORDER' | 'SKRAP' | 'URGENT';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department_id: string | null;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
  /** Set for accounts with a temporary password; the app forces a password change. */
  must_change_password?: boolean;
  /** Store the user works in; null only for a SUPER_ADMIN. */
  facility_id?: string | null;
  /** Loaded with the profile; null when the store is closed (or for a SUPER_ADMIN). */
  facility?: Facility | null;
  department?: Department;
}

/** A store, e.g. HORNBACH 772 Norsborg. All data is isolated per facility. */
export interface Facility {
  id: string;
  code: string;
  name: string;
  location: string | null;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
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
  /** When the point got its current status (only changes when the status changes). */
  status_changed_at?: string;
  is_active: boolean;
  created_at: string;
}

/**
 * One pallet on a red point. Open while picked_at is null.
 * See supabase/migrations/20260926130000_extra_pallets.sql.
 */
export interface PointPallet {
  id: string;
  point_id: string;
  /** Placed while another pallet was already on the point (under a privilege). */
  is_extra: boolean;
  image_id: string | null;
  note: string | null;
  placed_by: string | null;
  placed_at: string;
  picked_at: string | null;
  placer?: { full_name: string } | null;
}

/** An avdelning's privilege to put more than one pallet on a point. */
export interface PointAllowance {
  id: string;
  point_id: string;
  max_pallets: number;
  note: string | null;
  /** Who approved it, typed in when a LineFeeder registers it for the avdelning. */
  authorized_by_name: string | null;
  /** Who registered it in the app (the signed-in user). */
  granted_by: string | null;
  granted_at: string;
  ended_at: string | null;
  granter?: { full_name: string } | null;
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
