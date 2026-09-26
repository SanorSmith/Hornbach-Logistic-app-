import { useEffect, useState } from 'react';
import { Layers, Loader2, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { RedPoint } from '../../types';
import { usePalletsStore } from '../../store/palletsStore';
import { loadPallets } from '../../hooks/usePallets';
import {
  allowanceAuthorizer,
  changeAllowance,
  endAllowance,
  MAX_PALLETS,
  MIN_PALLETS,
  palletErrorMessage,
  palletSummary,
  pickPallet,
} from '../../lib/pallets';
import { getImageUrls } from '../../lib/pointImages';

export interface PalletAccess {
  /** Register pallets with "Markera som Upptagen" (LineFeeder, team leader, admin). */
  canPlace?: boolean;
  /** Mark a pallet as picked. */
  canPick?: boolean;
  /**
   * "Tillåt extra pallar" (LineFeeder, team leader, admin; never the
   * avdelning). Shown in the dialog under the status buttons.
   */
  canGrant?: boolean;
  /** Lower the maximum or end the privilege (LineFeeder, team leader, admin). */
  canChange?: boolean;
  /** Raise the maximum (LineFeeder, team leader, admin). */
  canRaise?: boolean;
}

interface PointPalletsPanelProps extends Pick<PalletAccess, 'canPick' | 'canChange' | 'canRaise'> {
  point: RedPoint;
}

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: sv });

/**
 * The pallets on a point and its extra pallet privilege ("Extrapallar").
 * Shown only while the point may or does hold more than one pallet. Pallets
 * are added with "Markera som Upptagen"; the privilege is granted with
 * "Tillåt extra pallar" (GrantExtraPallets) under the status buttons.
 */
export default function PointPalletsPanel({
  point,
  canPick = false,
  canChange = false,
  canRaise = false,
}: PointPalletsPanelProps) {
  const pallets = usePalletsStore((state) => state.pallets);
  const allowances = usePalletsStore((state) => state.allowances);
  const { open, allowance, max } = palletSummary(pallets, allowances, point.id);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newMax, setNewMax] = useState<number | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const imageKey = open.flatMap((p) => (p.image_id ? [p.image_id] : [])).join(',');
  useEffect(() => {
    if (!imageKey) return;
    let cancelled = false;
    getImageUrls(imageKey.split(','))
      .then((urls) => !cancelled && setPhotoUrls(urls))
      .catch((e) => console.error('Error loading pallet photos:', e));
    return () => {
      cancelled = true;
    };
  }, [imageKey]);

  if (!allowance && open.length <= 1) return null;

  const shownMax = newMax ?? allowance?.max_pallets ?? MIN_PALLETS;
  // Never below what stands on the point; above the current maximum only with canRaise.
  const maxOptions = allowance
    ? range(Math.max(MIN_PALLETS, open.length), canRaise ? MAX_PALLETS : allowance.max_pallets)
    : [];

  const run = async (key: string, action: () => Promise<void>, success: string) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      await loadPallets();
      toast.success(success);
    } catch (e) {
      console.error('Pallet action failed:', e);
      setError(palletErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label="Pallar på punkten" className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-indigo-900">
        <Layers size={16} aria-hidden="true" />
        Pallar på punkten
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs">
          {open.length}/{max}
        </span>
      </h3>

      {allowance && (
        <p className="mt-1 text-xs text-indigo-900">
          Extra pallar tillåtna (max {allowance.max_pallets}) av {allowanceAuthorizer(allowance)},{' '}
          {ago(allowance.granted_at)}.
          {allowance.note && <span className="block italic">”{allowance.note}”</span>}
          {!canChange && <span className="block">Tillståndet hanteras av LineFeeder.</span>}
        </p>
      )}

      {open.length > 0 && (
        <ul className="mt-2 space-y-2">
          {open.map((pallet, i) => (
            <li key={pallet.id} className="flex items-center gap-3 rounded-md bg-white p-2 shadow-sm">
              {pallet.image_id && photoUrls[pallet.image_id] ? (
                <img
                  src={photoUrls[pallet.image_id]}
                  alt={`Foto av pall ${i + 1}`}
                  className="h-12 w-12 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-gray-100 text-gray-400">
                  <Package size={20} aria-hidden="true" />
                </div>
              )}
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium text-gray-800">
                  Pall {i + 1}
                  {pallet.is_extra && <span className="ml-1 text-xs font-normal text-indigo-700">extra</span>}
                </p>
                <p className="text-xs text-gray-500">
                  {pallet.placer?.full_name ?? 'Okänd'} · {ago(pallet.placed_at)}
                </p>
                {pallet.note && <p className="break-words text-xs text-gray-700">{pallet.note}</p>}
              </div>
              {canPick && open.length > 1 && (
                <button
                  type="button"
                  onClick={() => run(`pick-${pallet.id}`, () => pickPallet(pallet.id), 'Pallen är plockad')}
                  disabled={busy !== null}
                  aria-label={`Pall ${i + 1} plockad`}
                  className="shrink-0 rounded-lg bg-ledig px-3 py-2 text-xs font-semibold text-white hover:bg-ledig-dark disabled:opacity-50"
                >
                  {busy === `pick-${pallet.id}` ? <Loader2 size={14} className="animate-spin" /> : 'Plockad'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {allowance && canChange && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {maxOptions.length > 1 && (
            <>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                Max pallar
                <select
                  value={shownMax}
                  onChange={(e) => setNewMax(Number(e.target.value))}
                  className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {maxOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() =>
                  run('change', async () => {
                    await changeAllowance(allowance.id, shownMax);
                    setNewMax(null);
                  }, `Nu tillåts max ${shownMax} pallar`)
                }
                disabled={busy !== null || shownMax === allowance.max_pallets}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50 disabled:opacity-50"
              >
                Ändra
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => run('end', () => endAllowance(allowance.id), 'Tillståndet är avslutat')}
            disabled={busy !== null}
            className="ml-auto rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            Avsluta tillstånd
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </p>
      )}
    </section>
  );
}
