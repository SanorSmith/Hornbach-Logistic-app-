-- DEMO DATA for showing the Rapporter page: ~3 months of status history.
--
-- * Only inserts into public.status_history, tagged notes = 'DEMO'.
--   Red points' current status, users and photos are not touched.
-- * Remove everything again with supabase/seed/remove_demo_report_data.sql.
-- * Re-running first removes the previous demo rows, so it is safe to repeat.
--
-- Scenarios built in:
--   - working rhythm: Mon-Fri 06-18, quieter Saturdays, closed Sundays
--   - growth: activity rises ~40% over the period
--   - peak week 4-5 weeks ago (about double activity)
--   - slow "inventory" week about 9 weeks ago
--   - second LineFeeder on holiday 6-7 weeks ago (the other does everything)
--   - busy departments (Järn, Trädgård, Bygg); Trädgård produces much more skräp
--   - one red point out of service for two weeks
--   - some Kundorder wait a long time before they are picked up

delete from public.status_history where notes = 'DEMO';

do $$
declare
  v_start   timestamptz := date_trunc('day', now() at time zone 'Europe/Stockholm') at time zone 'Europe/Stockholm' - interval '91 days';
  v_end     timestamptz := now() - interval '30 minutes';
  -- Demo data is for store 772 only.
  fac       uuid   := (select id from public.facilities where code = '772');
  lf        uuid[] := array(select id from public.users where facility_id = fac and role = 'LINEFEEDER' and is_active order by created_at);
  dep       uuid[] := array(select id from public.users where facility_id = fac and role = 'DEPARTMENT' and is_active order by created_at);
  tl        uuid   := coalesce((select id from public.users where facility_id = fac and role = 'TEAM_LEADER' and is_active limit 1),
                               (select id from public.users where facility_id = fac and role = 'ADMIN' limit 1));
  p         record;
  st        public.point_status;
  nxt       public.point_status;
  t         timestamptz;
  loc       timestamp;
  gap_min   double precision;
  speed     double precision;
  busy      double precision;
  skrap_bias double precision;
  r         double precision;
  actor     uuid;
  weeks_ago double precision;
  out_of_service_point int := 17;
begin
  if array_length(lf, 1) is null then
    raise exception 'No active LINEFEEDER users to attribute demo data to';
  end if;
  if array_length(dep, 1) is null then
    dep := array[tl];
  end if;

  perform setseed(0.4242);

  for p in
    select rp.id, rp.point_number, coalesce(d.name, '') as dept
    from public.red_points rp
    left join public.department_point_assignments a on a.point_id = rp.id
    left join public.departments d on d.id = coalesce(a.department_id, rp.department_id)
    where rp.is_active and rp.facility_id = fac
    order by rp.point_number
  loop
    busy := case when p.dept ilike any (array['Järn%', 'Trädgård%', 'Bygg%']) then 0.65
                 when p.dept ilike any (array['Kassa%', 'PSC%', 'VU%', 'Zoo%']) then 1.6
                 else 1.0 end;
    skrap_bias := case when p.dept ilike 'Trädgård%' then 2.2 else 1.0 end;
    st := 'LEDIG';
    t := v_start + (random() * interval '4 hours') + interval '6 hours';

    loop
      -- How long until the next change (working minutes), by current state.
      gap_min := case st
        when 'LEDIG'     then 90  + random() * 420   -- until a new pallet or order arrives
        when 'UPPTAGEN'  then 120 + random() * 540   -- pallet is being emptied
        when 'SKRAP'     then 20  + random() * 200   -- skräp waiting for pick-up
        when 'KUNDORDER' then case when random() < 0.15 then 900 + random() * 1800  -- slow pick-up
                                   else 40 + random() * 300 end
      end;

      weeks_ago := extract(epoch from (now() - t)) / 604800.0;
      speed := 1.3 - 0.4 * (1 - least(weeks_ago, 13) / 13.0);         -- growth over time
      if weeks_ago between 4 and 5 then speed := speed * 0.5; end if;  -- peak week
      if weeks_ago between 8.5 and 9.5 then speed := speed * 2.6; end if; -- slow week
      t := t + make_interval(mins => (gap_min * speed * busy)::int);

      -- Keep to working hours: Mon-Fri 06-18, some Saturdays, never Sundays.
      loop
        loc := t at time zone 'Europe/Stockholm';
        exit when extract(isodow from loc) between 1 and 5 and extract(hour from loc) between 6 and 17;
        exit when extract(isodow from loc) = 6 and extract(hour from loc) between 8 and 13 and random() < 0.5;
        t := ((date_trunc('day', loc) + interval '1 day' + interval '6 hours' + random() * interval '90 minutes')
              at time zone 'Europe/Stockholm');
      end loop;

      exit when t > v_end;

      -- Point out of service for two weeks (about 3-5 weeks ago).
      if p.point_number = out_of_service_point and weeks_ago between 3 and 5 then
        continue;
      end if;

      -- Next status.
      r := random();
      nxt := case st
        when 'LEDIG'     then case when r < 0.82 then 'UPPTAGEN'::public.point_status
                                   when r < 0.94 then 'KUNDORDER'
                                   else 'SKRAP' end
        when 'UPPTAGEN'  then case when r < 1 - 0.25 * skrap_bias then 'LEDIG'::public.point_status
                                   when r < 0.97 then 'SKRAP'
                                   else 'KUNDORDER' end
        else 'LEDIG'::public.point_status
      end;

      -- Who did it.
      if nxt in ('SKRAP', 'KUNDORDER') then
        actor := case when random() < 0.85 then dep[1 + floor(random() * array_length(dep, 1))::int] else tl end;
      elsif random() < 0.06 then
        actor := tl;
      elsif array_length(lf, 1) > 1 and weeks_ago between 6 and 7 then
        actor := lf[1];                                   -- colleague on holiday
      else
        actor := lf[1 + floor(random() * array_length(lf, 1))::int];
      end if;

      insert into public.status_history (point_id, user_id, old_status, new_status, action_type, "timestamp", notes)
      values (p.id, actor, st, nxt, 'STATUS_CHANGE', t, 'DEMO');

      st := nxt;
    end loop;
  end loop;
end
$$;

select count(*) as demo_events,
       min("timestamp") as first_event,
       max("timestamp") as last_event
from public.status_history
where notes = 'DEMO';
