import { describe, expect, it } from 'vitest';
import { facilityLabel, ROLE_LABELS, ROUTE_ROLES } from './access';

describe('ROUTE_ROLES', () => {
  it('keeps the super admin out of store dashboards', () => {
    for (const [route, roles] of Object.entries(ROUTE_ROLES)) {
      if (route === 'superadmin') expect(roles).toEqual(['SUPER_ADMIN']);
      else expect(roles as string[]).not.toContain('SUPER_ADMIN');
    }
  });

  it('only lets admins and team leaders see reports', () => {
    expect(ROUTE_ROLES.reports).toEqual(['ADMIN', 'TEAM_LEADER']);
  });

  it('only lets admins open the admin dashboard', () => {
    expect(ROUTE_ROLES.admin).toEqual(['ADMIN']);
  });

  it('keeps the monitor read-only roles away from the LineFeeder dashboard', () => {
    expect(ROUTE_ROLES.linefeeder as string[]).not.toContain('MONITOR');
    expect(ROUTE_ROLES.linefeeder as string[]).not.toContain('DEPARTMENT');
  });
});

describe('labels', () => {
  it('has a Swedish label for every role', () => {
    expect(ROLE_LABELS.DEPARTMENT).toBe('Avdelning');
    expect(ROLE_LABELS.SUPER_ADMIN).toBe('Superadmin');
  });

  it('formats a facility as "code name"', () => {
    expect(facilityLabel({ code: '772', name: 'Norsborg' })).toBe('772 Norsborg');
    expect(facilityLabel(null)).toBe('');
  });
});
