import type { Page, Route } from '@playwright/test';

// A small in-memory Supabase for the browser tests: auth, the REST tables the
// app reads and the status update it writes. Realtime (websocket) is not
// faked; the app works without it.

export type Role = 'ADMIN' | 'TEAM_LEADER' | 'LINEFEEDER' | 'MONITOR' | 'DEPARTMENT' | 'SUPER_ADMIN';
type Status = 'LEDIG' | 'UPPTAGEN' | 'SKRAP' | 'KUNDORDER';

const FACILITY = { id: 'f772', code: '772', name: 'Norsborg', location: 'Botkyrka', address: null, phone: null, is_active: true, created_at: '2026-01-01T00:00:00Z' };

const DEPARTMENTS = [
  { id: 'd-jarn', name: 'Järn', location: 'Botkyrka', is_active: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 'd-bygg', name: 'Bygg', location: 'Botkyrka', is_active: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 'd-gm', name: 'GM', location: 'Botkyrka', is_active: true, created_at: '2026-01-01T00:00:00Z' },
];

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();

function makePoints() {
  const spec: [number, Status, number, string, string][] = [
    // number, status, hours in status, department, name in department
    [1, 'LEDIG', 3, 'd-jarn', 'J1'],
    [2, 'UPPTAGEN', 2, 'd-jarn', 'J2'],
    [3, 'UPPTAGEN', 30, 'd-jarn', 'J3'],
    [4, 'SKRAP', 1, 'd-bygg', 'IB1'],
    [5, 'KUNDORDER', 1, 'd-bygg', 'IB2'],
    [6, 'LEDIG', 5, 'd-bygg', 'IB3'],
  ];
  const points = spec.map(([n, status, h, dep]) => ({
    id: `p${n}`,
    point_number: n,
    department_id: 'd-gm',
    facility_id: FACILITY.id,
    status,
    qr_code: `RP-${String(n).padStart(3, '0')}`,
    location_x: null,
    location_y: null,
    current_user_id: null,
    last_updated: hoursAgo(h),
    status_changed_at: hoursAgo(h),
    is_active: true,
    created_at: hoursAgo(1000),
    _dep: dep,
  }));
  const assignments = spec.map(([n, , , dep, name]) => ({
    id: `a${n}`,
    point_id: `p${n}`,
    department_id: dep,
    department_number: name,
    facility_id: FACILITY.id,
  }));
  return { points: points.map(({ _dep, ...p }) => (void _dep, p)), assignments };
}

function jwt(sub: string) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', exp, aud: 'authenticated' })}.sig`;
}

export interface FakeUser {
  role: Role;
  full_name?: string;
  department_id?: string | null;
  must_change_password?: boolean;
  is_active?: boolean;
  facility_open?: boolean;
  password?: string;
  /** J2 (d-jarn) may hold 3 pallets and has 2 on it. */
  extraPallets?: boolean;
}

function makeExtraPallets(): { pallets: FakePallet[]; allowances: FakeAllowance[] } {
  const placer = { full_name: 'Lars LineFeeder' };
  return {
    allowances: [
      { id: 'a1', point_id: 'p2', max_pallets: 3, note: 'Kampanj', granted_by: 'u9', granted_at: hoursAgo(3), ended_at: null, granter: { full_name: 'Jonas Järn' } },
    ],
    pallets: [
      { id: 'pl1', point_id: 'p2', is_extra: false, image_id: null, note: null, placed_by: 'u8', placed_at: hoursAgo(2), picked_at: null, placer },
      { id: 'pl2', point_id: 'p2', is_extra: true, image_id: null, note: 'Grillkol', placed_by: 'u8', placed_at: hoursAgo(1), picked_at: null, placer },
    ],
  };
}

export interface FakeSupabase {
  /** PATCH bodies sent to red_points, in order. */
  statusUpdates: { id: string; body: Record<string, unknown> }[];
  points: ReturnType<typeof makePoints>['points'];
  /** Extra pallets: pallets on points and the privileges (see 20260926130000_extra_pallets.sql). */
  pallets: FakePallet[];
  allowances: FakeAllowance[];
  /** Bodies POSTed / PATCHed to point_allowances and point_pallets, in order. */
  palletWrites: { table: string; method: string; body: Record<string, unknown> }[];
}

interface FakePallet {
  id: string;
  point_id: string;
  is_extra: boolean;
  image_id: string | null;
  note: string | null;
  placed_by: string;
  placed_at: string;
  picked_at: string | null;
  placer: { full_name: string };
}

interface FakeAllowance {
  id: string;
  point_id: string;
  max_pallets: number;
  note: string | null;
  granted_by: string;
  granted_at: string;
  ended_at: string | null;
  granter: { full_name: string };
}

