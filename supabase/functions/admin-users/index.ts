// admin-users: create and delete app users, and create facilities.
//
// Creating/deleting Supabase Auth accounts needs the service role key, which
// must never be shipped to the browser. This function runs server-side, checks
// the caller's role and facility, and then performs the privileged operation.
//
// ADMIN / TEAM_LEADER (users of their own facility):
//   POST { action: "create", email, full_name, role, department_id?, password? }
//     -> { user, temporary_password? }
//   POST { action: "delete", user_id }
//     -> { deleted: true } or { deactivated: true } when the user has history
//
// SUPER_ADMIN (facilities and their ADMIN accounts):
//   POST { action: "create_facility", facility: { code, name, location?, address?, phone? },
//          admin: { email, full_name, password? } }
//     -> { facility_id, user?, temporary_password?, admin_error? }
//   POST { action: "create", facility_id, email, full_name, password? }   (role is always ADMIN)
//   POST { action: "delete", user_id }                                   (ADMIN accounts only)
//   POST { action: "delete_facility", facility_id, confirm_code }
//     -> { deleted: true, users: n, photos: n }   (confirm_code must equal the store number)

import { createClient } from 'npm:@supabase/supabase-js@2';
import { deactivateUser } from './deactivate.ts';

const ROLES = ['ADMIN', 'TEAM_LEADER', 'LINEFEEDER', 'MONITOR', 'DEPARTMENT'] as const;
type Role = (typeof ROLES)[number];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Errors from Supabase Auth / Postgres are logged here and turned into short
// Swedish messages for the app, so internal details (constraint and function
// names, raw SQL errors) are not sent to the browser.
function friendlyError(context: string, error: { message?: string } | null | undefined, fallback: string) {
  const message = error?.message ?? '';
  console.error(`admin-users ${context}:`, message);
  if (/already (been )?registered|already exists|duplicate key.*email/i.test(message)) {
    return 'Det finns redan ett konto med den e-postadressen.';
  }
  if (/invalid.*email|email.*invalid|validate email/i.test(message)) {
    return 'Ogiltig e-postadress.';
  }
  if (/password/i.test(message)) return 'Lösenordet är för svagt. Använd minst 8 tecken.';
  return fallback;
}

