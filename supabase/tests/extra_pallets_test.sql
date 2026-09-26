-- Tests for migrations/20260926130000_extra_pallets.sql and
-- 20260926150000_extra_pallets_rules.sql.
--
-- Run the migrations not yet applied and then this file as ONE batch (one transaction), e.g.
-- through the Supabase SQL editor or the MCP execute_sql tool. The script
-- always ends with an exception, so the migration, the test store and every
-- test row are rolled back, whether the tests pass or fail:
--   success: ERROR: EXTRA PALLET TESTS PASSED
--   failure: ERROR: FAILED: <what went wrong>

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $f$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    case when p_uid is null then '' else json_build_object('sub', p_uid, 'role', 'authenticated')::text end,
    true);
  if p_uid is not null then
    execute 'set local role authenticated';
  end if;
end $f$;

create function pg_temp.ok(p_ok boolean, p_msg text) returns void language plpgsql as $f$
begin
  if p_ok is not true then
    raise exception 'FAILED: %', p_msg;
  end if;
end $f$;

create function pg_temp.expect_error(p_sql text, p_like text) returns void language plpgsql as $f$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not like '%' || p_like || '%' then
      raise exception 'FAILED: expected error containing "%" but got: %', p_like, sqlerrm;
    end if;
    return;
  end;
  raise exception 'FAILED: expected error containing "%" but it succeeded: %', p_like, p_sql;
end $f$;

-- Moves a user's recent limited changes out of the 2-minute rate limit window.
create function pg_temp.cool_down(p_uid uuid) returns void language sql as $f$
  update public.status_history set "timestamp" = "timestamp" - interval '5 minutes' where user_id = p_uid;
  update public.point_pallets set placed_at = placed_at - interval '5 minutes' where placed_by = p_uid;
$f$;

do $test$
declare
  f   constant uuid := '00000000-0000-4000-8000-00000000f001';
  d1  constant uuid := '00000000-0000-4000-8000-0000000000d1';
  d2  constant uuid := '00000000-0000-4000-8000-0000000000d2';
  p1  constant uuid := '00000000-0000-4000-8000-0000000000a1';
  p2  constant uuid := '00000000-0000-4000-8000-0000000000a2';
  lf  constant uuid := '00000000-0000-4000-8000-000000000101';
  dep constant uuid := '00000000-0000-4000-8000-000000000102';
  tl  constant uuid := '00000000-0000-4000-8000-000000000103';
  mon constant uuid := '00000000-0000-4000-8000-000000000104';
  v_first uuid;
  v_second uuid;
  v_third uuid;
  v_allow uuid;
  v_allow2 uuid;
  v_n integer;
  v_report jsonb;
  v_from timestamptz := now() - interval '1 hour';
  v_pallet public.point_pallets%rowtype;
  v_grant public.point_allowances%rowtype;
