-- Role-based access control
--
-- Replaces the ad-hoc fix_rls_*.sql / disable_rls_*.sql scripts.
-- After this migration:
--   * anon (not logged in) has NO access to any table
--   * every logged-in, active user in public.users can read the operational data
--   * writes are limited by role (see policies below)
--   * inactive users (is_active = false) get no access at all
--
-- Role matrix
--   ADMIN        full access
--   TEAM_LEADER  manage users (except admins), departments, assignments, points
--   LINEFEEDER   update red point status
--   DEPARTMENT   update red point status
--   MONITOR      read-only

-- ---------------------------------------------------------------------------
-- 1. Helper functions (SECURITY DEFINER so they can read public.users
--    without recursing through the users RLS policies)
-- ---------------------------------------------------------------------------

create or replace function public.current_app_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select u.role
  from public.users u
  where u.id = auth.uid()
    and u.is_active = true
$$;

create or replace function public.has_app_role(roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = any(roles), false)
$$;

revoke all on function public.current_app_role() from public, anon;
revoke all on function public.has_app_role(public.user_role[]) from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.has_app_role(public.user_role[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Harden existing trigger functions: fixed search_path, and SECURITY
--    DEFINER so the history/notification rows they write are not blocked by
--    the caller's RLS policies.
-- ---------------------------------------------------------------------------

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
    v_user_id := coalesce(new.current_user_id, auth.uid());

    if v_user_id is not null then
      insert into public.status_history (point_id, user_id, old_status, new_status, action_type)
      values (new.id, v_user_id, old.status, new.status, 'STATUS_CHANGE');
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.notify_kundorder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'KUNDORDER' and old.status is distinct from 'KUNDORDER' then
    insert into public.notifications (user_id, point_id, type, message, priority)
    select u.id, new.id, 'KUNDORDER', 'Kundorder redo vid punkt ' || new.point_number::text, 5
    from public.users u
    where u.role = 'LINEFEEDER' and u.is_active = true;
  end if;
  return new;
end;
$$;

create or replace function public.update_last_updated_column()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.last_updated = now();
  return new;
end;
$$;

-- Prevent users from escalating their own privileges through the
-- "update own row" policy on public.users. Only ADMIN / TEAM_LEADER may
-- change role, active flag, department or email, and only ADMIN may touch
-- another ADMIN or grant the ADMIN role.
create or replace function public.guard_user_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_app_role();
begin
  -- Service role / SQL editor (no JWT user) is trusted.
  if auth.uid() is null then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'Changing user id is not allowed';
  end if;

  if v_role = 'ADMIN' then
    return new;
  end if;

  if v_role = 'TEAM_LEADER' then
    if old.role = 'ADMIN' or new.role = 'ADMIN' then
      raise exception 'Only an admin can modify admin accounts';
    end if;
    return new;
  end if;

  -- Everyone else may only update their own non-privileged fields.
  if new.role is distinct from old.role
     or new.is_active is distinct from old.is_active
     or new.department_id is distinct from old.department_id
     or new.email is distinct from old.email then
    raise exception 'Not allowed to change role, status, department or email';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_user_changes on public.users;
create trigger guard_user_changes
  before update on public.users
  for each row execute function public.guard_user_changes();

-- ---------------------------------------------------------------------------
-- 3. Drop every existing policy on the app tables (many duplicates from the
--    old fix scripts)
-- ---------------------------------------------------------------------------

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('users', 'departments', 'red_points', 'status_history',
                        'notifications', 'department_point_assignments', 'user_profiles')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Enable RLS and remove anonymous access
-- ---------------------------------------------------------------------------

alter table public.users                        enable row level security;
alter table public.departments                  enable row level security;
alter table public.red_points                   enable row level security;
alter table public.status_history               enable row level security;
alter table public.notifications                enable row level security;
alter table public.department_point_assignments enable row level security;
alter table public.user_profiles                enable row level security;

revoke all on public.users                        from anon;
revoke all on public.departments                  from anon;
revoke all on public.red_points                   from anon;
revoke all on public.status_history               from anon;
revoke all on public.notifications                from anon;
revoke all on public.department_point_assignments from anon;
revoke all on public.user_profiles                from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Policies
-- ---------------------------------------------------------------------------

-- users -------------------------------------------------------------------
create policy "users: active app users can read"
  on public.users for select to authenticated
  using (public.current_app_role() is not null or id = auth.uid());

create policy "users: update own profile"
  on public.users for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "users: admins and team leaders manage"
  on public.users for update to authenticated
  using (public.has_app_role(array['ADMIN', 'TEAM_LEADER']::public.user_role[]))
  with check (public.has_app_role(array['ADMIN', 'TEAM_LEADER']::public.user_role[]));

create policy "users: admins delete"
  on public.users for delete to authenticated
  using (public.has_app_role(array['ADMIN']::public.user_role[]));
-- INSERT happens only through the admin-users edge function (service role).

-- departments ----------------------------------------------------------------
create policy "departments: app users read"
  on public.departments for select to authenticated
  using (public.current_app_role() is not null);

create policy "departments: admins and team leaders insert"
  on public.departments for insert to authenticated
  with check (public.has_app_role(array['ADMIN', 'TEAM_LEADER']::public.user_role[]));

create policy "departments: admins and team leaders update"
  on public.departments for update to authenticated
  using (public.has_app_role(array['ADMIN', 'TEAM_LEADER']::public.user_role[]))
  with check (public.has_app_role(array['ADMIN', 'TEAM_LEADER']::public.user_role[]));

create policy "departments: admins delete"
  on public.departments for delete to authenticated
  using (public.has_app_role(array['ADMIN']::public.user_role[]));

-- red_points -----------------------------------------------------------------
create policy "red_points: app users read"
  on public.red_points for select to authenticated
  using (public.current_app_role() is not null);

create policy "red_points: operators update"
  on public.red_points for update to authenticated
  using (public.has_app_role(array['ADMIN', 'TEAM_LEADER', 'LINEFEEDER', 'DEPARTMENT']::public.user_role[]))
  with check (public.has_app_role(array['ADMIN', 'TEAM_LEADER', 'LINEFEEDER', 'DEPARTMENT']::public.user_role[]));

create policy "red_points: admins insert"
  on public.red_points for insert to authenticated
  with check (public.has_app_role(array['ADMIN']::public.user_role[]));

create policy "red_points: admins delete"
  on public.red_points for delete to authenticated
  using (public.has_app_role(array['ADMIN']::public.user_role[]));

-- status_history ---------------------------------------------------------------
create policy "status_history: app users read"
  on public.status_history for select to authenticated
  using (public.current_app_role() is not null);

create policy "status_history: operators insert own"
  on public.status_history for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.has_app_role(array['ADMIN', 'TEAM_LEADER', 'LINEFEEDER', 'DEPARTMENT']::public.user_role[])
  );

-- notifications ----------------------------------------------------------------
create policy "notifications: read own"
  on public.notifications for select to authenticated
  using (user_id = auth.uid() and public.current_app_role() is not null);

create policy "notifications: mark own as read"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
-- INSERT happens through the notify_kundorder trigger (security definer).

-- department_point_assignments ---------------------------------------------------
create policy "assignments: app users read"
  on public.department_point_assignments for select to authenticated
  using (public.current_app_role() is not null);

create policy "assignments: admins and team leaders insert"
  on public.department_point_assignments for insert to authenticated
  with check (public.has_app_role(array['ADMIN', 'TEAM_LEADER']::public.user_role[]));

create policy "assignments: admins and team leaders update"
  on public.department_point_assignments for update to authenticated
  using (public.has_app_role(array['ADMIN', 'TEAM_LEADER']::public.user_role[]))
  with check (public.has_app_role(array['ADMIN', 'TEAM_LEADER']::public.user_role[]));

create policy "assignments: admins and team leaders delete"
  on public.department_point_assignments for delete to authenticated
  using (public.has_app_role(array['ADMIN', 'TEAM_LEADER']::public.user_role[]));

-- user_profiles: legacy table, no longer used by the app. RLS on with no
-- policies = locked for anon and authenticated.
