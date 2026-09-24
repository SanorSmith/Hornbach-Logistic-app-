-- Anti-cheating rate limit: a user may make at most 2 "limited" status changes
-- per rolling 2 minutes. Limited changes are the ones that count as work in the
-- reports: -> UPPTAGEN (pallet placed) and SKRAP -> LEDIG (skräp removed).
-- ADMIN is exempt. Enforced by a trigger on red_points so it cannot be bypassed.

create or replace function public.is_limited_status_change(p_old public.point_status, p_new public.point_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_new is distinct from p_old
     and (p_new = 'UPPTAGEN' or (p_old = 'SKRAP' and p_new = 'LEDIG'))
$$;

-- Seconds the current user must wait before the next limited change (0 = allowed now).
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
    select h."timestamp" as ts
    from public.status_history h
    where h.user_id = auth.uid()
      and h."timestamp" > now() - v_window
      and public.is_limited_status_change(h.old_status, h.new_status)
    order by h."timestamp" desc
    limit v_max
  ) recent;

  if v_count < v_max then
    return 0;
  end if;

  return greatest(1, ceil(extract(epoch from (v_oldest + v_window - now())))::integer);
end;
$$;

revoke all on function public.limited_change_wait_seconds() from public, anon;
grant execute on function public.limited_change_wait_seconds() to authenticated;

create or replace function public.enforce_status_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wait integer;
begin
  if not public.is_limited_status_change(old.status, new.status) or auth.uid() is null then
    return new;
  end if;

  -- Serialize a user's concurrent requests so two taps can't both slip through.
  perform pg_advisory_xact_lock(hashtext('status_rate_limit:' || auth.uid()::text));

  v_wait := public.limited_change_wait_seconds();
  if v_wait > 0 then
    raise exception 'RATE_LIMIT:%', v_wait
      using hint = 'Max 2 ändringar till Upptagen eller från Skräp till Ledig per 2 minuter.';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_status_rate_limit() from public, anon, authenticated;

drop trigger if exists enforce_status_rate_limit on public.red_points;
create trigger enforce_status_rate_limit
  before update of status on public.red_points
  for each row execute function public.enforce_status_rate_limit();
