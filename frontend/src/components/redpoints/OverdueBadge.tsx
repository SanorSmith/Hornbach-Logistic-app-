import { AlarmClock } from 'lucide-react';
import { OVERDUE_HOURS } from '../../lib/pointAge';

/** Red corner badge for points that have been Upptagen for more than 24 hours. */
export default function OverdueBadge() {
  return (
    <div
      className="absolute -top-2 -left-2 z-10 flex items-center gap-1 rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white shadow"
      title={`Upptagen i mer än ${OVERDUE_HOURS} timmar`}
    >
      <AlarmClock size={14} />
      Över {OVERDUE_HOURS} h
    </div>
  );
}
