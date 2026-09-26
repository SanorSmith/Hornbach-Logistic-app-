-- Extra pallets, changed rules (follow-up to 20260926130000_extra_pallets.sql):
--
--   grant a privilege          ADMIN, TEAM_LEADER; DEPARTMENT on its own points
--   change / end a privilege   ADMIN, TEAM_LEADER (anything);
--                              LINEFEEDER (lower the maximum or end it)
--
-- Once the avdelning has granted extra pallets it can no longer lower or end
-- the privilege itself: the LineFeeder (or a team leader) does that.

create or replace function public.can_grant_point_allowance(p_point_id uuid)
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

revoke all on function public.can_grant_point_allowance(uuid) from public, anon;
grant execute on function public.can_grant_point_allowance(uuid) to authenticated;

drop policy "point_allowances: managers insert" on public.point_allowances;
drop policy "point_allowances: managers update" on public.point_allowances;
drop function public.can_manage_point_allowance(uuid);

create policy "point_allowances: avdelning and leaders grant"
  on public.point_allowances for insert to authenticated
  with check (public.can_grant_point_allowance(point_id));
create policy "point_allowances: linefeeders and leaders change"
  on public.point_allowances for update to authenticated
  using (public.has_app_role(array['ADMIN', 'TEAM_LEADER', 'LINEFEEDER']::public.user_role[]))
  with check (public.has_app_role(array['ADMIN', 'TEAM_LEADER', 'LINEFEEDER']::public.user_role[]));

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
    -- Only a team leader or admin may raise what the avdelning allowed.
    if new.max_pallets > old.max_pallets
       and not public.has_app_role(array['ADMIN', 'TEAM_LEADER']::public.user_role[]) then
      raise exception 'ONLY_LOWER:%', old.max_pallets;
    end if;
    new.ended_by := null;
    new.end_reason := null;
    if new.max_pallets < v_open then
      raise exception 'ALLOWANCE_TOO_LOW:%', v_open;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_point_allowance() from public, anon, authenticated;
