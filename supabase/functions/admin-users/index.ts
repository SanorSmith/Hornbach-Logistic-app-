// admin-users: create and delete app users.
//
// Creating/deleting Supabase Auth accounts needs the service role key, which
// must never be shipped to the browser. This function runs server-side, checks
// that the caller is an active ADMIN or TEAM_LEADER, and then performs the
// privileged operation.
//
// POST { action: "create", email, full_name, role, department_id?, password? }
//   -> { user, temporary_password? }
// POST { action: "delete", user_id }
//   -> { deleted: true } or { deactivated: true } when the user has history

import { createClient } from 'npm:@supabase/supabase-js@2';

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
    .select('id, role, is_active')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (!caller || !caller.is_active || !['ADMIN', 'TEAM_LEADER'].includes(caller.role)) {
    return json({ error: 'Forbidden' }, 403);
  }
  const callerIsAdmin = caller.role === 'ADMIN';

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (body.action === 'create') {
    const email = String(body.email ?? '').trim().toLowerCase();
    const fullName = String(body.full_name ?? '').trim();
    const role = String(body.role ?? '') as Role;
    const departmentId = body.department_id ? String(body.department_id) : null;
    const suppliedPassword = body.password ? String(body.password) : '';

    if (!email || !fullName) return json({ error: 'E-post och namn krävs' }, 400);
    if (!ROLES.includes(role)) return json({ error: 'Ogiltig roll' }, 400);
    if (role === 'ADMIN' && !callerIsAdmin) {
      return json({ error: 'Endast admin kan skapa admin-konton' }, 403);
    }
    if (suppliedPassword && suppliedPassword.length < 8) {
      return json({ error: 'Lösenordet måste vara minst 8 tecken' }, 400);
    }

    const password = suppliedPassword || generatePassword();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    if (createError || !created.user) {
      return json({ error: createError?.message ?? 'Kunde inte skapa konto' }, 400);
    }

    const { data: profile, error: profileError } = await admin
      .from('users')
      .insert({
        id: created.user.id,
        email,
        full_name: fullName,
        role,
        department_id: departmentId,
        is_active: true,
        // The admin chose or generated this password: the user must pick their own.
        must_change_password: true,
      })
      .select()
      .single();

    if (profileError) {
      // Roll back the auth account so we don't leave orphans behind.
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: profileError.message }, 400);
    }

    return json({
      user: profile,
      temporary_password: suppliedPassword ? undefined : password,
    });
  }

  if (body.action === 'delete') {
    const userId = String(body.user_id ?? '');
    if (!userId) return json({ error: 'user_id krävs' }, 400);
    if (userId === caller.id) return json({ error: 'Du kan inte radera ditt eget konto' }, 400);

    const { data: target } = await admin
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    if (target?.role === 'ADMIN' && !callerIsAdmin) {
      return json({ error: 'Endast admin kan radera admin-konton' }, 403);
    }

    if (target) {
      const { error: deleteError } = await admin.from('users').delete().eq('id', userId);
      if (deleteError) {
        // User is referenced by status history / notifications: keep the row
        // for the audit trail, deactivate it and block sign-in instead.
        await admin.from('users').update({ is_active: false }).eq('id', userId);
        await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
        return json({ deactivated: true });
      }
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError && !/not.*found/i.test(authDeleteError.message)) {
      return json({ error: authDeleteError.message }, 400);
    }
    return json({ deleted: true });
  }

  return json({ error: 'Unknown action' }, 400);
});
