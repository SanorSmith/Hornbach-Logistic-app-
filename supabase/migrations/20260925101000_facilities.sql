-- Multi-facility: every store (e.g. HORNBACH 772 Norsborg, 773 ...) gets its
-- own isolated data. Each user belongs to exactly one facility; a SUPER_ADMIN
-- belongs to none and manages the facilities and their admin accounts.
--
-- Isolation is enforced by RESTRICTIVE policies (facility_id must be the
-- caller's facility) that are AND-ed with the existing role policies, so the
-- role rules from earlier migrations keep working unchanged inside a facility.

-- 1. Facilities ---------------------------------------------------------------

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9A-Za-z-]{1,12}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  location text,
  address text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.facilities enable row level security;
revoke all on public.facilities from anon;

-- The existing data is store 772 Norsborg.
insert into public.facilities (code, name, location)
values ('772', 'Norsborg', 'Botkyrka');

-- 2. facility_id on every table ----------------------------------------------

alter table public.users                        add column facility_id uuid references public.facilities (id) on delete restrict;
alter table public.departments                  add column facility_id uuid references public.facilities (id) on delete restrict;
alter table public.red_points                   add column facility_id uuid references public.facilities (id) on delete restrict;
alter table public.department_point_assignments add column facility_id uuid references public.facilities (id) on delete restrict;
alter table public.status_history               add column facility_id uuid references public.facilities (id) on delete restrict;
alter table public.point_images                 add column facility_id uuid references public.facilities (id) on delete restrict;
alter table public.notifications                add column facility_id uuid references public.facilities (id) on delete restrict;

do $$
declare
  v_772 uuid := (select id from public.facilities where code = '772');
begin
  update public.users                        set facility_id = v_772 where role <> 'SUPER_ADMIN';
  update public.departments                  set facility_id = v_772;
  update public.red_points                   set facility_id = v_772;
  update public.department_point_assignments set facility_id = v_772;
  update public.status_history               set facility_id = v_772;
  update public.point_images                 set facility_id = v_772;
  update public.notifications                set facility_id = v_772;
end
$$;

-- Only a SUPER_ADMIN has no facility.
alter table public.users
  add constraint users_facility_by_role check ((role = 'SUPER_ADMIN') = (facility_id is null));

alter table public.departments                  alter column facility_id set not null;
alter table public.red_points                   alter column facility_id set not null;
alter table public.department_point_assignments alter column facility_id set not null;
alter table public.status_history               alter column facility_id set not null;
alter table public.point_images                 alter column facility_id set not null;
alter table public.notifications                alter column facility_id set not null;

-- Names and point numbers are unique per facility, not globally.
alter table public.departments drop constraint departments_name_key;
alter table public.departments add constraint departments_facility_name_key unique (facility_id, name);
alter table public.red_points drop constraint red_points_point_number_key;
alter table public.red_points drop constraint red_points_qr_code_key;
alter table public.red_points add constraint red_points_facility_point_number_key unique (facility_id, point_number);
alter table public.red_points add constraint red_points_facility_qr_code_key unique (facility_id, qr_code);

create index users_facility_id_idx on public.users (facility_id);
create index department_point_assignments_facility_id_idx on public.department_point_assignments (facility_id);
create index status_history_facility_timestamp_idx on public.status_history (facility_id, "timestamp");
create index point_images_facility_id_idx on public.point_images (facility_id);
create index notifications_facility_id_idx on public.notifications (facility_id);

-- 3. Helpers ------------------------------------------------------------------

-- Role of the signed-in user; null when inactive or their facility is closed.
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
    and (u.role = 'SUPER_ADMIN' or f.is_active)
$$;

-- Facility of the signed-in user; null for a SUPER_ADMIN or a closed facility.
create or replace function public.current_facility_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.facility_id
  from public.users u
  join public.facilities f on f.id = u.facility_id
  where u.id = auth.uid()
    and u.is_active = true
    and f.is_active = true
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'SUPER_ADMIN', false)
$$;

revoke all on function public.current_facility_id() from public, anon;
grant execute on function public.current_facility_id() to authenticated;
revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

