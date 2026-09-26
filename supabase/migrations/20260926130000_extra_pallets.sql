-- Extra pallets ("Extrapallar"): an avdelning may let one of its red points
-- hold more than one pallet for a while. Every pallet is registered with its
-- photo and comment, and the privilege ends by itself once the extra pallets
-- are picked up again (back to one pallet or none).
--
--   point_allowances  the privilege: point, max pallets (2-10), who granted it
--                     and when, and when/why it ended (AUTO, MANUAL, STATUS).
--                     At most one active per point.
--   point_pallets     one row per pallet: who placed it (photo, comment) and
--                     who picked it up. Open = picked_at is null.
--
-- The point's status follows its pallets: the first pallet makes it UPPTAGEN,
-- picking the last one makes it LEDIG. The status buttons keep working: a point
-- set to UPPTAGEN gets a pallet row, and a point leaving UPPTAGEN closes its
-- pallets and ends the privilege. Extra pallet placements count toward the
-- anti-cheating rate limit and in the reports.
--
-- Who may do what (plus the usual "own facility only" rule):
--   grant / change / end a privilege   ADMIN, TEAM_LEADER; DEPARTMENT only on
--                                      points assigned to their own avdelning
--   place a pallet                     ADMIN, TEAM_LEADER, LINEFEEDER
--   pick a pallet                      ADMIN, TEAM_LEADER, LINEFEEDER, DEPARTMENT

-- 1. Tables ---------------------------------------------------------------------

create table public.point_allowances (
  id uuid primary key default gen_random_uuid(),
  point_id uuid not null references public.red_points (id) on delete cascade,
  facility_id uuid not null references public.facilities (id) on delete restrict,
  max_pallets integer not null check (max_pallets between 2 and 10),
  note text check (note is null or char_length(note) <= 500),
  granted_by uuid references public.users (id),
  granted_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references public.users (id),
  end_reason text check (end_reason in ('AUTO', 'MANUAL', 'STATUS')),
  check ((ended_at is null) = (end_reason is null))
);

-- One active privilege per point.
create unique index point_allowances_one_active_idx
  on public.point_allowances (point_id) where ended_at is null;
create index point_allowances_facility_granted_idx
  on public.point_allowances (facility_id, granted_at desc);

create table public.point_pallets (
  id uuid primary key default gen_random_uuid(),
  point_id uuid not null references public.red_points (id) on delete cascade,
  facility_id uuid not null references public.facilities (id) on delete restrict,
  -- Placed while another pallet was already on the point (under a privilege).
  is_extra boolean not null default false,
  allowance_id uuid references public.point_allowances (id) on delete set null,
  image_id uuid references public.point_images (id) on delete set null,
  note text check (note is null or char_length(note) <= 1000),
  placed_by uuid references public.users (id),
  placed_at timestamptz not null default now(),
  picked_by uuid references public.users (id),
  picked_at timestamptz,
  -- Picked while other pallets stayed on the point (the point kept UPPTAGEN).
  picked_as_extra boolean not null default false
);

create index point_pallets_open_idx on public.point_pallets (point_id) where picked_at is null;
create index point_pallets_facility_placed_idx on public.point_pallets (facility_id, placed_at);
create index point_pallets_facility_picked_idx on public.point_pallets (facility_id, picked_at);

create trigger set_facility_from_point
  before insert or update of point_id, facility_id on public.point_allowances
  for each row execute function public.set_facility_from_point();
create trigger set_facility_from_point
  before insert or update of point_id, facility_id on public.point_pallets
  for each row execute function public.set_facility_from_point();

-- 2. Helpers --------------------------------------------------------------------

