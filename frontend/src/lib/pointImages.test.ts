import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = await vi.hoisted(async () => (await import('../test/supabaseMock')).createSupabaseMock());
vi.mock('./supabase', () => ({ supabase: mock.supabase }));

import { deletePointImage, pruneOldImages } from './pointImages';

beforeEach(() => mock.reset());

const row = (n: number) => ({ id: `img${n}`, storage_path: `p1/${n}.jpg`, created_at: `2026-09-2${n}`, note: null });

describe('pruneOldImages', () => {
  it('keeps the 3 newest photos and removes the rest', async () => {
    mock.respond('point_images', { data: [row(5), row(4), row(3), row(2), row(1)] }); // newest first
    await pruneOldImages('p1');
    expect(mock.storageRemove).toHaveBeenCalledWith(['p1/2.jpg', 'p1/1.jpg']);
    expect(mock.calls).toContainEqual({ table: 'point_images', method: 'in', args: ['id', ['img2', 'img1']] });
  });

  it('does nothing with 3 photos or fewer', async () => {
    mock.respond('point_images', { data: [row(3), row(2), row(1)] });
    await pruneOldImages('p1');
    expect(mock.storageRemove).not.toHaveBeenCalled();
  });
});

describe('deletePointImage', () => {
  it('removes the file and the row', async () => {
    mock.respond('point_images', { data: { storage_path: 'p1/9.jpg' } });
    await deletePointImage('img9');
    expect(mock.storageRemove).toHaveBeenCalledWith(['p1/9.jpg']);
    expect(mock.calls).toContainEqual({ table: 'point_images', method: 'delete', args: [] });
  });

  it('is a no-op when the photo is already gone', async () => {
    mock.respond('point_images', { data: null });
    await deletePointImage('missing');
    expect(mock.storageRemove).not.toHaveBeenCalled();
  });
});
