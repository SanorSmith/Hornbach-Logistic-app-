import { Layers } from 'lucide-react';
import { usePalletsStore } from '../../store/palletsStore';
import { palletSummary } from '../../lib/pallets';

interface PalletBadgeProps {
  pointId: string;
  /** Also show who authorized the extra pallets (Monitor). */
  showAuthorizer?: boolean;
}

/**
 * "2/3 pallar" on a point card while the point may hold extra pallets, or has
 * more than one. Nothing for an ordinary point.
 */
export default function PalletBadge({ pointId, showAuthorizer = false }: PalletBadgeProps) {
  const pallets = usePalletsStore((state) => state.pallets);
  const allowances = usePalletsStore((state) => state.allowances);
  const { open, allowance, max } = palletSummary(pallets, allowances, pointId);

  if (!allowance && open.length <= 1) return null;

  const full = open.length >= max;
  // Who approved it; privileges from before the name was required show who registered them.
  const authorizer = allowance?.authorized_by_name ?? allowance?.granter?.full_name;

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
          full ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
        }`}
        title={allowance ? `Extra pallar tillåtna, max ${max}` : undefined}
      >
        <Layers size={12} aria-hidden="true" />
        {open.length}/{max} pallar
      </span>
      {showAuthorizer && authorizer && (
        <span className="text-xs text-gray-600">Godkänt av {authorizer}</span>
      )}
    </div>
  );
}