begin
  -- Existing UPPTAGEN points got their pallet row from the migration.
  perform pg_temp.ok(
    (select count(*) from public.red_points where status = 'UPPTAGEN')
    = (select count(*) from public.point_pallets where picked_at is null),
    'every UPPTAGEN point has exactly one open pallet after the backfill');

  -- Fixtures: a test store with two avdelningar, one point each, four users.
  insert into public.facilities (id, code, name, is_active) values (f, 'ZZTEST-EP', 'Test extrapallar', true);
  insert into public.departments (id, name, facility_id, is_active)
    values (d1, 'Test D1', f, true), (d2, 'Test D2', f, true);
  insert into public.red_points (id, point_number, qr_code, department_id, facility_id, status)
    values (p1, 1, 'RP-ZZTEST-001', d1, f, 'LEDIG'), (p2, 2, 'RP-ZZTEST-002', d2, f, 'LEDIG');
  insert into public.department_point_assignments (point_id, department_id, department_number)
    values (p1, d1, 'T1'), (p2, d2, 'T2');
  insert into auth.users (id, email) values
    (lf, 'zz-lf@test.invalid'), (dep, 'zz-dep@test.invalid'),
    (tl, 'zz-tl@test.invalid'), (mon, 'zz-mon@test.invalid');
  insert into public.users (id, email, full_name, role, department_id, facility_id, is_active) values
    (lf, 'zz-lf@test.invalid', 'Test LineFeeder', 'LINEFEEDER', null, f, true),
    (dep, 'zz-dep@test.invalid', 'Test Avdelning', 'DEPARTMENT', d1, f, true),
    (tl, 'zz-tl@test.invalid', 'Test Teamleader', 'TEAM_LEADER', null, f, true),
    (mon, 'zz-mon@test.invalid', 'Test Monitor', 'MONITOR', null, f, true);

  -- 1. The first pallet makes the point UPPTAGEN, placed by the signed-in user.
  perform pg_temp.act_as(lf);
  insert into public.point_pallets (point_id, note, placed_by) values (p1, 'first', tl) returning id into v_first;
  perform pg_temp.act_as(null);
  select * into v_pallet from public.point_pallets where id = v_first;
  perform pg_temp.ok(v_pallet.placed_by = lf, 'placed_by is the signed-in user, not the client value');
  perform pg_temp.ok(not v_pallet.is_extra, 'the first pallet is not extra');
  perform pg_temp.ok((select status from public.red_points where id = p1) = 'UPPTAGEN', 'first pallet -> UPPTAGEN');
  perform pg_temp.ok((select count(*) from public.status_history where point_id = p1) = 1, 'status change logged once');
  perform pg_temp.ok(public.open_pallet_count(p1) = 1, 'no duplicate pallet from the status trigger');

  -- 2. Without a privilege a point holds one pallet.
  perform pg_temp.act_as(lf);
  perform pg_temp.expect_error(format('insert into public.point_pallets (point_id) values (%L)', p1), 'PALLET_LIMIT:1');

  -- 3. Who may grant: not another avdelning, not Monitor, not LineFeeder.
  perform pg_temp.act_as(dep);
  perform pg_temp.expect_error(format('insert into public.point_allowances (point_id, max_pallets) values (%L, 3)', p2), 'row-level security');
  perform pg_temp.act_as(mon);
  perform pg_temp.expect_error(format('insert into public.point_allowances (point_id, max_pallets) values (%L, 3)', p1), 'row-level security');
  perform pg_temp.act_as(lf);
  perform pg_temp.expect_error(format('insert into public.point_allowances (point_id, max_pallets) values (%L, 3)', p1), 'row-level security');

  -- 4. The avdelning grants on its own point, registered under its own name.
  perform pg_temp.act_as(dep);
  perform pg_temp.expect_error(format('insert into public.point_allowances (point_id, max_pallets) values (%L, 11)', p1), 'check constraint');
  insert into public.point_allowances (point_id, max_pallets, note, granted_by) values (p1, 3, 'Kampanj', tl) returning id into v_allow;
  perform pg_temp.expect_error(format('insert into public.point_allowances (point_id, max_pallets) values (%L, 2)', p1), 'point_allowances_one_active_idx');
  perform pg_temp.expect_error(format('insert into public.point_pallets (point_id) values (%L)', p1), 'row-level security');
  perform pg_temp.act_as(null);
  perform pg_temp.ok((select granted_by from public.point_allowances where id = v_allow) = dep, 'granted_by is the avdelning user');

  -- 5. Extra pallets, with the rate limit (2 limited changes per 2 minutes).
  perform pg_temp.act_as(lf);
  insert into public.point_pallets (point_id, note) values (p1, 'extra 1') returning id into v_second;
  perform pg_temp.expect_error(format('insert into public.point_pallets (point_id) values (%L)', p1), 'RATE_LIMIT');
  perform pg_temp.act_as(null);
  perform pg_temp.cool_down(lf);
  perform pg_temp.act_as(lf);
  insert into public.point_pallets (point_id, note) values (p1, 'extra 2') returning id into v_third;
  perform pg_temp.expect_error(format('insert into public.point_pallets (point_id) values (%L)', p1), 'PALLET_LIMIT:3');
  perform pg_temp.act_as(null);
  perform pg_temp.ok((select count(*) from public.point_pallets where point_id = p1 and is_extra and allowance_id = v_allow) = 2,
    'extra pallets are marked extra and linked to the privilege');
  perform pg_temp.ok(public.open_pallet_count(p1) = 3, 'three pallets on the point');

  -- 6. Once granted, the avdelning can't change or end the privilege
  --    (20260926150000_extra_pallets_rules.sql): row level security skips it.
  perform pg_temp.act_as(dep);
  update public.point_allowances set max_pallets = 2 where id = v_allow;
  get diagnostics v_n = row_count;
  perform pg_temp.ok(v_n = 0, 'the avdelning cannot lower its privilege');
  update public.point_allowances set ended_at = now() where id = v_allow;
  get diagnostics v_n = row_count;
  perform pg_temp.ok(v_n = 0, 'the avdelning cannot end its privilege');

  -- A LineFeeder may only lower or end it, and never below the pallets on the point.
  perform pg_temp.act_as(lf);
  perform pg_temp.expect_error(format('update public.point_allowances set max_pallets = 4 where id = %L', v_allow), 'ONLY_LOWER:3');
  perform pg_temp.expect_error(format('update public.point_allowances set ended_at = now() where id = %L', v_allow), 'PICK_EXTRA_FIRST:3');
  perform pg_temp.expect_error(format('update public.point_allowances set max_pallets = 2 where id = %L', v_allow), 'ALLOWANCE_TOO_LOW:3');

  -- A team leader may raise it; nobody may rewrite who granted it.
  perform pg_temp.act_as(tl);
  perform pg_temp.expect_error(format('update public.point_allowances set granted_by = %L where id = %L', tl, v_allow), 'Only the maximum');
  update public.point_allowances set max_pallets = 4 where id = v_allow;

  -- 7. Pallets can only be picked; Monitor can't pick.
  perform pg_temp.act_as(lf);
  perform pg_temp.expect_error(format('update public.point_pallets set note = %L where id = %L', 'x', v_second), 'only be marked as picked');
  perform pg_temp.act_as(mon);
  update public.point_pallets set picked_at = now() where id = v_third;
  get diagnostics v_n = row_count;
  perform pg_temp.ok(v_n = 0, 'Monitor cannot pick');

  -- 8. The avdelning picks an extra pallet; the privilege stays (2 left).
  perform pg_temp.act_as(dep);
  update public.point_pallets set picked_at = now(), picked_by = tl where id = v_third;
  perform pg_temp.expect_error(format('update public.point_pallets set picked_at = now() where id = %L', v_third), 'already been picked');
  perform pg_temp.act_as(null);
  select * into v_pallet from public.point_pallets where id = v_third;
  perform pg_temp.ok(v_pallet.picked_by = dep and v_pallet.picked_as_extra, 'picked by the avdelning, as an extra pick');
  perform pg_temp.ok((select ended_at from public.point_allowances where id = v_allow) is null, 'privilege still active with 2 pallets');

  -- 9. Back to one pallet: the privilege ends by itself.
  perform pg_temp.act_as(lf);
  update public.point_pallets set picked_at = now() where id = v_second;
  perform pg_temp.act_as(null);
  select * into v_grant from public.point_allowances where id = v_allow;
  perform pg_temp.ok(v_grant.end_reason = 'AUTO' and v_grant.ended_by = lf, 'privilege ended AUTO by the last extra pick');
  perform pg_temp.ok((select status from public.red_points where id = p1) = 'UPPTAGEN', 'still UPPTAGEN with one pallet');
  perform pg_temp.act_as(lf);
  perform pg_temp.expect_error(format('insert into public.point_pallets (point_id) values (%L)', p1), 'PALLET_LIMIT:1');

  -- 10. Picking the last pallet makes the point LEDIG.
  update public.point_pallets set picked_at = now() where id = v_first;
  perform pg_temp.act_as(null);
  perform pg_temp.ok((select status from public.red_points where id = p1) = 'LEDIG', 'last pallet picked -> LEDIG');
  perform pg_temp.ok(not (select picked_as_extra from public.point_pallets where id = v_first), 'the last pick is not extra');

  -- 10b. A LineFeeder may end a privilege early once at most one pallet is left.
  perform pg_temp.act_as(tl);
  insert into public.point_allowances (point_id, max_pallets) values (p1, 2) returning id into v_allow;
  perform pg_temp.act_as(lf);
  update public.point_allowances set ended_at = now() where id = v_allow;
  perform pg_temp.act_as(null);
  select * into v_grant from public.point_allowances where id = v_allow;
  perform pg_temp.ok(v_grant.end_reason = 'MANUAL' and v_grant.ended_by = lf, 'the LineFeeder ended the privilege');

  -- 11. Status buttons: UPPTAGEN registers a pallet; SKRAP closes all of them.
  perform pg_temp.cool_down(lf);
  perform pg_temp.act_as(tl);
  update public.red_points set status = 'UPPTAGEN' where id = p2;
  insert into public.point_allowances (point_id, max_pallets) values (p2, 2) returning id into v_allow2;
  perform pg_temp.act_as(lf);
  insert into public.point_pallets (point_id, note) values (p2, 'extra on T2');
  update public.red_points set status = 'SKRAP' where id = p2;
  perform pg_temp.act_as(null);
  perform pg_temp.ok((select count(*) from public.point_pallets where point_id = p2 and placed_by = tl and not is_extra) = 1,
    'the status button registered the first pallet under the team leader');
  perform pg_temp.ok(public.open_pallet_count(p2) = 0, 'leaving UPPTAGEN closes every pallet');
  perform pg_temp.ok((select end_reason from public.point_allowances where id = v_allow2) = 'STATUS', 'privilege ended by the status change');
  perform pg_temp.ok((select count(*) from public.point_pallets where point_id = p2 and picked_as_extra) = 1, 'one of the two closed as extra');

  -- 12. Reports count every pallet, for the team leader's store only.
  perform pg_temp.act_as(tl);
  v_report := public.get_report(v_from, now() + interval '1 hour', 'day', null);
  perform pg_temp.act_as(null);
  perform pg_temp.ok((v_report #>> '{totals,pallets_placed}')::int = 5, 'pallets_placed = 2 status + 3 extra, got ' || (v_report #>> '{totals,pallets_placed}'));
  perform pg_temp.ok((v_report #>> '{totals,pallets_picked}')::int = 5, 'pallets_picked = 2 status + 3 extra, got ' || (v_report #>> '{totals,pallets_picked}'));
  perform pg_temp.ok((v_report #>> '{totals,extra_pallets_placed}')::int = 3, 'extra_pallets_placed = 3');
  perform pg_temp.ok((v_report #>> '{totals,allowances_granted}')::int = 3, 'allowances_granted = 3');
  perform pg_temp.ok((v_report #>> '{totals,skrap_reported}')::int = 1, 'skrap_reported = 1');
  perform pg_temp.ok(
    (select (u ->> 'allowances_granted')::int = 1 and (u ->> 'pallets_picked')::int = 1
     from jsonb_array_elements(v_report -> 'by_user') u where u ->> 'id' = dep::text),
    'the avdelning user is credited with its grant and its pick');
  perform pg_temp.act_as(dep);
  perform pg_temp.expect_error($q$select public.get_report(now() - interval '1 day', now(), 'day', null)$q$, 'Not allowed');

  -- 13. Deleting the store removes its pallets and privileges too.
  perform pg_temp.act_as(null);
  perform public.delete_facility_data(f);
  perform pg_temp.ok(not exists (select 1 from public.point_pallets where facility_id = f)
    and not exists (select 1 from public.point_allowances where facility_id = f), 'store deletion cleans up');

  raise exception 'EXTRA PALLET TESTS PASSED';
end
$test$;