-- New rows made by the app land in the caller's facility automatically.
alter table public.departments alter column facility_id set default public.current_facility_id();
alter table public.red_points  alter column facility_id set default public.current_facility_id();

-- 4. Keep related rows in the same facility -----------------------------------

-- Rows hanging off a red point take the point's facility.
create or replace function public.set_facility_from_point()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select p.facility_id into new.facility_id
  from public.red_points p
  where p.id = new.point_id;

  if new.facility_id is null then
    raise exception 'Unknown red point %', new.point_id;
  end if;

  -- (nested: PL/pgSQL would resolve new.department_id on the other tables too)
  if tg_table_name = 'department_point_assignments' then
    if not exists (select 1 from public.departments d
                   where d.id = new.department_id and d.facility_id = new.facility_id) then
      raise exception 'Department and red point belong to different facilities';
    end if;
  end if;

  return new;
end;
$$;

create trigger set_facility_from_point
  before insert or update of point_id, department_id, facility_id on public.department_point_assignments
  for each row execute function public.set_facility_from_point();
create trigger set_facility_from_point
  before insert or update of point_id, facility_id on public.status_history
  for each row execute function public.set_facility_from_point();
create trigger set_facility_from_point
  before insert or update of point_id, facility_id on public.point_images
  for each row execute function public.set_facility_from_point();
create trigger set_facility_from_point
  before insert or update of point_id, facility_id on public.notifications
  for each row execute function public.set_facility_from_point();

-- A point's or user's department must be in the same facility.
create or replace function public.check_department_facility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.department_id is not null
     and not exists (select 1 from public.departments d
                     where d.id = new.department_id and d.facility_id = new.facility_id) then
    raise exception 'Department belongs to a different facility';
  end if;
  return new;
end;
$$;

create trigger check_department_facility
  before insert or update of department_id, facility_id on public.red_points
  for each row execute function public.check_department_facility();
create trigger check_department_facility
  before insert or update of department_id, facility_id on public.users
  for each row execute function public.check_department_facility();

revoke execute on function public.set_facility_from_point() from public, anon, authenticated;
revoke execute on function public.check_department_facility() from public, anon, authenticated;

-- Kundorder notifications only go to LineFeeders in the point's facility.
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
    where u.role = 'LINEFEEDER'
      and u.is_active = true
      and u.facility_id = new.facility_id;
  end if;
  return new;
end;
$$;

-- Users can't be moved between facilities or promoted to/from SUPER_ADMIN
-- from the app; only the service role (admin-users edge function) can.
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

  if new.facility_id is distinct from old.facility_id then
    raise exception 'Moving users between facilities is not allowed';
  end if;

  if (new.role = 'SUPER_ADMIN') is distinct from (old.role = 'SUPER_ADMIN') then
    raise exception 'The super admin role can not be granted or removed here';
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

-- 5. Row level security --------------------------------------------------------

create policy "facilities: own facility or super admin read"
  on public.facilities for select to authenticated
  using (public.is_super_admin() or id = public.current_facility_id());
create policy "facilities: super admin insert"
  on public.facilities for insert to authenticated
  with check (public.is_super_admin());
create policy "facilities: super admin update"
  on public.facilities for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "departments: own facility only"
  on public.departments as restrictive for all to authenticated
  using (facility_id = public.current_facility_id())
  with check (facility_id = public.current_facility_id());
create policy "red_points: own facility only"
  on public.red_points as restrictive for all to authenticated
  using (facility_id = public.current_facility_id())
  with check (facility_id = public.current_facility_id());
create policy "assignments: own facility only"
  on public.department_point_assignments as restrictive for all to authenticated
  using (facility_id = public.current_facility_id())
  with check (facility_id = public.current_facility_id());
create policy "status_history: own facility only"
  on public.status_history as restrictive for all to authenticated
  using (facility_id = public.current_facility_id())
  with check (facility_id = public.current_facility_id());
create policy "point_images: own facility only"
  on public.point_images as restrictive for all to authenticated
  using (facility_id = public.current_facility_id())
  with check (facility_id = public.current_facility_id());
