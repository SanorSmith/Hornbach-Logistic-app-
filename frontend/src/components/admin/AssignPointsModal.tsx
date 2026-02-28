import { useState, useEffect } from 'react';
import { X, Save, ArrowRight } from 'lucide-react';
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
}

export default function AssignPointsModal({ isOpen, onClose, onSuccess, departments }: AssignPointsModalProps) {
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [points, setPoints] = useState<DepartmentPoint[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && selectedDepartment) {
      fetchPoints();
    }
  }, [isOpen, selectedDepartment]);

  const fetchPoints = async () => {
    if (!selectedDepartment) return;
    
    setLoading(true);
    try {
      // @ts-ignore - Supabase type inference issue
      const { data: redPoints } = await supabase
        .from('red_points')
        .select('id, point_number, department_id')
        .order('point_number');

      // @ts-ignore - Supabase type inference issue
      const { data: deptAssignments } = await supabase
        .from('department_point_assignments')
        .select('point_id, department_number')
        .eq('department_id', selectedDepartment);

      const assignmentsMap = (deptAssignments || []).reduce((acc, assignment) => {
        acc[assignment.point_id] = assignment.department_number;
        return acc;
      }, {} as Record<string, string>);

      const departmentPoints: DepartmentPoint[] = (redPoints || []).map(point => ({
        pointId: point.id,
        departmentNumber: assignmentsMap[point.id] || '',
        globalNumber: point.point_number,
      }));

      setPoints(departmentPoints);
      setAssignments(assignmentsMap);
    } catch (error) {
      console.error('Error fetching points:', error);
      toast.error('Fel vid hämtning av punkter');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignmentChange = (pointId: string, departmentNumber: string) => {
    setAssignments(prev => ({
      ...prev,
      [pointId]: departmentNumber
    }));
  };

  const handleBulkAssign = (startNum: number, endNum: number) => {
    const newAssignments = { ...assignments };
    let currentNum = startNum;
    
    const filteredPoints = points.filter(p => 
      p.globalNumber >= startNum && p.globalNumber <= endNum
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
      // Delete existing assignments for this department
      // @ts-ignore - Supabase type inference issue
      await supabase
        .from('department_point_assignments')
        .delete()
        .eq('department_id', selectedDepartment);

      // Insert new assignments
      const newAssignments = Object.entries(assignments)
        .filter(([_, deptNum]) => deptNum !== '')
        .map(([pointId, deptNum]) => ({
          department_id: selectedDepartment,
          point_id: pointId,
          department_number: deptNum,
        }));

      if (newAssignments.length > 0) {
        // @ts-ignore - Supabase type inference issue
        await supabase
          .from('department_point_assignments')
          .insert(newAssignments);
      }

      toast.success('Punkttilldelningar sparade!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving assignments:', error);
      toast.error('Fel vid sparande av tilldelningar');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">Tilldela Punkter till Avdelning</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {/* Department Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Välj Avdelning
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
            <>
              {/* Bulk Assignment Controls */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-3">Snabbtilldelning</h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Punkt</span>
                  <input
                    type="number"
                    placeholder="Från"
                    className="w-20 px-2 py-1 border border-gray-300 rounded"
                    onChange={(e) => {
                      const start = parseInt(e.target.value);
                      const end = parseInt((e.target.nextElementSibling as HTMLInputElement)?.value || '0');
                      if (start && end) handleBulkAssign(start, end);
                    }}
                  />
                  <ArrowRight size={16} className="text-gray-400" />
                  <input
                    type="number"
                    placeholder="Till"
                    className="w-20 px-2 py-1 border border-gray-300 rounded"
                    onChange={(e) => {
                      const end = parseInt(e.target.value);
                      const start = parseInt((e.target.previousElementSibling as HTMLInputElement)?.value || '0');
                      if (start && end) handleBulkAssign(start, end);
                    }}
                  />
                  <span className="text-sm text-gray-600">= Avdelningsnummer 1, 2, 3...</span>
                </div>
              </div>

              {/* Points Grid */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Tilldela Nummer till Punkter</h3>
                <div className="max-h-96 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {points.map((point) => (
                      <div key={point.pointId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="font-mono text-sm text-gray-600">
                          #{point.globalNumber}
                        </span>
                        <ArrowRight size={16} className="text-gray-400" />
                        <input
                          type="text"
                          value={assignments[point.pointId] || ''}
                          onChange={(e) => handleAssignmentChange(point.pointId, e.target.value)}
                          placeholder="Avd. #"
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                        />
                        <span className="text-xs text-gray-500">
                          {assignments[point.pointId] ? `Avd. ${assignments[point.pointId]}` : 'Ej tilldelad'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Avbryt
                </button>
                <button
                  onClick={saveAssignments}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  <Save size={20} />
                  {saving ? 'Sparar...' : 'Spara Tilldelningar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
