import { Filter } from 'lucide-react';
import { STATUS_FILTERS, usePointFilters } from '../../hooks/usePointFilters';

interface PointFilterBarProps {
  filters: ReturnType<typeof usePointFilters>;
  /** Colours for the dark Monitor screen. */
  dark?: boolean;
}

/** "Alla" / status buttons and the avdelning list above a grid of points. */
export default function PointFilterBar({ filters, dark = false }: PointFilterBarProps) {
  const { departments, status, setStatus, department, setDepartment } = filters;
  const idle = dark
    ? 'bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600'
    : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200';
  const active = 'bg-blue-600 text-white border-blue-600';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Filter size={20} className={dark ? 'text-gray-400' : 'text-gray-600'} />
      <span className={`text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>Filtrera:</span>
      {STATUS_FILTERS.map((s) => (
        <button
          key={s}
          onClick={() => setStatus(s)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition ${status === s ? active : idle}`}
        >
          {s === 'ALL' ? 'Alla' : s}
        </button>
      ))}
      {departments.length > 0 && (
        <select
          aria-label="Avdelning"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className={`w-full sm:w-auto sm:ml-auto px-3 py-1.5 rounded-full text-sm font-medium border transition ${department ? active : idle}`}
        >
          <option value="">Alla avdelningar</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
