import { useState, useEffect, useCallback, useRef } from 'react';
import { useDialog } from '../../hooks/useDialog';
import { X, Save, Search, Wand2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface AssignPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departments: { id: string; name: string }[];
}

interface DepartmentPoint {
  pointId: string;
  departmentNumber: string;
  globalNumber: number;
  // Set when the point is already assigned to a different department.
  otherDepartment?: { name: string; number: string };
}

interface AssignmentRow {
  point_id: string;
  department_id: string;
  department_number: string;
}

export default function AssignPointsModal({ isOpen, onClose, onSuccess, departments }: AssignPointsModalProps) {
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [points, setPoints] = useState<DepartmentPoint[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'ALL' | 'MINE' | 'FREE' | 'OTHER'>('ALL');
  const [search, setSearch] = useState('');
  const [bulkFrom, setBulkFrom] = useState('');
  const [bulkTo, setBulkTo] = useState('');

  // Switching avdelning quickly: only the answer for the latest choice counts.
  const latestRequest = useRef(0);

  const fetchPoints = useCallback(async () => {
    if (!selectedDepartment) return;
    const request = ++latestRequest.current;

    setLoading(true);
    try {
      const { data: redPoints } = await supabase
        .from('red_points')
        .select('id, point_number, department_id')
        .order('point_number');

      // Load every assignment so points owned by other departments are shown as such.
      const { data: allAssignments, error: assignmentsError } = await supabase
        .from('department_point_assignments')
        .select('point_id, department_id, department_number');

      if (assignmentsError) throw assignmentsError;
      if (request !== latestRequest.current) return;

      const rows = (allAssignments || []) as AssignmentRow[];
      const departmentNames = Object.fromEntries(departments.map((d) => [d.id, d.name]));

      const assignmentsMap: Record<string, string> = {};
      const otherDepartments: Record<string, { name: string; number: string }> = {};
      for (const row of rows) {
        if (row.department_id === selectedDepartment) {
          assignmentsMap[row.point_id] = row.department_number;
        } else {
          otherDepartments[row.point_id] = {
            name: departmentNames[row.department_id] ?? 'annan avdelning',
            number: row.department_number,
          };
        }
      }

      const departmentPoints: DepartmentPoint[] = ((redPoints || []) as { id: string; point_number: number }[]).map((point) => ({
        pointId: point.id,
        departmentNumber: assignmentsMap[point.id] || '',
        globalNumber: point.point_number,
        otherDepartment: otherDepartments[point.id],
      }));

      setPoints(departmentPoints);
      setAssignments(assignmentsMap);
    } catch (error) {
      if (request !== latestRequest.current) return;
      console.error('Error fetching points:', error);
      toast.error('Fel vid hämtning av punkter');
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, [selectedDepartment, departments]);

  useEffect(() => {
    if (isOpen && selectedDepartment) {
      fetchPoints();
    }
  }, [isOpen, selectedDepartment, fetchPoints]);

  const handleAssignmentChange = (pointId: string, departmentNumber: string) => {
    setAssignments(prev => ({
      ...prev,
      [pointId]: departmentNumber
    }));
  };

  const handleBulkAssign = (startNum: number, endNum: number) => {
    const newAssignments = { ...assignments };
    let currentNum = startNum;
    
    // Skip points that already belong to another department.
    const filteredPoints = points.filter(p =>
      p.globalNumber >= startNum && p.globalNumber <= endNum && !p.otherDepartment
    );
    
    filteredPoints.forEach(point => {
      newAssignments[point.pointId] = String(currentNum);
      currentNum++;
    });
    
    setAssignments(newAssignments);
  };

  const saveAssignments = async () => {
    setSaving(true);
    try {
      const payload = points
        .filter((p) => !p.otherDepartment && (assignments[p.pointId] ?? '').trim() !== '')
        .map((p) => ({ point_id: p.pointId, department_number: assignments[p.pointId].trim() }));

      // Replaces this department's assignments in one transaction (see
      // supabase/migrations/*_assignment_integrity.sql).
      const { error } = await supabase.rpc('save_department_assignments' as never, {
        p_department_id: selectedDepartment,
        p_assignments: payload,
      } as never);

      if (error) throw error;

      toast.success('Punkttilldelningar sparade!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving assignments:', error);
      if (error?.code === '23505') {
        toast.error(
          (error as Error).message?.includes('department_number')
            ? 'Samma avdelningsnummer används för flera punkter'
            : 'En punkt är redan tilldelad en annan avdelning'
        );
      } else {
        toast.error('Fel vid sparande av tilldelningar');
      }
    } finally {
      setSaving(false);
    }
  };

  const dialogRef = useDialog(isOpen, onClose);

  if (!isOpen) return null;

  const isMine = (p: DepartmentPoint) => !p.otherDepartment && (assignments[p.pointId] ?? '').trim() !== '';
  const isFree = (p: DepartmentPoint) => !p.otherDepartment && !isMine(p);

  const counts = {
    ALL: points.length,
    MINE: points.filter(isMine).length,
    FREE: points.filter(isFree).length,
    OTHER: points.filter((p) => p.otherDepartment).length,
  };

  const visiblePoints = points.filter((p) => {
    if (search.trim() && !String(p.globalNumber).includes(search.trim())) return false;
    if (view === 'MINE') return isMine(p);
    if (view === 'FREE') return isFree(p);
    if (view === 'OTHER') return !!p.otherDepartment;
    return true;
  });

  const tabs: { key: typeof view; label: string }[] = [
    { key: 'ALL', label: 'Alla' },
    { key: 'MINE', label: 'Denna avdelning' },
    { key: 'FREE', label: 'Lediga' },
    { key: 'OTHER', label: 'Andra avdelningar' },
  ];

  const bulkStart = parseInt(bulkFrom);
  const bulkEnd = parseInt(bulkTo);
  const bulkValid = bulkStart >= 1 && bulkEnd >= bulkStart;

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1} aria-label="Tilldela punkter till avdelning" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 focus:outline-none">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full h-[95dvh] sm:h-[90dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-col gap-4 px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">Tilldela punkter till avdelning</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition" aria-label="Stäng">
              <X size={22} />
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label htmlFor="assign-points-department" className="block text-sm font-medium text-gray-700 mb-1.5">Avdelning</label>
              <select
                id="assign-points-department"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Välj avdelning...</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedDepartment && (
              <div className="w-full md:w-auto">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Snabbtilldelning <span className="font-normal text-gray-500">(numrerar 1, 2, 3…)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={bulkFrom}
                    onChange={(e) => setBulkFrom(e.target.value)}
                    placeholder="Från"
                    aria-label="Från nummer"
                    className="min-w-0 flex-1 md:w-24 md:flex-none px-3 py-2.5 border border-gray-300 rounded-lg"
                  />
                  <span className="text-gray-400">–</span>
                  <input
                    type="number"
                    min={1}
                    value={bulkTo}
                    onChange={(e) => setBulkTo(e.target.value)}
                    placeholder="Till"
                    aria-label="Till nummer"
                    className="min-w-0 flex-1 md:w-24 md:flex-none px-3 py-2.5 border border-gray-300 rounded-lg"
                  />
                  <button
                    type="button"
                    disabled={!bulkValid}
                    onClick={() => handleBulkAssign(bulkStart, bulkEnd)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition disabled:opacity-40"
                  >
                    <Wand2 size={16} />
                    Tillämpa
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {!selectedDepartment ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 p-6 text-center">
            Välj en avdelning för att tilldela punkter.
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setView(tab.key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                      view === tab.key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {tab.label} <span className="opacity-75">({counts[tab.key]})</span>
                  </button>
                ))}
              </div>
              <div className="relative sm:ml-auto">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Sök punkt…"
                  aria-label="Sök punkt"
                  className="w-full sm:w-44 pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Points */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                </div>
              ) : visiblePoints.length === 0 ? (
                <p className="text-center text-gray-500 py-12">Inga punkter att visa.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {visiblePoints.map((point) => {
                    const other = point.otherDepartment;
                    const mine = isMine(point);
                    return (
                      <div
                        key={point.pointId}
                        className={`rounded-xl border-l-4 p-4 shadow-sm transition ${
                          other
                            ? 'border-amber-400 bg-amber-50/60'
                            : mine
                              ? 'border-indigo-500 bg-indigo-50/60'
                              : 'border-gray-300 bg-white ring-1 ring-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold text-gray-800">Punkt {point.globalNumber}</span>
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                              other
                                ? 'bg-amber-100 text-amber-800'
                                : mine
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {other ? other.name : mine ? 'Tilldelad' : 'Ledig'}
                          </span>
                        </div>
                        {other ? (
                          <div className="w-full px-3 py-2 rounded-lg bg-white/70 border border-amber-200 text-center text-sm text-amber-800">
                            Avd. nr {other.number}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={assignments[point.pointId] || ''}
                            onChange={(e) => handleAssignmentChange(point.pointId, e.target.value)}
                            placeholder="Avd. nr"
                            aria-label={`Avdelningsnummer för punkt ${point.globalNumber}`}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 px-4 sm:px-6 py-4 border-t border-gray-200 bg-white">
              <p className="text-sm text-gray-600 sm:mr-auto">
                <span className="font-semibold text-indigo-700">{counts.MINE}</span> punkter tilldelade denna avdelning
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 sm:flex-none px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Avbryt
                </button>
                <button
                  onClick={saveAssignments}
                  disabled={saving}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  <Save size={18} />
                  {saving ? 'Sparar...' : <>Spara<span className="hidden sm:inline">tilldelningar</span></>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
