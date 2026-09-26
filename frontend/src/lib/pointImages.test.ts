import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = await vi.hoisted(async () => (await import('../test/supabaseMock')).createSupabaseMock());
vi.mock('./supabase', () => ({ supabase: mock.supabase }));

import { deletePointImage, getPointImages, pruneOldImages } from './pointImages';

beforeEach(() => mock.reset());

const row = (n: number) => ({ id: `img${n}`, storage_path: `p1/${n}.jpg`, created_at: `2026-09-2${n}`, note: null });

describe('pruneOldImages', () => {
  it('keeps the 3 newest photos and removes the rest', async () => {
    mock.respond('point_images', { data: [row(5), row(4), row(3), row(2), row(1)] }); // newest first
    await pruneOldImages('p1');
    expect(mock.storageRemove).toHaveBeenCalledWith(['p1/2.jpg', 'p1/1.jpg']);
    expect(mock.calls).toContainEqual({ table: 'point_images', method: 'in', args: ['id', ['img2', 'img1']] });
  });

  it('never counts or removes the photos of extra pallets, or of a pallet still on the point', async () => {
    mock.respond('point_images', { data: [row(6), row(5), row(4), row(3), row(2), row(1)] });
    mock.respond('point_pallets', {
      data: [
        { image_id: 'img6', is_extra: true, picked_at: null }, // extra pallet: kept apart
        { image_id: 'img5', is_extra: true, picked_at: '2026-09-26T10:00:00Z' }, // picked extra: still apart
        { image_id: 'img1', is_extra: false, picked_at: null }, // ordinary pallet still on the point
      ],
    });
    await pruneOldImages('p1');
    // Ordinary photos: img4, img3, img2 are the newest 3; img1 belongs to the open pallet.
    expect(mock.storageRemove).not.toHaveBeenCalled();
  });

  it('does nothing with 3 photos or fewer', async () => {
    mock.respond('point_images', { data: [row(3), row(2), row(1)] });
    await pruneOldImages('p1');
    expect(mock.storageRemove).not.toHaveBeenCalled();
  });
});

describe('getPointImages', () => {
  it('shows only the point’s ordinary photos, not those of extra pallets', async () => {
    mock.respond('point_images', { data: [row(3), row(2), row(1)] });
    mock.respond('point_pallets', { data: [{ image_id: 'img3', is_extra: true, picked_at: null }] });
    mock.supabase.storage.from = (() => ({
      remove: mock.storageRemove,
      createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ signedUrl: `https://x/${p}` })), error: null }),
    })) as never;
    const images = await getPointImages('p1');
    expect(images.map((i) => i.id)).toEqual(['img2', 'img1']);
  });
});

describe('deletePointImage', () => {
  it('removes the file and the row', async () => {
    mock.respond('point_images', { data: { storage_path: 'p1/9.jpg' } });
    await deletePointImage('img9');
    expect(mock.storageRemove).toHaveBeenCalledWith(['p1/9.jpg']);
    expect(mock.calls).toContainEqual({ table: 'point_images', method: 'delete', args: [] });
  });

  it('keeps the file when the database refuses to delete the photo', async () => {
    mock.respond('point_images', { data: { storage_path: 'p1/9.jpg' } }); // the lookup
    mock.respond('point_images', { error: { message: 'The pallet has already been picked' } }); // the delete
    await expect(deletePointImage('img9')).rejects.toMatchObject({ message: 'The pallet has already been picked' });
    expect(mock.storageRemove).not.toHaveBeenCalled();
  });

  it('is a no-op when the photo is already gone', async () => {
    mock.respond('point_images', { data: null });
    await deletePointImage('missing');
    expect(mock.storageRemove).not.toHaveBeenCalled();
  });
});
