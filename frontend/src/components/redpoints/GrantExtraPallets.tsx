import { useState } from 'react';
import { Layers, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { loadPallets } from '../../hooks/usePallets';
import { grantAllowance, MAX_PALLETS, MIN_PALLETS, palletErrorMessage } from '../../lib/pallets';

interface GrantExtraPalletsProps {
  pointId: string;
}

const PALLET_OPTIONS = Array.from({ length: MAX_PALLETS - MIN_PALLETS + 1 }, (_, i) => MIN_PALLETS + i);

/**
 * "Tillåt extra pallar": a button that opens a small form (how many pallets,
 * who authorized it, why) which is saved only when confirmed. Who authorized
 * it is always required, whoever is signed in (the database enforces it too).
 */
export default function GrantExtraPallets({ pointId }: GrantExtraPalletsProps) {
  const [open, setOpen] = useState(false);
  const [maxPallets, setMaxPallets] = useState(MIN_PALLETS);
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missingAuthorizer = authorizedBy.trim() === '';

  const close = () => {
    setOpen(false);
    setError(null);
  };

  const confirm = async () => {
    if (missingAuthorizer) {
      setError('Skriv namnet på den som godkände extra pallar.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await grantAllowance(pointId, maxPallets, note, authorizedBy);
      await loadPallets();
      toast.success(`Punkten får ha ${maxPallets} pallar`);
      setOpen(false);
      setAuthorizedBy('');
      setNote('');
    } catch (e) {
      console.error('Error granting extra pallets:', e);
      setError(palletErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 transition"
      >
        <Layers size={20} aria-hidden="true" />
        Tillåt extra pallar
      </button>
    );
  }

  return (
    <fieldset className="rounded-lg border-2 border-indigo-300 bg-indigo-50 p-3 space-y-3">
      <legend className="px-1 text-sm font-semibold text-indigo-900">Tillåt extra pallar</legend>

      <label className="flex items-center justify-between gap-2 text-sm text-gray-700">
        Antal pallar
        <select
          value={maxPallets}
          onChange={(e) => setMaxPallets(Number(e.target.value))}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-base"
        >
          {PALLET_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm text-gray-700">
        Godkänt av
        <input
          type="text"
          value={authorizedBy}
          onChange={(e) => setAuthorizedBy(e.target.value)}
          maxLength={100}
          required
          aria-required="true"
          placeholder="Namn på den som godkände"
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base"
        />
      </label>

      <label className="block text-sm text-gray-700">
        Anledning (valfritt)
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="t.ex. kampanj"
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base"
        />
      </label>

      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={close}
          disabled={saving}
          className="flex-1 rounded-lg bg-white py-2.5 font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          Ångra
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={saving || missingAuthorizer}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving && <Loader2 size={18} className="animate-spin" />}
          Bekräfta
        </button>
      </div>
    </fieldset>
  );
}