function generatePassword(length = 14) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Identify the caller from their JWT.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Not authenticated' }, 401);

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: 'Not authenticated' }, 401);

  const { data: caller } = await admin
    .from('users')
    .select('id, role, is_active, facility_id, must_change_password')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (!caller || !caller.is_active || !['ADMIN', 'TEAM_LEADER', 'SUPER_ADMIN'].includes(caller.role)) {
    return json({ error: 'Forbidden' }, 403);
  }
  // A temporary password must be changed before the account can manage users.
  if (caller.must_change_password) {
    return json({ error: 'Byt ditt tillfälliga lösenord först.' }, 403);
  }
  const callerIsSuperAdmin = caller.role === 'SUPER_ADMIN';
  const callerIsAdmin = caller.role === 'ADMIN';

  if (!callerIsSuperAdmin) {
    // Facility users only act while their facility is open.
    const { data: facility } = await admin
      .from('facilities')
      .select('is_active')
      .eq('id', caller.facility_id)
      .maybeSingle();
    if (!facility?.is_active) return json({ error: 'Forbidden' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  // Creates the auth account and profile; rolls the account back on failure.
  async function createAccount(input: {
    email: string;
    fullName: string;
    role: Role;
    facilityId: string;
    departmentId: string | null;
    suppliedPassword: string;
  }) {
    const password = input.suppliedPassword || generatePassword();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: input.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName, role: input.role },
    });
    if (createError || !created.user) {
      return { error: friendlyError('createUser', createError, 'Kunde inte skapa kontot.') };
    }

    const { data: profile, error: profileError } = await admin
      .from('users')
      .insert({
        id: created.user.id,
        email: input.email,
        full_name: input.fullName,
        role: input.role,
        department_id: input.departmentId,
        facility_id: input.facilityId,
        is_active: true,
        // The admin chose or generated this password: the user must pick their own.
        must_change_password: true,
      })
      .select()
      .single();

    if (profileError) {
      // Roll back the auth account so we don't leave orphans behind.
      await admin.auth.admin.deleteUser(created.user.id);
      return { error: friendlyError('insert profile', profileError, 'Kunde inte spara användarprofilen.') };
    }

    return {
      user: profile,
      temporary_password: input.suppliedPassword ? undefined : password,
    };
  }

  function readAccountInput(source: Record<string, unknown>) {
    const email = String(source.email ?? '').trim().toLowerCase();
    const fullName = String(source.full_name ?? '').trim();
    const suppliedPassword = source.password ? String(source.password) : '';
    if (!email || !fullName) return { error: 'E-post och namn krävs' };
    if (suppliedPassword && suppliedPassword.length < 8) {
      return { error: 'Lösenordet måste vara minst 8 tecken' };
    }
    return { email, fullName, suppliedPassword };
  }

  if (body.action === 'create_facility') {
    if (!callerIsSuperAdmin) return json({ error: 'Endast superadmin kan skapa butiker' }, 403);

    const facility = (body.facility ?? {}) as Record<string, unknown>;
    const account = readAccountInput((body.admin ?? {}) as Record<string, unknown>);
    if ('error' in account) return json({ error: account.error }, 400);

    const code = String(facility.code ?? '').trim();
    const name = String(facility.name ?? '').trim();
    if (!/^[0-9A-Za-z-]{1,12}$/.test(code)) {
      return json({ error: 'Butiksnummer får bara innehålla siffror, bokstäver och bindestreck' }, 400);
    }
    if (!name) return json({ error: 'Butiksnamn krävs' }, 400);

    // Run as the caller so create_facility() can check that they are a super admin.
    const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: facilityId, error: facilityError } = await asCaller.rpc('create_facility', {
      p_code: code,
      p_name: name,
      p_location: facility.location ? String(facility.location) : null,
      p_address: facility.address ? String(facility.address) : null,
      p_phone: facility.phone ? String(facility.phone) : null,
    });
    if (facilityError || !facilityId) {
      const message = facilityError?.message ?? '';
      if (message.startsWith('FACILITY_EXISTS:')) {
        return json({ error: message.replace(/^FACILITY_EXISTS:\s*/, '') }, 400);
      }
      return json({ error: friendlyError('create_facility', facilityError, 'Kunde inte skapa butiken.') }, 400);
    }

    const result = await createAccount({ ...account, role: 'ADMIN', facilityId, departmentId: null });
    if ('error' in result) {
      // The facility exists; the admin can be added again from the panel.
      return json({ facility_id: facilityId, admin_error: result.error });
    }
    return json({ facility_id: facilityId, ...result });
  }

  if (body.action === 'delete_facility') {
    if (!callerIsSuperAdmin) return json({ error: 'Endast superadmin kan radera butiker' }, 403);

    const facilityId = String(body.facility_id ?? '');
    const { data: facility } = await admin
      .from('facilities')
      .select('id, code')
      .eq('id', facilityId)
      .maybeSingle();
    if (!facility) return json({ error: 'Okänd butik' }, 404);
    // Guard against deleting the wrong store: the super admin types its number.
    if (String(body.confirm_code ?? '').trim().toLowerCase() !== facility.code.toLowerCase()) {
      return json({ error: 'Butiksnumret stämmer inte' }, 400);
    }

    const { data: plan, error: planError } = await admin.rpc('facility_deletion_plan', { p_facility_id: facilityId });
    if (planError) return json({ error: friendlyError('deletion plan', planError, 'Kunde inte radera butiken.') }, 400);
    const userIds = (plan?.user_ids ?? []) as string[];
    const objectPaths = (plan?.object_paths ?? []) as string[];

    // Photos first: once the rows are gone we can no longer find the files.
    for (let i = 0; i < objectPaths.length; i += 100) {
      const { error } = await admin.storage.from('point-images').remove(objectPaths.slice(i, i + 100));
      if (error) return json({ error: friendlyError('remove photos', error, 'Kunde inte radera butikens bilder.') }, 400);
    }

    // All rows in one transaction.
    const { error: deleteError } = await admin.rpc('delete_facility_data', { p_facility_id: facilityId });
    if (deleteError) return json({ error: friendlyError('delete facility', deleteError, 'Kunde inte radera butiken.') }, 400);

    // Finally the login accounts (their profiles are already gone).
    const failed: string[] = [];
    for (const userId of userIds) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error && !/not.*found/i.test(error.message)) failed.push(userId);
    }
    if (failed.length > 0) {
      return json({ deleted: true, users: userIds.length, photos: objectPaths.length, auth_cleanup_failed: failed.length });
    }
    return json({ deleted: true, users: userIds.length, photos: objectPaths.length });
  }

  if (body.action === 'create') {
    const account = readAccountInput(body);
    if ('error' in account) return json({ error: account.error }, 400);

    let role = String(body.role ?? '') as Role;
    let facilityId: string = caller.facility_id;
    let departmentId = body.department_id ? String(body.department_id) : null;

    if (callerIsSuperAdmin) {
      // A super admin only creates facility admins.
      role = 'ADMIN';
      departmentId = null;
      facilityId = String(body.facility_id ?? '');
      const { data: facility } = await admin.from('facilities').select('id').eq('id', facilityId).maybeSingle();
      if (!facility) return json({ error: 'Okänd butik' }, 400);
    } else {
      if (!ROLES.includes(role)) return json({ error: 'Ogiltig roll' }, 400);
      if (role === 'ADMIN' && !callerIsAdmin) {
        return json({ error: 'Endast admin kan skapa admin-konton' }, 403);
      }
      if (departmentId) {
        const { data: department } = await admin
          .from('departments')
          .select('id')
          .eq('id', departmentId)
          .eq('facility_id', facilityId)
          .maybeSingle();
        if (!department) return json({ error: 'Okänd avdelning' }, 400);
      }
    }

    const result = await createAccount({ ...account, role, facilityId, departmentId });
    if ('error' in result) return json({ error: result.error }, 400);
    return json(result);
  }

  if (body.action === 'delete') {
    const userId = String(body.user_id ?? '');
    if (!userId) return json({ error: 'user_id krävs' }, 400);
    if (userId === caller.id) return json({ error: 'Du kan inte radera ditt eget konto' }, 400);

    const { data: target } = await admin
      .from('users')
      .select('id, role, facility_id')
      .eq('id', userId)
      .maybeSingle();

    // Only users you manage: your own facility's, or a facility admin for a super admin.
    if (!target) return json({ error: 'Användaren hittades inte' }, 404);
    if (callerIsSuperAdmin ? target.role !== 'ADMIN' : target.facility_id !== caller.facility_id) {
      return json({ error: 'Forbidden' }, 403);
    }
    if (target.role === 'ADMIN' && !callerIsAdmin && !callerIsSuperAdmin) {
      return json({ error: 'Endast admin kan radera admin-konton' }, 403);
    }

    const { error: deleteError } = await admin.from('users').delete().eq('id', userId);
    if (deleteError) {
      // User is referenced by status history / notifications: keep the row
      // for the audit trail, deactivate it and block sign-in instead.
      const failure = await deactivateUser(admin, userId);
      if (failure) {
        return json({ error: friendlyError(failure.context, failure.error, 'Kunde inte inaktivera användaren. Försök igen.') }, 400);
      }
      return json({ deactivated: true });
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError && !/not.*found/i.test(authDeleteError.message)) {
      return json({ error: friendlyError('delete auth user', authDeleteError, 'Kunde inte radera inloggningen.') }, 400);
    }
    return json({ deleted: true });
  }

  return json({ error: 'Unknown action' }, 400);
});
