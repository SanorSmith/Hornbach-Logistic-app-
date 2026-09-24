-- Force users to choose their own password after logging in with a temporary one.
--
-- users.must_change_password is set when an account is created (admin-users
-- edge function) and cleared automatically when the user's password actually
-- changes in Supabase Auth. Users cannot clear it themselves without changing
-- the password.

alter table public.users
  add column if not exists must_change_password boolean not null default false;

-- Clear the flag when the password changes (Supabase Auth updates auth.users).
create or replace function public.clear_must_change_password()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    -- Tell guard_user_changes this clear comes from a real password change.
    perform set_config('app.password_changed', 'on', true);
    update public.users set must_change_password = false where id = new.id and must_change_password;
    perform set_config('app.password_changed', '', true);
  end if;
  return new;
end;
$$;

revoke execute on function public.clear_must_change_password() from public, anon, authenticated;

drop trigger if exists clear_must_change_password on auth.users;
create trigger clear_must_change_password
  after update of encrypted_password on auth.users
  for each row execute function public.clear_must_change_password();

-- Nobody may clear their own flag directly; it is cleared by the trigger above.
create or replace function public.guard_user_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_app_role();
begin
  -- Service role / SQL editor / Supabase Auth (no JWT user) is trusted, and so
  -- is the flag being cleared by a real password change.
  if auth.uid() is null or coalesce(current_setting('app.password_changed', true), '') = 'on' then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'Changing user id is not allowed';
  end if;

  if new.id = auth.uid() and old.must_change_password and not new.must_change_password then
    raise exception 'Change your password to clear must_change_password';
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
     or new.email is distinct from old.email
     or new.must_change_password is distinct from old.must_change_password then
    raise exception 'Not allowed to change role, status, department, email or password flag';
  end if;

  return new;
end;
$$;

-- The existing accounts were given temporary passwords; make them choose their own.
update public.users set must_change_password = true;
