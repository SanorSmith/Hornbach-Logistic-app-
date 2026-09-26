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
}

export interface FakeSupabase {
  /** PATCH bodies sent to red_points, in order. */
  statusUpdates: { id: string; body: Record<string, unknown> }[];
  points: ReturnType<typeof makePoints>['points'];
}

export async function fakeSupabase(page: Page, account: FakeUser): Promise<FakeSupabase> {
  const { points, assignments } = makePoints();
  const state: FakeSupabase = { statusUpdates: [], points };
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
    if (table === 'point_images' || table === 'notifications' || table === 'status_history') return rows(route, []);
    if (table === 'rpc/limited_change_wait_seconds') return json(route, 0);

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
