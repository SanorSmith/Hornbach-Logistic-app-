-- Keep the report data honest (found by the security review).
--
-- 1. Nobody writes status_history directly: every row comes from the
--    log_status_change trigger when a red point changes status. Before, any
--    operator could POST made-up history rows (with any timestamp) and inflate
--    their own report numbers, bypassing the rate limit.
-- 2. Operators (LineFeeder, Avdelning) may only change a point's status.
--    Before, they could also change qr_code, point_number, is_active,
--    department_id, status_changed_at or current_user_id - e.g. credit their
--    changes to a colleague. Admins and team leaders keep full edit rights.
-- 3. History is always logged under the signed-in user, never under a
--    client-supplied current_user_id.
-- 4. status_changed_at is only set by the database, when the status changes.

drop policy if exists "status_history: operators insert own" on public.status_history;
revoke insert, update, delete on public.status_history from authenticated;

create or replace function public.guard_red_point_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Service role / SQL editor, admins and team leaders may edit everything.
  if auth.uid() is null
     or public.has_app_role(array['ADMIN', 'TEAM_LEADER']::public.user_role[]) then
    return new;
  end if;

  -- last_updated and status_changed_at are maintained by
  -- update_last_updated_column, so they are ignored here.
  if (to_jsonb(new) - 'status' - 'last_updated' - 'status_changed_at')
     is distinct from (to_jsonb(old) - 'status' - 'last_updated' - 'status_changed_at') then
    raise exception 'Only the status of a red point can be changed';
  end if;

  return new;
end;
$$;

-- Runs after enforce_status_rate_limit and before update_red_points_last_updated
-- (BEFORE triggers fire in name order).
drop trigger if exists guard_red_point_changes on public.red_points;
create trigger guard_red_point_changes
  before update on public.red_points
  for each row execute function public.guard_red_point_changes();

revoke execute on function public.guard_red_point_changes() from public, anon, authenticated;

create or replace function public.update_last_updated_column()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.last_updated = now();
  if new.status is distinct from old.status then
    new.status_changed_at = now();
  else
    new.status_changed_at = old.status_changed_at;
  end if;
  return new;
end;
$$;

create or replace function public.log_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if new.status is distinct from old.status then
    -- The signed-in user did it; current_user_id only matters for changes made
    -- without a user session (service role / SQL).
    v_user_id := coalesce(auth.uid(), new.current_user_id);

    if v_user_id is not null then
      insert into public.status_history (point_id, user_id, old_status, new_status, action_type)
      values (new.id, v_user_id, old.status, new.status, 'STATUS_CHANGE');
    end if;
  end if;
  return new;
end;
$$;