-- May the signed-in user grant, change or end a privilege on this point?
create or replace function public.can_manage_point_allowance(p_point_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case public.current_app_role()
    when 'ADMIN' then true
    when 'TEAM_LEADER' then true
    when 'DEPARTMENT' then exists (
      select 1
      from public.department_point_assignments a
      join public.users u on u.id = auth.uid()
      where a.point_id = p_point_id
        and u.department_id is not null
        and a.department_id = u.department_id
    )
    else false
  end
$$;

revoke all on function public.can_manage_point_allowance(uuid) from public, anon;
grant execute on function public.can_manage_point_allowance(uuid) to authenticated;

create or replace function public.open_pallet_count(p_point_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.point_pallets
  where point_id = p_point_id and picked_at is null
$$;

revoke all on function public.open_pallet_count(uuid) from public, anon, authenticated;

-- Ends the point's active privilege (AUTO or STATUS), bypassing the edit guard.
create or replace function public.end_point_allowance(p_point_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.pallet_system', 'on', true);
  update public.point_allowances
     set ended_at = now(), ended_by = auth.uid(), end_reason = p_reason
   where point_id = p_point_id and ended_at is null;
  perform set_config('app.pallet_system', 'off', true);
end;
$$;

revoke all on function public.end_point_allowance(uuid, text) from public, anon, authenticated;

-- 3. Privileges -----------------------------------------------------------------

create or replace function public.guard_point_allowance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_open integer;
begin
  -- Automatic ends, and the service role / SQL editor, are trusted.
  if coalesce(current_setting('app.pallet_system', true), '') = 'on' or auth.uid() is null then
    return new;
  end if;

  -- Serialize with pallet changes on the same point.
  perform 1 from public.red_points where id = new.point_id for update;
  v_open := public.open_pallet_count(new.point_id);

  if tg_op = 'INSERT' then
    -- Registered under the signed-in user, never a client-supplied name.
    new.granted_by := auth.uid();
    new.granted_at := now();
    new.ended_at := null;
    new.ended_by := null;
    new.end_reason := null;
    if new.max_pallets < v_open then
      raise exception 'ALLOWANCE_TOO_LOW:%', v_open;
    end if;
    return new;
  end if;

  -- UPDATE: change the maximum, or end the privilege.
  if old.ended_at is not null then
    raise exception 'The extra pallet privilege has already ended';
  end if;
  if (to_jsonb(new) - 'max_pallets' - 'ended_at' - 'ended_by' - 'end_reason')
     is distinct from (to_jsonb(old) - 'max_pallets' - 'ended_at' - 'ended_by' - 'end_reason') then
    raise exception 'Only the maximum can be changed or the privilege ended';
  end if;

  if new.ended_at is not null then
    if v_open > 1 then
      raise exception 'PICK_EXTRA_FIRST:%', v_open;
    end if;
    new.max_pallets := old.max_pallets;
    new.ended_at := now();
    new.ended_by := auth.uid();
    new.end_reason := 'MANUAL';
  else
    new.ended_by := null;
    new.end_reason := null;
    if new.max_pallets < v_open then
      raise exception 'ALLOWANCE_TOO_LOW:%', v_open;
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_point_allowance
  before insert or update on public.point_allowances
  for each row execute function public.guard_point_allowance();

revoke execute on function public.guard_point_allowance() from public, anon, authenticated;

-- 4. Pallets --------------------------------------------------------------------

-- Seconds the current user must wait before the next limited change (0 = allowed
-- now). Counts limited status changes and extra pallets placed: both are work
-- in the reports.
create or replace function public.limited_change_wait_seconds()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_window constant interval := interval '2 minutes';
  v_max constant integer := 2;
  v_oldest timestamptz;
  v_count integer;
begin
  if auth.uid() is null or public.current_app_role() = 'ADMIN' then
    return 0;
  end if;

  select count(*), min(ts) into v_count, v_oldest
  from (
    select ts from (
      select h."timestamp" as ts
      from public.status_history h
      where h.user_id = auth.uid()
        and h."timestamp" > now() - v_window
        and public.is_limited_status_change(h.old_status, h.new_status)
      union all
      select p.placed_at
      from public.point_pallets p
      where p.placed_by = auth.uid()
        and p.is_extra
        and p.placed_at > now() - v_window
    ) changes
    order by ts desc
    limit v_max
  ) recent;

  if v_count < v_max then
    return 0;
  end if;

  return greatest(1, ceil(extract(epoch from (v_oldest + v_window - now())))::integer);
end;
$$;

create or replace function public.before_pallet_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_open integer;
  v_allowance public.point_allowances%rowtype;
  v_wait integer;
begin
  -- The signed-in user places the pallet now (service role / SQL is trusted).
  if auth.uid() is not null then
    new.placed_by := auth.uid();
    new.placed_at := now();
  end if;
  new.picked_by := null;
  new.picked_at := null;
  new.picked_as_extra := false;

  perform 1 from public.red_points where id = new.point_id for update;
  v_open := public.open_pallet_count(new.point_id);

  select * into v_allowance from public.point_allowances
  where point_id = new.point_id and ended_at is null;

  if v_open >= coalesce(v_allowance.max_pallets, 1) then
    raise exception 'PALLET_LIMIT:%', coalesce(v_allowance.max_pallets, 1);
  end if;

  new.is_extra := v_open >= 1;
  new.allowance_id := case when new.is_extra then v_allowance.id end;

  if new.is_extra and auth.uid() is not null then
    perform pg_advisory_xact_lock(hashtext('status_rate_limit:' || auth.uid()::text));
    v_wait := public.limited_change_wait_seconds();
    if v_wait > 0 then
      raise exception 'RATE_LIMIT:%', v_wait
        using hint = 'Max 2 ändringar till Upptagen eller från Skräp till Ledig per 2 minuter.';
    end if;
  end if;

  return new;
end;
$$;

-- The first pallet makes the point UPPTAGEN (through the normal status triggers:
-- rate limit, history, reports).
create or replace function public.after_pallet_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.red_points set status = 'UPPTAGEN'
  where id = new.point_id and status is distinct from 'UPPTAGEN';
  return new;
end;
$$;

-- Picking is the only change users may make; who and when come from the
-- database. The service role / SQL editor may correct rows.
create or replace function public.before_pallet_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if old.picked_at is not null then
      raise exception 'The pallet has already been picked';
    end if;
    if new.picked_at is null
       or (to_jsonb(new) - 'picked_at' - 'picked_by' - 'picked_as_extra')
          is distinct from (to_jsonb(old) - 'picked_at' - 'picked_by' - 'picked_as_extra') then
      raise exception 'A pallet can only be marked as picked';
    end if;
  end if;

  if old.picked_at is null and new.picked_at is not null then
    perform 1 from public.red_points where id = new.point_id for update;
    if auth.uid() is not null then
      new.picked_at := now();
      new.picked_by := auth.uid();
    end if;
    new.picked_as_extra := public.open_pallet_count(new.point_id) > 1;
  end if;
  return new;
end;
$$;

-- Back to one pallet (or none): the privilege ends. No pallet left: LEDIG.
create or replace function public.after_pallet_picked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_open integer := public.open_pallet_count(new.point_id);
begin
  if v_open <= 1 then
    perform public.end_point_allowance(new.point_id, 'AUTO');
  end if;
  if v_open = 0 then
    update public.red_points set status = 'LEDIG'
    where id = new.point_id and status = 'UPPTAGEN';
  end if;
  return new;
end;
$$;

create trigger before_pallet_insert
  before insert on public.point_pallets
  for each row execute function public.before_pallet_insert();
create trigger after_pallet_insert
  after insert on public.point_pallets
  for each row execute function public.after_pallet_insert();
create trigger before_pallet_update
  before update on public.point_pallets
  for each row execute function public.before_pallet_update();
create trigger after_pallet_picked
  after update of picked_at on public.point_pallets
  for each row execute function public.after_pallet_picked();

revoke execute on function public.before_pallet_insert() from public, anon, authenticated;
revoke execute on function public.after_pallet_insert() from public, anon, authenticated;
revoke execute on function public.before_pallet_update() from public, anon, authenticated;
revoke execute on function public.after_pallet_picked() from public, anon, authenticated;

-- 5. Status buttons keep the pallets in step --------------------------------------

create or replace function public.sync_pallets_with_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pallet uuid;
begin
  if new.status = 'UPPTAGEN' and old.status is distinct from 'UPPTAGEN'
     and public.open_pallet_count(new.id) = 0 then
    -- Marked UPPTAGEN with the status button: register the pallet, with the
    -- photo just taken for it (if any).
    insert into public.point_pallets (point_id, placed_by, image_id)
    values (
      new.id,
      coalesce(auth.uid(), new.current_user_id),
      (select i.id from public.point_images i
       where i.point_id = new.id and i.created_at > now() - interval '10 minutes'
       order by i.created_at desc limit 1)
    );
  elsif old.status = 'UPPTAGEN' and new.status is distinct from 'UPPTAGEN' then
    -- Left UPPTAGEN with a status button: everything on the point was picked.
    perform public.end_point_allowance(new.id, 'STATUS');
    for v_pallet in
      select id from public.point_pallets
      where point_id = new.id and picked_at is null
      order by placed_at desc
    loop
      update public.point_pallets set picked_at = now() where id = v_pallet;
    end loop;
  end if;
  return new;
end;
$$;

create trigger sync_pallets_with_status
  after update of status on public.red_points
  for each row execute function public.sync_pallets_with_status();

revoke execute on function public.sync_pallets_with_status() from public, anon, authenticated;

-- 6. Row level security -----------------------------------------------------------

alter table public.point_allowances enable row level security;
alter table public.point_pallets enable row level security;

revoke all on public.point_allowances from anon;
revoke all on public.point_pallets from anon;
revoke delete, truncate on public.point_allowances from authenticated;
revoke delete, truncate on public.point_pallets from authenticated;

create policy "point_allowances: app users read"
  on public.point_allowances for select to authenticated
  using (public.current_app_role() is not null);
create policy "point_allowances: managers insert"
  on public.point_allowances for insert to authenticated
  with check (public.can_manage_point_allowance(point_id));
create policy "point_allowances: managers update"
  on public.point_allowances for update to authenticated
  using (public.can_manage_point_allowance(point_id))
  with check (public.can_manage_point_allowance(point_id));
create policy "point_allowances: own facility only"
  on public.point_allowances as restrictive for all to authenticated
  using (facility_id = public.current_facility_id())
  with check (facility_id = public.current_facility_id());

create policy "point_pallets: app users read"
  on public.point_pallets for select to authenticated
  using (public.current_app_role() is not null);
create policy "point_pallets: linefeeders place"
  on public.point_pallets for insert to authenticated
  with check (public.has_app_role(array['ADMIN', 'TEAM_LEADER', 'LINEFEEDER']::public.user_role[]));
create policy "point_pallets: operators pick"
  on public.point_pallets for update to authenticated
  using (public.has_app_role(array['ADMIN', 'TEAM_LEADER', 'LINEFEEDER', 'DEPARTMENT']::public.user_role[]))
  with check (public.has_app_role(array['ADMIN', 'TEAM_LEADER', 'LINEFEEDER', 'DEPARTMENT']::public.user_role[]));
create policy "point_pallets: own facility only"
  on public.point_pallets as restrictive for all to authenticated
  using (facility_id = public.current_facility_id())
  with check (facility_id = public.current_facility_id());

alter publication supabase_realtime add table public.point_pallets, public.point_allowances;

-- 7. Points that are UPPTAGEN today get their pallet row ------------------------

insert into public.point_pallets (point_id, placed_at, placed_by, image_id)
select
  p.id,
  p.status_changed_at,
  (select h.user_id from public.status_history h
   where h.point_id = p.id and h.new_status = 'UPPTAGEN'
   order by h."timestamp" desc limit 1),
  (select i.id from public.point_images i
   where i.point_id = p.id
   order by i.created_at desc limit 1)
from public.red_points p
where p.status = 'UPPTAGEN';

-- 8. Deleting a facility also removes its pallets and privileges ------------------

create or replace function public.delete_facility_data(p_facility_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.facilities where id = p_facility_id) then
    raise exception 'Unknown facility %', p_facility_id;
  end if;

  delete from public.point_pallets              where facility_id = p_facility_id;
  delete from public.point_allowances           where facility_id = p_facility_id;
  delete from public.point_images               where facility_id = p_facility_id;
  delete from public.notifications              where facility_id = p_facility_id;
  delete from public.status_history             where facility_id = p_facility_id;
  delete from public.department_point_assignments where facility_id = p_facility_id;
  delete from public.red_points                 where facility_id = p_facility_id;
  delete from public.users                      where facility_id = p_facility_id;
  delete from public.departments                where facility_id = p_facility_id;
  delete from public.facilities                 where id = p_facility_id;
end;
$$;

revoke all on function public.delete_facility_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_facility_data(uuid) to service_role;

-- 9. Reports count every pallet ------------------------------------------------------
--
--   pallets_placed        -> UPPTAGEN, plus every extra pallet placed
--   pallets_picked        UPPTAGEN ->, plus every extra pallet picked
--   extra_pallets_placed  extra pallets placed (already in pallets_placed)
--   allowances_granted    extra pallet privileges granted

create or replace function public.get_report(
  p_from timestamptz,
  p_to timestamptz,
  p_bucket text default 'day',
  p_department_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.has_app_role(array['ADMIN', 'TEAM_LEADER']::public.user_role[]) then
    raise exception 'Not allowed to view reports';
  end if;
  if p_bucket not in ('day', 'month') then
    raise exception 'p_bucket must be day or month';
  end if;

  with raw as (
    select
      h."timestamp" as ts, h.user_id, h.point_id,
      h.new_status = 'UPPTAGEN'  as pallet_placed,
      h.old_status = 'UPPTAGEN'  as pallet_picked,
      h.new_status = 'SKRAP'     as skrap_reported,
      h.old_status = 'SKRAP'     as skrap_removed,
      h.new_status = 'KUNDORDER' as kundorder_reported,
      h.old_status = 'KUNDORDER' as kundorder_picked,
      false as extra_placed,
      false as allowance_granted
    from public.status_history h
    where h."timestamp" >= p_from and h."timestamp" < p_to
      and h.old_status is distinct from h.new_status
    union all
    select pp.placed_at, pp.placed_by, pp.point_id,
      true, false, false, false, false, false, true, false
    from public.point_pallets pp
    where pp.is_extra and pp.placed_at >= p_from and pp.placed_at < p_to
    union all
    select pp.picked_at, pp.picked_by, pp.point_id,
      false, true, false, false, false, false, false, false
    from public.point_pallets pp
    where pp.picked_as_extra and pp.picked_at >= p_from and pp.picked_at < p_to
    union all
    select pa.granted_at, pa.granted_by, pa.point_id,
      false, false, false, false, false, false, false, true
    from public.point_allowances pa
    where pa.granted_at >= p_from and pa.granted_at < p_to
  ),
  events as (
    select r.*, coalesce(a.department_id, p.department_id) as department_id
    from raw r
    join public.red_points p on p.id = r.point_id
    left join public.department_point_assignments a on a.point_id = r.point_id
  ),
  filtered as (
    select * from events
    where p_department_id is null or department_id = p_department_id
  )
  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'events', count(*),
        'pallets_placed', count(*) filter (where pallet_placed),
        'pallets_picked', count(*) filter (where pallet_picked),
        'skrap_reported', count(*) filter (where skrap_reported),
        'skrap_removed', count(*) filter (where skrap_removed),
        'kundorder_reported', count(*) filter (where kundorder_reported),
        'kundorder_picked', count(*) filter (where kundorder_picked),
        'extra_pallets_placed', count(*) filter (where extra_placed),
        'allowances_granted', count(*) filter (where allowance_granted)
      )
      from filtered
    ),
    'series', coalesce((
      select jsonb_agg(row_to_json(s) order by s.bucket)
      from (
        select
          to_char(date_trunc(p_bucket, ts at time zone 'Europe/Stockholm'), 'YYYY-MM-DD') as bucket,
          count(*) as events,
          count(*) filter (where pallet_placed) as pallets_placed,
          count(*) filter (where pallet_picked) as pallets_picked,
          count(*) filter (where skrap_reported) as skrap_reported,
          count(*) filter (where skrap_removed) as skrap_removed,
          count(*) filter (where kundorder_reported) as kundorder_reported,
          count(*) filter (where kundorder_picked) as kundorder_picked,
          count(*) filter (where extra_placed) as extra_pallets_placed,
          count(*) filter (where allowance_granted) as allowances_granted
        from filtered
        group by 1
      ) s
    ), '[]'::jsonb),
    'by_department', coalesce((
      select jsonb_agg(row_to_json(d) order by d.events desc, d.name)
      from (
        select
          f.department_id as id,
          coalesce(dep.name, 'Okänd') as name,
          count(*) as events,
          count(*) filter (where pallet_placed) as pallets_placed,
          count(*) filter (where pallet_picked) as pallets_picked,
          count(*) filter (where skrap_reported) as skrap_reported,
          count(*) filter (where skrap_removed) as skrap_removed,
          count(*) filter (where kundorder_reported) as kundorder_reported,
          count(*) filter (where kundorder_picked) as kundorder_picked,
          count(*) filter (where extra_placed) as extra_pallets_placed,
          count(*) filter (where allowance_granted) as allowances_granted
        from filtered f
        left join public.departments dep on dep.id = f.department_id
        group by f.department_id, dep.name
      ) d
    ), '[]'::jsonb),
    'by_user', coalesce((
      select jsonb_agg(row_to_json(u) order by u.events desc, u.name)
      from (
        select
          f.user_id as id,
          coalesce(usr.full_name, 'Okänd') as name,
          usr.role::text as role,
          count(*) as events,
          count(*) filter (where pallet_placed) as pallets_placed,
          count(*) filter (where pallet_picked) as pallets_picked,
          count(*) filter (where skrap_reported) as skrap_reported,
          count(*) filter (where skrap_removed) as skrap_removed,
          count(*) filter (where kundorder_reported) as kundorder_reported,
          count(*) filter (where kundorder_picked) as kundorder_picked,
          count(*) filter (where extra_placed) as extra_pallets_placed,
          count(*) filter (where allowance_granted) as allowances_granted
        from filtered f
        left join public.users usr on usr.id = f.user_id
        group by f.user_id, usr.full_name, usr.role
      ) u
    ), '[]'::jsonb),
    'by_point', coalesce((
      select jsonb_agg(row_to_json(pt) order by pt.events desc, pt.point_number)
      from (
        select
          f.point_id as id,
          rp.point_number,
          a.department_number as name,
          coalesce(dep.name, 'Okänd') as department,
          count(*) as events,
          count(*) filter (where pallet_placed) as pallets_placed,
          count(*) filter (where pallet_picked) as pallets_picked,
          count(*) filter (where skrap_reported) as skrap_reported,
          count(*) filter (where skrap_removed) as skrap_removed,
          count(*) filter (where kundorder_reported) as kundorder_reported,
          count(*) filter (where kundorder_picked) as kundorder_picked,
          count(*) filter (where extra_placed) as extra_pallets_placed,
          count(*) filter (where allowance_granted) as allowances_granted
        from filtered f
        join public.red_points rp on rp.id = f.point_id
        left join public.department_point_assignments a on a.point_id = f.point_id
        left join public.departments dep on dep.id = f.department_id
        group by f.point_id, rp.point_number, a.department_number, dep.name
      ) pt
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

revoke all on function public.get_report(timestamptz, timestamptz, text, uuid) from public, anon;
grant execute on function public.get_report(timestamptz, timestamptz, text, uuid) to authenticated;
