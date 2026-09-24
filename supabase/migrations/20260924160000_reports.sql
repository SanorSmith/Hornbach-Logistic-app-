-- Reports: pallets / skräp / kundorder activity per period, derived from
-- status_history. One status change can count in two metrics (e.g.
-- UPPTAGEN -> SKRAP = pallet picked up + skräp reported).
--
--   pallets_placed      -> UPPTAGEN   (pallet placed in a red point)
--   pallets_picked      UPPTAGEN ->   (pallet picked up / delivered)
--   skrap_reported      -> SKRAP
--   skrap_removed       SKRAP ->
--   kundorder_reported  -> KUNDORDER
--   kundorder_picked    KUNDORDER ->
--
-- A point's department is its current assignment (department_point_assignments),
-- falling back to red_points.department_id.

create index if not exists status_history_timestamp_idx on public.status_history ("timestamp");

create or replace function public.get_report(
  p_from timestamptz,
  p_to timestamptz,
  p_bucket text default 'day',          -- 'day' or 'month' for the time series
  p_department_id uuid default null     -- null = all departments
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

  with events as (
    select
      h."timestamp" as ts,
      h.user_id,
      h.point_id,
      coalesce(a.department_id, p.department_id) as department_id,
      h.new_status = 'UPPTAGEN'  as pallet_placed,
      h.old_status = 'UPPTAGEN'  as pallet_picked,
      h.new_status = 'SKRAP'     as skrap_reported,
      h.old_status = 'SKRAP'     as skrap_removed,
      h.new_status = 'KUNDORDER' as kundorder_reported,
      h.old_status = 'KUNDORDER' as kundorder_picked
    from public.status_history h
    join public.red_points p on p.id = h.point_id
    left join public.department_point_assignments a on a.point_id = h.point_id
    where h."timestamp" >= p_from
      and h."timestamp" < p_to
      and h.old_status is distinct from h.new_status
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
        'kundorder_picked', count(*) filter (where kundorder_picked)
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
          count(*) filter (where kundorder_picked) as kundorder_picked
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
          count(*) filter (where kundorder_picked) as kundorder_picked
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
          count(*) filter (where kundorder_picked) as kundorder_picked
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
          count(*) filter (where kundorder_picked) as kundorder_picked
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
