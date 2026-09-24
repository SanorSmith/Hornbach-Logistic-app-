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

/** Uploads a photo (with optional note) for a point and removes everything beyond the newest 3. */
export async function uploadPointImage(pointId: string, file: File, note?: string): Promise<void> {
  const blob = await compressImage(file);
  const path = `${pointId}/${Date.now()}-${crypto.randomUUID()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase
    .from('point_images' as never)
    .insert({ point_id: pointId, storage_path: path, note: note?.trim() || null } as never);
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw insertError;
  }

  // Keep only the newest MAX_IMAGES_PER_POINT photos.
  const rows = await listRows(pointId);
  const extra = rows.slice(MAX_IMAGES_PER_POINT);
  if (extra.length > 0) {
    await supabase.storage.from(BUCKET).remove(extra.map((r) => r.storage_path));
    await supabase
      .from('point_images' as never)
      .delete()
      .in('id', extra.map((r) => r.id));
  }
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

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
  if (storageError) throw storageError;

  const { error: deleteError } = await supabase
    .from('point_images' as never)
    .delete()
    .eq('id', imageId);
  if (deleteError) throw deleteError;
}

/** Newest photos for a point, with short-lived signed URLs for display. */
export async function getPointImages(pointId: string): Promise<PointImage[]> {
  const rows = (await listRows(pointId)).slice(0, MAX_IMAGES_PER_POINT);
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
