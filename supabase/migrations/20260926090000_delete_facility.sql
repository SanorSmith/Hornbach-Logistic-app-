-- Deleting a facility removes everything in it: photos, notifications,
-- history, assignments, red points, departments, users and the facility.
-- Only the admin-users edge function (service role) may call these, after it
-- has checked that the caller is a SUPER_ADMIN. The edge function also removes
-- the photo files from storage and the users' auth accounts.

-- What has to be cleaned up outside the database, gathered before deleting.
create or replace function public.facility_deletion_plan(p_facility_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_ids', coalesce((
      select jsonb_agg(u.id) from public.users u where u.facility_id = p_facility_id
    ), '[]'::jsonb),
    'object_paths', coalesce((
      select jsonb_agg(o.name)
      from storage.objects o
      where o.bucket_id = 'point-images'
        and (storage.foldername(o.name))[1] in (
          select p.id::text from public.red_points p where p.facility_id = p_facility_id
        )
    ), '[]'::jsonb)
  )
$$;

create or replace function public.delete_facility_data(p_facility_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.facilities where id = p_facility_id) then
    raise exception 'Unknown facility %', p_facility_id;
  end if;

  delete from public.point_images               where facility_id = p_facility_id;
  delete from public.notifications              where facility_id = p_facility_id;
  delete from public.status_history             where facility_id = p_facility_id;
  delete from public.department_point_assignments where facility_id = p_facility_id;
  delete from public.red_points                 where facility_id = p_facility_id;
  delete from public.users                      where facility_id = p_facility_id;
  delete from public.departments                where facility_id = p_facility_id;
  delete from public.facilities                 where id = p_facility_id;
end;
$$;

revoke all on function public.facility_deletion_plan(uuid) from public, anon, authenticated;
revoke all on function public.delete_facility_data(uuid) from public, anon, authenticated;
grant execute on function public.facility_deletion_plan(uuid) to service_role;
grant execute on function public.delete_facility_data(uuid) to service_role;
