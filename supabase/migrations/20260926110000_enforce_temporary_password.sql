-- A temporary password must be changed before the account can do anything
-- (found by the security review). Until now only the app enforced it: someone
-- holding a temporary password could still use the API directly.
--
-- While users.must_change_password is set, current_app_role() is null, so every
-- role-based policy denies access. Users can still read and update their own
-- profile row ("update own profile" / own-row read), and changing the password
-- clears the flag (clear_must_change_password trigger on auth.users).

create or replace function public.current_app_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select u.role
  from public.users u
  left join public.facilities f on f.id = u.facility_id
  where u.id = auth.uid()
    and u.is_active = true
    and not u.must_change_password
    and (u.role = 'SUPER_ADMIN' or f.is_active)
$$;
