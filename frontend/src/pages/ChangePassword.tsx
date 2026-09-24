import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Loader2, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { HOME_ROUTE, useAuth } from '../hooks/useAuth';

const MIN_LENGTH = 8;

function translateError(message: string) {
  if (/different from the old password/i.test(message)) {
    return 'Det nya lösenordet måste skilja sig från det tillfälliga.';
  }
  if (/weak|pwned|leaked|characters/i.test(message)) {
    return 'Lösenordet är för svagt eller har läckt tidigare. Välj ett annat.';
  }
  if (/reauthentication|nonce/i.test(message)) {
    return 'Logga ut och in igen, och byt sedan lösenord.';
  }
  return 'Kunde inte byta lösenord. Försök igen.';
}

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user, signOut, refreshProfile } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forced = user?.must_change_password === true;
  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSave = password.length >= MIN_LENGTH && password === confirm && !saving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      console.error('Error changing password:', updateError);
      setError(translateError(updateError.message));
      setSaving(false);
      return;
    }

    // The database clears must_change_password when the password changes.
    const profile = await refreshProfile();
    setSaving(false);
    toast.success('Lösenordet är bytt!');
    navigate(profile ? HOME_ROUTE[profile.role] : '/', { replace: true });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-block p-3 bg-indigo-100 rounded-full mb-4">
            <KeyRound className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {forced ? 'Välj ett nytt lösenord' : 'Byt lösenord'}
          </h1>
          <p className="text-gray-600 text-sm">
            {forced
              ? 'Du loggade in med ett tillfälligt lösenord. Välj ett eget lösenord för att fortsätta.'
              : 'Ange ditt nya lösenord två gånger.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
              Nytt lösenord
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder={`Minst ${MIN_LENGTH} tecken`}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={show ? 'Dölj lösenord' : 'Visa lösenord'}
              >
                {show ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {tooShort && <p className="text-red-500 text-sm mt-1">Minst {MIN_LENGTH} tecken.</p>}
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
              Upprepa nytt lösenord
            </label>
            <input
              id="confirm-password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {mismatch && <p className="text-red-500 text-sm mt-1">Lösenorden matchar inte.</p>}
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSave}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="animate-spin" size={20} /> : <KeyRound size={20} />}
            {saving ? 'Sparar...' : 'Spara nytt lösenord'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          {!forced ? (
            <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-800">
              Avbryt
            </button>
          ) : (
            <span />
          )}
          <button onClick={handleSignOut} className="flex items-center gap-1 text-gray-600 hover:text-gray-800">
            <LogOut size={16} />
            Logga ut
          </button>
        </div>
      </div>
    </div>
  );
}
