import { supabase } from './supabase';
import { User, UserRole } from '../types';

// Wrappers around the admin-users edge function (supabase/functions/admin-users).
// Creating and deleting auth accounts needs the service role, so it runs server-side.

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
    throw new Error(message);
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
  return invoke<{ user: User; temporary_password?: string }>({ action: 'create', ...input });
}

export function deleteAppUser(userId: string) {
  return invoke<{ deleted?: boolean; deactivated?: boolean }>({ action: 'delete', user_id: userId });
}
