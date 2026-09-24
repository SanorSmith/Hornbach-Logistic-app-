-- Photos taken when a point is marked as UPPTAGEN.
-- The app keeps the 3 newest photos per point and removes older ones
-- (files through the Storage API, rows here).

create table public.point_images (
  id uuid primary key default gen_random_uuid(),
  point_id uuid not null references public.red_points(id) on delete cascade,
  storage_path text not null unique,
  created_by uuid not null default auth.uid() references public.users(id),
  created_at timestamptz not null default now()
);

create index point_images_point_id_created_at_idx
  on public.point_images (point_id, created_at desc);

alter table public.point_images enable row level security;
revoke all on public.point_images from anon;

create policy "point_images: app users read"
  on public.point_images for select to authenticated
  using (public.current_app_role() is not null);

create policy "point_images: operators insert own"
  on public.point_images for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.has_app_role(array['ADMIN', 'TEAM_LEADER', 'LINEFEEDER', 'DEPARTMENT']::public.user_role[])
  );

create policy "point_images: operators delete"
  on public.point_images for delete to authenticated
  using (public.has_app_role(array['ADMIN', 'TEAM_LEADER', 'LINEFEEDER', 'DEPARTMENT']::public.user_role[]));

-- Private storage bucket: images only, max 5 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('point-images', 'point-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "point-images: app users read"
  on storage.objects for select to authenticated
  using (bucket_id = 'point-images' and public.current_app_role() is not null);

create policy "point-images: operators upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'point-images'
    and public.has_app_role(array['ADMIN', 'TEAM_LEADER', 'LINEFEEDER', 'DEPARTMENT']::public.user_role[])
  );

create policy "point-images: operators delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'point-images'
    and public.has_app_role(array['ADMIN', 'TEAM_LEADER', 'LINEFEEDER', 'DEPARTMENT']::public.user_role[])
  );
