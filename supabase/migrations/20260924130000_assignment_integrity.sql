-- Department point assignments: one department per point, and atomic saves.

-- A red point can only belong to one department at a time.
alter table public.department_point_assignments
  add constraint department_point_assignments_point_id_key unique (point_id);

-- Replace all assignments of one department in a single transaction, so a
-- failed insert can no longer leave the department with its assignments deleted.
-- SECURITY INVOKER: the caller's RLS policies (ADMIN / TEAM_LEADER) still apply.
create or replace function public.save_department_assignments(
  p_department_id uuid,
  p_assignments jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.has_app_role(array['ADMIN', 'TEAM_LEADER']::public.user_role[]) then
    raise exception 'Not allowed to change department assignments';
  end if;

  delete from public.department_point_assignments
  where department_id = p_department_id;

  insert into public.department_point_assignments (department_id, point_id, department_number)
  select p_department_id, (item->>'point_id')::uuid, trim(item->>'department_number')
  from jsonb_array_elements(p_assignments) as item
  where coalesce(trim(item->>'department_number'), '') <> '';
end;
$$;

revoke all on function public.save_department_assignments(uuid, jsonb) from public, anon;
grant execute on function public.save_department_assignments(uuid, jsonb) to authenticated;
