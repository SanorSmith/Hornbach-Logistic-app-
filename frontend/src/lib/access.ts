import { UserRole } from '../types';

// Which roles may open each dashboard. Keep in sync with the RLS policies in
// supabase/migrations/*_role_based_rls.sql.
export const ROUTE_ROLES = {
  superadmin: ['SUPER_ADMIN'],
  linefeeder: ['ADMIN', 'TEAM_LEADER', 'LINEFEEDER'],
  admin: ['ADMIN'],
  teamleader: ['ADMIN', 'TEAM_LEADER'],
  team: ['ADMIN', 'TEAM_LEADER'],
  monitor: ['ADMIN', 'TEAM_LEADER', 'LINEFEEDER', 'MONITOR', 'DEPARTMENT'],
  department: ['ADMIN', 'TEAM_LEADER', 'DEPARTMENT'],
  reports: ['ADMIN', 'TEAM_LEADER'],
} satisfies Record<string, UserRole[]>;

/** "772 Norsborg" */
export function facilityLabel(facility: { code: string; name: string } | null | undefined) {
  return facility ? `${facility.code} ${facility.name}` : '';
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Superadmin',
  ADMIN: 'Admin',
  TEAM_LEADER: 'Teamledare',
  LINEFEEDER: 'LineFeeder',
  MONITOR: 'Monitor',
  DEPARTMENT: 'Avdelning',
};
