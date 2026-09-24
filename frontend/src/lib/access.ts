import { UserRole } from '../types';

// Which roles may open each dashboard. Keep in sync with the RLS policies in
// supabase/migrations/*_role_based_rls.sql.
export const ROUTE_ROLES = {
  linefeeder: ['ADMIN', 'TEAM_LEADER', 'LINEFEEDER'],
  admin: ['ADMIN'],
  teamleader: ['ADMIN', 'TEAM_LEADER'],
  team: ['ADMIN', 'TEAM_LEADER'],
  monitor: ['ADMIN', 'TEAM_LEADER', 'LINEFEEDER', 'MONITOR', 'DEPARTMENT'],
  department: ['ADMIN', 'TEAM_LEADER', 'DEPARTMENT'],
  reports: ['ADMIN', 'TEAM_LEADER'],
} satisfies Record<string, UserRole[]>;

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  TEAM_LEADER: 'Teamledare',
  LINEFEEDER: 'LineFeeder',
  MONITOR: 'Monitor',
  DEPARTMENT: 'Avdelning',
};
