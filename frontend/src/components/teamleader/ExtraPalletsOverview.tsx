import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Layers } from 'lucide-react';
import { usePallets } from '../../hooks/usePallets';
import { useDepartmentAssignments } from '../../hooks/useDepartmentAssignments';
import { useDepartments } from '../../hooks/useDepartments';
import { palletSummary } from '../../lib/pallets';

/**
 * Team leader overview of the points where an avdelning currently allows
 * extra pallets: who allowed it, when, and how full the point is.
 */
export default function ExtraPalletsOverview() {
  const { pallets, allowances } = usePallets();
  const { assignments, assignedDepartments } = useDepartmentAssignments();
  const departments = useDepartments();
  const departmentName = (id: string | undefined) => departments.find((d) => d.id === id)?.name ?? 'Okänd';

  return (
    <section aria-labelledby="extra-pallets-heading" className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 id="extra-pallets-heading" className="flex items-center gap-2 text-xl font-bold text-gray-800 mb-1">
        <Layers size={22} className="text-indigo-600" aria-hidden="true" />
        Extra pallar
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Punkter där en avdelning just nu tillåter fler än en pall. Tillståndet avslutas av sig självt när det är en
        pall kvar.
      </p>

      {allowances.length === 0 ? (
        <p className="text-sm text-gray-500">Inga punkter har extra pallar just nu.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4 font-medium">Punkt</th>
                <th className="py-2 pr-4 font-medium">Avdelning</th>
                <th className="py-2 pr-4 font-medium">Pallar</th>
                <th className="py-2 pr-4 font-medium">Tillåtet av</th>
                <th className="py-2 font-medium">Anledning</th>
              </tr>
            </thead>
            <tbody>
              {allowances.map((allowance) => {
                const { open, max } = palletSummary(pallets, allowances, allowance.point_id);
                return (
                  <tr key={allowance.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-semibold text-gray-800">
                      {assignments[allowance.point_id]?.trim() || '–'}
                    </td>
                    <td className="py-2 pr-4">{departmentName(assignedDepartments[allowance.point_id])}</td>
                    <td className="py-2 pr-4">
                      <span className={open.length >= max ? 'font-semibold text-amber-700' : ''}>
                        {open.length}/{max}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {allowance.authorized_by_name ?? allowance.granter?.full_name ?? 'Okänd'}
                      {allowance.authorized_by_name && (
                        <span className="block text-xs text-gray-500">
                          registrerat av {allowance.granter?.full_name ?? 'okänd'}
                        </span>
                      )}
                      <span className="block text-xs text-gray-500">
                        {formatDistanceToNow(new Date(allowance.granted_at), { addSuffix: true, locale: sv })}
                      </span>
                    </td>
                    <td className="py-2 text-gray-600">{allowance.note || '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
