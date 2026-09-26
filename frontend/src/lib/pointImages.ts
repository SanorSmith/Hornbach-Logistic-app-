import { supabase } from './supabase';

// Photos taken when a point is marked as UPPTAGEN. Stored in the private
// "point-images" bucket, with one row per photo in public.point_images.
// See supabase/migrations/20260924140000_point_images.sql.

const BUCKET = 'point-images';
export const MAX_IMAGES_PER_POINT = 3;

export interface PointImage {
  id: string;
  created_at: string;
  url: string;
  note: string | null;
}

interface PointImageRow {
  id: string;
  storage_path: string;
  created_at: string;
  note: string | null;
}

// Phone photos are often 5-10 MB; scale down to keep uploads fast and small.
async function compressImage(file: File, maxSize = 1600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Kunde inte komprimera bilden'))),
      'image/jpeg',
      quality
    );
  });
}

async function listRows(pointId: string): Promise<PointImageRow[]> {
  const { data, error } = await supabase
    .from('point_images' as never)
    .select('id, storage_path, created_at, note')
    .eq('point_id', pointId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PointImageRow[];
}

/**
 * Uploads a photo (with optional note) for a point and returns its id.
 * Call pruneOldImages() once the status change it belongs to has succeeded,
 * or deletePointImage() to undo it if the change was refused.
 */
export async function uploadPointImage(pointId: string, file: File, note?: string): Promise<string> {
  const blob = await compressImage(file);
  const path = `${pointId}/${Date.now()}-${crypto.randomUUID()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from('point_images' as never)
    .insert({ point_id: pointId, storage_path: path, note: note?.trim() || null } as never)
    .select('id')
    .single();
  if (insertError || !data) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw insertError ?? new Error('Kunde inte spara bilden');
  }
  return (data as { id: string }).id;
}

/**
 * Photo ids of the point's pallets: those of extra pallets (kept apart from the
 * point's ordinary photos) and those of pallets still on the point.
 */
async function palletImageIds(pointId: string): Promise<{ extra: Set<string>; open: Set<string> }> {
  const { data, error } = await supabase
    .from('point_pallets' as never)
    .select('image_id, is_extra, picked_at')
    .eq('point_id', pointId);
  if (error) throw error;
  const rows = (data ?? []) as { image_id: string | null; is_extra: boolean; picked_at: string | null }[];
  const ids = (keep: (r: (typeof rows)[number]) => boolean) =>
    new Set(rows.flatMap((r) => (r.image_id && keep(r) ? [r.image_id] : [])));
  return { extra: ids((r) => r.is_extra), open: ids((r) => !r.picked_at) };
}

/** The point's ordinary photos, newest first: extra pallets' photos are listed with each pallet instead. */
async function ordinaryRows(pointId: string): Promise<{ rows: PointImageRow[]; open: Set<string> }> {
  const [rows, pallets] = await Promise.all([listRows(pointId), palletImageIds(pointId)]);
  return { rows: rows.filter((r) => !pallets.extra.has(r.id)), open: pallets.open };
}

/**
 * Keeps only the newest MAX_IMAGES_PER_POINT ordinary photos for a point, plus
 * the photo of a pallet still on it. Extra pallets' photos are kept apart.
 */
export async function pruneOldImages(pointId: string): Promise<void> {
  const { rows, open } = await ordinaryRows(pointId);
  const extra = rows.slice(MAX_IMAGES_PER_POINT).filter((r) => !open.has(r.id));
  if (extra.length === 0) return;
  await supabase.storage.from(BUCKET).remove(extra.map((r) => r.storage_path));
  await supabase
    .from('point_images' as never)
    .delete()
    .in('id', extra.map((r) => r.id));
}

/** Deletes one photo (file and row). */
export async function deletePointImage(imageId: string): Promise<void> {
  const { data, error } = await supabase
    .from('point_images' as never)
    .select('storage_path')
    .eq('id', imageId)
    .maybeSingle();
  if (error) throw error;

  const row = data as { storage_path: string } | null;
  if (!row) return; // already gone

  // The row first: if the database refuses, the file is still there (the other
  // way round left photos whose file was gone).
  const { error: deleteError } = await supabase
    .from('point_images' as never)
    .delete()
    .eq('id', imageId);
  if (deleteError) throw deleteError;

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
  // The photo is already gone from the app; a file left behind only takes space.
  if (storageError) console.error('Error removing photo file:', storageError);
}

/** Signed display URLs for specific photos (e.g. the pallets on a point), by id. */
export async function getImageUrls(imageIds: string[]): Promise<Record<string, string>> {
  if (imageIds.length === 0) return {};
  const { data: rows, error } = await supabase
    .from('point_images' as never)
    .select('id, storage_path')
    .in('id', imageIds);
  if (error) throw error;
  const list = (rows ?? []) as unknown as { id: string; storage_path: string }[];
  if (list.length === 0) return {};

  const { data, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(list.map((r) => r.storage_path), 60 * 60);
  if (urlError) throw urlError;
  return Object.fromEntries(list.map((row, i) => [row.id, data?.[i]?.signedUrl ?? '']));
}

/** Newest photos for a point, with short-lived signed URLs for display. */
export async function getPointImages(pointId: string): Promise<PointImage[]> {
  const rows = (await ordinaryRows(pointId)).rows.slice(0, MAX_IMAGES_PER_POINT);
  if (rows.length === 0) return [];

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(rows.map((r) => r.storage_path), 60 * 60);
  if (error) throw error;

  return rows.map((row, i) => ({
    id: row.id,
    created_at: row.created_at,
    url: data?.[i]?.signedUrl ?? '',
    note: row.note,
  }));
}
