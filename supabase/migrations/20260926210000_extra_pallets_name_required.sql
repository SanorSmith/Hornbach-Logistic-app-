-- Extra pallets: every new privilege must name who authorized it, whoever
-- registers it (LineFeeder, team leader or admin). Before, only a LineFeeder
-- had to (follow-up to 20260926190000_extra_pallets_linefeeder_only.sql).
-- Existing privileges are not touched.

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
    -- Always say who approved the extra pallets.
    if new.authorized_by_name is null then
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
