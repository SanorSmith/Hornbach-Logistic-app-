-- When did a red point get its current status? last_updated changes on every
-- edit (e.g. reassigning the department), so it can't tell how long a point
-- has been Upptagen. status_changed_at only moves when the status changes.

alter table public.red_points
  add column if not exists status_changed_at timestamptz;

-- Backfill from the latest real status change (demo data excluded), else last_updated.
update public.red_points p
set status_changed_at = coalesce(
  (select max(h."timestamp")
   from public.status_history h
   where h.point_id = p.id
     and h.new_status = p.status
     and h.notes is distinct from 'DEMO'),
  p.last_updated,
  now()
);

alter table public.red_points
  alter column status_changed_at set default now(),
  alter column status_changed_at set not null;

create or replace function public.update_last_updated_column()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.last_updated = now();
  if new.status is distinct from old.status then
    new.status_changed_at = now();
  end if;
  return new;
end;
$$;