export async function fakeSupabase(page: Page, account: FakeUser): Promise<FakeSupabase> {
  const { points, assignments } = makePoints();
  const extra = account.extraPallets ? makeExtraPallets() : { pallets: [], allowances: [] };
  const state: FakeSupabase = { statusUpdates: [], points, ...extra, palletWrites: [] };
  const email = 'anna@hornbach.se';
  const password = account.password ?? 'rätt-lösenord';
  const authUser = { id: 'u1', aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const profile = {
    id: 'u1',
    email,
    full_name: account.full_name ?? 'Anna Andersson',
    role: account.role,
    department_id: account.department_id ?? null,
    facility_id: account.role === 'SUPER_ADMIN' ? null : FACILITY.id,
    is_active: account.is_active ?? true,
    must_change_password: account.must_change_password ?? false,
    created_at: '2026-01-01T00:00:00Z',
    last_login: null,
    facility: account.role === 'SUPER_ADMIN' || account.facility_open === false ? null : FACILITY,
  };

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  // PostgREST: .single()/.maybeSingle() ask for one object, other reads for an array.
  const rows = (route: Route, data: unknown[]) => {
    const wantsObject = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
    return json(route, wantsObject ? (data[0] ?? null) : data);
  };

  await page.route('http://supabase.test/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });

    // --- Auth ---
    if (path === '/auth/v1/token') {
      const body = request.postDataJSON() as { email?: string; password?: string };
      if (body.password !== password) {
        return json(route, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials' }, 400);
      }
      return json(route, {
        access_token: jwt('u1'),
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'refresh',
        user: authUser,
      });
    }
    if (path === '/auth/v1/user') return json(route, authUser);
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204 });

    // --- REST ---
    const table = path.replace('/rest/v1/', '');
    if (table === 'users') {
      if (method === 'PATCH') return route.fulfill({ status: 204 });
      return rows(route, [profile]);
    }
    if (table === 'red_points') {
      if (method === 'PATCH') {
        const id = (url.searchParams.get('id') ?? '').replace('eq.', '');
        const body = request.postDataJSON() as Record<string, unknown>;
        state.statusUpdates.push({ id, body });
        const point = state.points.find((p) => p.id === id);
        if (point && typeof body.status === 'string') {
          point.status = body.status as Status;
          point.status_changed_at = new Date().toISOString();
        }
        return route.fulfill({ status: 204 });
      }
      const id = url.searchParams.get('id');
      return rows(route, id ? state.points.filter((p) => `eq.${p.id}` === id) : state.points);
    }
    if (table === 'department_point_assignments') {
      const pointId = url.searchParams.get('point_id');
      const list = pointId ? assignments.filter((a) => `eq.${a.point_id}` === pointId) : assignments;
      // usePointDetails embeds the department.
      return rows(route, list.map((a) => ({ ...a, department: DEPARTMENTS.find((d) => d.id === a.department_id) })));
    }
    if (table === 'departments') return rows(route, DEPARTMENTS);
    if (table === 'facilities') return rows(route, [FACILITY]);
    // Photos: the upload and its row are accepted; no photos are listed.
    if (path.startsWith('/storage/v1/object/point-images/') && method === 'POST') return json(route, { Key: path });
    if (table === 'point_images' && method === 'POST') return rows(route, [{ id: `img-${Date.now()}` }]);
    if (table === 'point_images' || table === 'notifications' || table === 'status_history') return rows(route, []);
    if (table === 'rpc/limited_change_wait_seconds') return json(route, 0);

    // Extra pallets. The rules themselves are tested against the database
    // (supabase/tests/extra_pallets_test.sql); this only stores what the app sends.
    if (table === 'point_allowances') {
      if (method === 'POST') {
        const body = request.postDataJSON() as Record<string, unknown>;
        state.palletWrites.push({ table, method, body });
        state.allowances.unshift({
          id: `a${state.allowances.length + 2}`,
          point_id: String(body.point_id),
          max_pallets: Number(body.max_pallets),
          note: (body.note as string | null) ?? null,
          granted_by: 'u1',
          granted_at: new Date().toISOString(),
          ended_at: null,
          granter: { full_name: profile.full_name },
        });
        return route.fulfill({ status: 201 });
      }
      if (method === 'PATCH') {
        state.palletWrites.push({ table, method, body: request.postDataJSON() as Record<string, unknown> });
        return route.fulfill({ status: 204 });
      }
      return rows(route, state.allowances.filter((a) => !a.ended_at));
    }
    if (table === 'point_pallets') {
      if (method === 'PATCH') {
        const id = (url.searchParams.get('id') ?? '').replace('eq.', '');
        state.palletWrites.push({ table, method, body: { id, ...(request.postDataJSON() as Record<string, unknown>) } });
        const pallet = state.pallets.find((p) => p.id === id);
        if (pallet) pallet.picked_at = new Date().toISOString();
        return json(route, pallet ? [{ id }] : []);
      }
      if (method === 'POST') {
        const body = request.postDataJSON() as Record<string, unknown>;
        state.palletWrites.push({ table, method, body });
        const pointId = String(body.point_id);
        state.pallets.push({
          id: `pl${state.pallets.length + 1}`,
          point_id: pointId,
          is_extra: state.pallets.some((p) => p.point_id === pointId && !p.picked_at),
          image_id: (body.image_id as string | null) ?? null,
          note: (body.note as string | null) ?? null,
          placed_by: 'u1',
          placed_at: new Date().toISOString(),
          picked_at: null,
          placer: { full_name: profile.full_name },
        });
        return route.fulfill({ status: 201 });
      }
      const pointId = url.searchParams.get('point_id');
      return rows(route, state.pallets.filter((p) => !p.picked_at && (!pointId || `eq.${p.point_id}` === pointId)));
    }

    return json(route, { message: `fakeSupabase: unhandled ${method} ${path}` }, 404);
  });

  return state;
}

export async function logIn(page: Page, password = 'rätt-lösenord') {
  await page.goto('/login');
  await page.getByLabel('E-postadress').fill('anna@hornbach.se');
  await page.getByLabel('Lösenord').fill(password);
  await page.getByRole('button', { name: 'Logga in' }).click();
}