create policy "notifications: own facility only"
  on public.notifications as restrictive for all to authenticated
  using (facility_id = public.current_facility_id())
  with check (facility_id = public.current_facility_id());

-- Users: colleagues in the same facility; a super admin reads everyone (to list
-- facility admins). Everyone can still read and update their own row.
create policy "users: own facility only"
  on public.users as restrictive for all to authenticated
  using (facility_id = public.current_facility_id() or id = auth.uid() or public.is_super_admin())
  with check (facility_id = public.current_facility_id() or id = auth.uid());

-- Photos are stored as <point_id>/<file>.jpg: the point must be in the caller's facility.
create policy "point-images: own facility only"
  on storage.objects as restrictive for all to authenticated
  using (
    bucket_id <> 'point-images'
    or exists (select 1 from public.red_points p
               where p.id::text = (storage.foldername(name))[1]
                 and p.facility_id = public.current_facility_id())
  )
  with check (
    bucket_id <> 'point-images'
    or exists (select 1 from public.red_points p
               where p.id::text = (storage.foldername(name))[1]
                 and p.facility_id = public.current_facility_id())
  );

-- 6. Super admin functions ----------------------------------------------------

-- Creates a facility with the same departments as the first facility and
-- 60 free red points (RP-001 .. RP-060), all placed in its first department
-- until the facility admin assigns them.
create or replace function public.create_facility(
  p_code text,
  p_name text,
  p_location text default null,
  p_address text default null,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_template uuid;
  v_first_department uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Only a super admin can create facilities';
  end if;

  if exists (select 1 from public.facilities where lower(code) = lower(btrim(p_code))) then
    raise exception 'FACILITY_EXISTS: Det finns redan en butik med nummer %', btrim(p_code);
  end if;

  insert into public.facilities (code, name, location, address, phone)
  values (btrim(p_code), btrim(p_name), nullif(btrim(p_location), ''),
          nullif(btrim(p_address), ''), nullif(btrim(p_phone), ''))
  returning id into v_id;

  select f.id into v_template
  from public.facilities f
  where f.id <> v_id
  order by f.created_at
  limit 1;

  insert into public.departments (facility_id, name, location, is_active)
  select v_id, d.name, coalesce(nullif(btrim(p_location), ''), d.location), true
  from public.departments d
  where d.facility_id = v_template and d.is_active;

  if not found then
    insert into public.departments (facility_id, name, location, is_active)
    values (v_id, 'Allmän', nullif(btrim(p_location), ''), true);
  end if;

  select d.id into v_first_department
  from public.departments d
  where d.facility_id = v_id
  order by d.name
  limit 1;

  insert into public.red_points (facility_id, point_number, department_id, status, qr_code, is_active)
  select v_id, n, v_first_department, 'LEDIG', 'RP-' || lpad(n::text, 3, '0'), true
  from generate_series(1, 60) as n;

  return v_id;
end;
$$;

-- Facilities with their size and admin accounts, for the super admin panel.
create or replace function public.facility_overview()
returns table (
  id uuid,
  code text,
  name text,
  location text,
  address text,
  phone text,
  is_active boolean,
  created_at timestamptz,
  user_count bigint,
  point_count bigint,
  department_count bigint,
  admins jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only a super admin can list facilities';
  end if;

  return query
  select
    f.id, f.code, f.name, f.location, f.address, f.phone, f.is_active, f.created_at,
    (select count(*) from public.users u where u.facility_id = f.id and u.is_active),
    (select count(*) from public.red_points p where p.facility_id = f.id and p.is_active),
    (select count(*) from public.departments d where d.facility_id = f.id and d.is_active),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', u.id, 'full_name', u.full_name, 'email', u.email,
               'is_active', u.is_active, 'must_change_password', u.must_change_password)
             order by u.created_at)
      from public.users u
      where u.facility_id = f.id and u.role = 'ADMIN'
    ), '[]'::jsonb)
  from public.facilities f
  order by f.code;
end;
$$;

revoke all on function public.create_facility(text, text, text, text, text) from public, anon;
grant execute on function public.create_facility(text, text, text, text, text) to authenticated;
revoke all on function public.facility_overview() from public, anon;
grant execute on function public.facility_overview() to authenticated;
