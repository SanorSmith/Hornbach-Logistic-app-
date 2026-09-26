import { RedPoint, PointStatus } from '../types';

let counter = 0;

/** A red point with sensible defaults; override what the test cares about. */
export function makePoint(overrides: Partial<RedPoint> = {}): RedPoint {
  counter += 1;
  const now = new Date().toISOString();
  return {
    id: `p${counter}`,
    point_number: counter,
    department_id: 'dep-1',
    status: 'LEDIG' as PointStatus,
    qr_code: `RP-${String(counter).padStart(3, '0')}`,
    location_x: null,
    location_y: null,
    current_user_id: null,
    last_updated: now,
    status_changed_at: now,
    is_active: true,
    created_at: now,
    ...overrides,
  };
}

export const HOUR = 60 * 60 * 1000;
