import { useDeviceSetting } from './useDeviceSetting';
import { useDepartments } from './useDepartments';
import { PointStatus, RedPoint } from '../types';

export const STATUS_FILTERS = ['ALL', 'KUNDORDER', 'SKRAP', 'UPPTAGEN', 'LEDIG'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

/**
 * The status and avdelning filters of a points page, remembered on this device
 * under `<page>.status` and `<page>.avdelning` (a handheld or a wall screen
 * usually serves the same avdelning).
 */
export function usePointFilters(page: string) {
  const departments = useDepartments();
  // Anything unknown falls back to every status.
  const [storedStatus, setStatus] = useDeviceSetting(`${page}.status`);
  const status: StatusFilter = (STATUS_FILTERS as readonly string[]).includes(storedStatus)
    ? (storedStatus as StatusFilter)
    : 'ALL';
  // '' = every avdelning. A remembered avdelning that no longer exists is ignored.
  const [storedDepartment, setDepartment] = useDeviceSetting(`${page}.avdelning`);
  const department =
    departments.length === 0 || departments.some((d) => d.id === storedDepartment) ? storedDepartment : '';

  // A point belongs to the avdelning it is assigned to (Admin → Tilldela punkter).
  const inDepartment = (point: RedPoint, assignedDepartments: Record<string, string>) =>
    !department || assignedDepartments[point.id] === department;
  const matches = (point: RedPoint, assignedDepartments: Record<string, string>) =>
    (status === 'ALL' || point.status === (status as PointStatus)) && inDepartment(point, assignedDepartments);

  return {
    departments,
    status,
    setStatus: (next: StatusFilter) => setStatus(next === 'ALL' ? '' : next),
    department,
    setDepartment,
    inDepartment,
    matches,
  };
}
