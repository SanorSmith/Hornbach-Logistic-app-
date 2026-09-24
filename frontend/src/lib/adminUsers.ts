import { supabase } from './supabase';
import { User, UserRole } from '../types';

// Wrappers around the admin-users edge function (supabase/functions/admin-users).
// Creating and deleting auth accounts needs the service role, so it runs server-side.

// Supabase Auth answers in English; show the common cases in Swedish.
function translateError(message: string) {
  if (/validate email|invalid format|invalid email/i.test(message)) {
    return 'Ogiltig e-postadress. Kontrollera stavningen, t.ex. namn@hornbach.se (inga mellanslag eller å/ä/ö).';
  }
  if (/already (been )?registered|already exists|duplicate/i.test(message)) {
    return 'Det finns redan ett konto med den e-postadressen.';
  }
  if (/password/i.test(message)) {
    return 'Lösenordet är för svagt. Använd minst 8 tecken.';
  }
  return message;
}

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) {
    // Surface the function's own error message when there is one.
    let message = error.message;
    try {
      const payload = await (error as { context?: Response }).context?.json();
      if (payload?.error) message = payload.error;
    } catch {
      // ignore - keep the generic message
    }
    throw new Error(translateError(message));
  }
  return data as T;
}

export function createAppUser(input: {
  email: string;
  full_name: string;
  role: UserRole;
  department_id?: string | null;
  password?: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    return Promise.reject(new Error(translateError('invalid email')));
  }
  return invoke<{ user: User; temporary_password?: string }>({ action: 'create', ...input, email });
}

export function deleteAppUser(userId: string) {
  return invoke<{ deleted?: boolean; deactivated?: boolean }>({ action: 'delete', user_id: userId });
}
