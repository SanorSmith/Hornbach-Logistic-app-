-- Extra pallets: a LineFeeder can register a privilege on the avdelning's
-- behalf, naming who authorized it (follow-up to
-- 20260926150000_extra_pallets_rules.sql).
--
--   grant a privilege   ADMIN, TEAM_LEADER, LINEFEEDER (must fill in
--                       authorized_by_name); DEPARTMENT on its own points
--
-- granted_by stays the signed-in user who registered it; authorized_by_name
-- is the person who approved it (typed in by the LineFeeder).

alter table public.point_allowances
  add column authorized_by_name text
  check (authorized_by_name is null or char_length(btrim(authorized_by_name)) between 1 and 100);

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
    when 'LINEFEEDER' then true
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
    new.authorized_by_name := nullif(btrim(coalesce(new.authorized_by_name, '')), '');
    -- A LineFeeder registers it for the avdelning: say who approved it.
    if public.current_app_role() = 'LINEFEEDER' and new.authorized_by_name is null then
      raise exception 'AUTHORIZED_BY_REQUIRED';
    end if;
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
    -- Only a team leader or admin may raise what was allowed.
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
