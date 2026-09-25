import { supabase } from './supabase';
import { Facility } from '../types';

// Facilities (stores) for the super admin panel. Creating a facility goes
// through the admin-users edge function (see lib/adminUsers.ts) because it
// also creates the facility's admin account.

export interface FacilityAdmin {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  must_change_password: boolean;
}

export interface FacilityOverview extends Facility {
  user_count: number;
  point_count: number;
  department_count: number;
  admins: FacilityAdmin[];
}

export async function fetchFacilityOverview(): Promise<FacilityOverview[]> {
  const { data, error } = await supabase.rpc('facility_overview' as never);
  if (error) throw error;
  return (data ?? []) as unknown as FacilityOverview[];
}

export async function updateFacility(
  id: string,
  changes: Partial<Pick<Facility, 'name' | 'location' | 'address' | 'phone' | 'is_active'>>
) {
  const { error } = await supabase
    .from('facilities' as never)
    .update(changes as never)
    .eq('id', id);
  if (error) throw error;
}
