import { supabase } from './supabase';
import { PointAllowance, PointPallet } from '../types';
import { RATE_LIMIT_MESSAGE, rateLimitSeconds } from './rateLimit';
import { deletePointImage, uploadPointImage } from './pointImages';

// Extra pallets on a red point ("Extrapallar"), see
// supabase/migrations/20260926130000_extra_pallets.sql. The database enforces
// every rule (how many pallets, who may grant, the automatic end, the rate
// limit); the app shows what is allowed and explains refusals in Swedish.

export const MIN_PALLETS = 2;
export const MAX_PALLETS = 10;

const PALLET_COLUMNS =
  'id, point_id, is_extra, image_id, note, placed_by, placed_at, picked_at, placer:users!point_pallets_placed_by_fkey(full_name)';
const ALLOWANCE_COLUMNS =
  'id, point_id, max_pallets, note, authorized_by_name, granted_by, granted_at, ended_at, granter:users!point_allowances_granted_by_fkey(full_name)';

/** Pallets still standing on a point, in the caller's store. */
export async function fetchOpenPallets(): Promise<PointPallet[]> {
  const { data, error } = await supabase
    .from('point_pallets' as never)
    .select(PALLET_COLUMNS)
    .is('picked_at', null)
    .order('placed_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PointPallet[];
}

/** Privileges that are still active, newest first. */
export async function fetchActiveAllowances(): Promise<PointAllowance[]> {
  const { data, error } = await supabase
    .from('point_allowances' as never)
    .select(ALLOWANCE_COLUMNS)
    .is('ended_at', null)
    .order('granted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PointAllowance[];
}

export interface PalletSummary {
  open: PointPallet[];
  allowance: PointAllowance | null;
  /** How many pallets the point may hold right now. */
  max: number;
}

export function palletSummary(pallets: PointPallet[], allowances: PointAllowance[], pointId: string): PalletSummary {
  const allowance = allowances.find((a) => a.point_id === pointId && !a.ended_at) ?? null;
  return {
    open: pallets.filter((p) => p.point_id === pointId && !p.picked_at),
    allowance,
    max: allowance?.max_pallets ?? 1,
  };
}

/**
 * Registers an extra pallet with its photo and comment. The photo is removed
 * again when the database refuses the pallet (point full, rate limit ...).
 */
export async function placePallet(pointId: string, photo: File, note: string): Promise<void> {
  const imageId = await uploadPointImage(pointId, photo, note);
  const { error } = await supabase
    .from('point_pallets' as never)
    .insert({ point_id: pointId, image_id: imageId, note: note.trim() || null } as never);
  if (error) {
    await deletePointImage(imageId).catch((e) => console.error('Error removing photo:', e));
    throw error;
  }
}

/** Marks one pallet as picked up (who and when are set by the database). */
export async function pickPallet(palletId: string): Promise<void> {
  const { data, error } = await supabase
    .from('point_pallets' as never)
    .update({ picked_at: new Date().toISOString() } as never)
    .eq('id', palletId)
    .select('id');
  if (error) throw error;
  // Row level security hides a refused update: nothing comes back.
  if (!data || (data as unknown[]).length === 0) throw new Error('not allowed');
}

/**
 * Lets the point hold up to `maxPallets` pallets. Registered in the signed-in
 * user's name; `authorizedBy` is who approved it (required for a LineFeeder).
 */
export async function grantAllowance(
  pointId: string,
  maxPallets: number,
  note?: string,
  authorizedBy?: string
): Promise<void> {
  const { error } = await supabase.from('point_allowances' as never).insert({
    point_id: pointId,
    max_pallets: maxPallets,
    note: note?.trim() || null,
    authorized_by_name: authorizedBy?.trim() || null,
  } as never);
  if (error) throw error;
}

/** "Anna Avdelning (reg. Lars LineFeeder)" when someone registered it for the approver. */
export function allowanceAuthorizer(allowance: PointAllowance): string {
  const registeredBy = allowance.granter?.full_name ?? 'okänd';
  return allowance.authorized_by_name ? `${allowance.authorized_by_name} (reg. ${registeredBy})` : registeredBy;
}

export async function changeAllowance(allowanceId: string, maxPallets: number): Promise<void> {
  const { error } = await supabase
    .from('point_allowances' as never)
    .update({ max_pallets: maxPallets } as never)
    .eq('id', allowanceId);
  if (error) throw error;
}

export async function endAllowance(allowanceId: string): Promise<void> {
  const { error } = await supabase
    .from('point_allowances' as never)
    .update({ ended_at: new Date().toISOString() } as never)
    .eq('id', allowanceId);
  if (error) throw error;
}

/** A Swedish explanation for a refused pallet or privilege change. */
export function palletErrorMessage(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? '';

  const wait = rateLimitSeconds(error);
  if (wait !== null) return `${RATE_LIMIT_MESSAGE} Försök igen om ${wait} s.`;

  const [, code, count] = message.match(/(PALLET_LIMIT|ALLOWANCE_TOO_LOW|PICK_EXTRA_FIRST|ONLY_LOWER):(\d+)/) ?? [];
  if (code === 'ONLY_LOWER') return `Avdelningen har tillåtit max ${count} pallar. Bara en teamledare kan höja det.`;
  if (code === 'PALLET_LIMIT') {
    return count === '1'
      ? 'Punkten har redan en pall. Avdelningen kan tillåta extra pallar.'
      : `Punkten är full (max ${count} pallar).`;
  }
  if (code === 'ALLOWANCE_TOO_LOW') return `Det står ${count} pallar på punkten. Välj minst ${count}.`;
  if (code === 'PICK_EXTRA_FIRST') return `Det står ${count} pallar på punkten. Plocka extrapallarna först.`;
  if (message.includes('AUTHORIZED_BY_REQUIRED')) return 'Skriv namnet på den som godkände extra pallar.';
  if (message.includes('point_allowances_one_active_idx')) return 'Punkten har redan ett tillstånd för extra pallar.';
  if (message.includes('already been picked')) return 'Pallen är redan plockad.';
  if (/row-level security|not allowed/i.test(message)) return 'Du har inte behörighet att göra det här.';
  return 'Det gick inte att spara. Kontrollera anslutningen och försök igen.';
}
