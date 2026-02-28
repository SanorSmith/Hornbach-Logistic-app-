import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Building2, QrCode, Download, MapPin } from 'lucide-react';
import { useRedPoints } from '../hooks/useRedPoints';
import { useDepartmentAssignments } from '../hooks/useDepartmentAssignments';
import { RedPoint, PointStatus } from '../types';
import RedPointCard from '../components/redpoints/RedPointCard';
import PointActionModal from '../components/redpoints/PointActionModal';
import QRGenerator from '../components/qr/QRGenerator';
import { supabase } from '../lib/supabase';

export default function DepartmentDashboard() {
  const navigate = useNavigate();
  const { points, updatePointStatus } = useRedPoints();
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [departments, setDepartments] = useState<{ id: string; name: string; location: string }[]>([]);
  const { assignments } = useDepartmentAssignments();
  const [selectedPoint, setSelectedPoint] = useState<RedPoint | null>(null);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [qrPointNumber, setQrPointNumber] = useState<number | null>(null);
  const [qrPointId, setQrPointId] = useState<string | null>(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      // @ts-ignore - Supabase type inference issue
      const { data } = await supabase
        .from('departments')
        .select('id, name, location')
        .eq('is_active', true);

      if (data) {
        setDepartments(data);
        if (data.length > 0 && !selectedDepartment) {
          setSelectedDepartment(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const departmentPoints = points.filter(p => {
  // Show points that are assigned to this department OR belong to this department
  const isAssignedToDept = assignments[p.id];
  const belongsToDept = p.department_id === selectedDepartment;
  return isAssignedToDept || belongsToDept;
});
  
  const statusCounts = departmentPoints.reduce((acc, point) => {
    acc[point.status] = (acc[point.status] || 0) + 1;
    return acc;
  }, {} as Record<PointStatus, number>);

  const currentDepartment = departments.find(d => d.id === selectedDepartment);

  const handlePointClick = (point: RedPoint) => {
    setSelectedPoint(point);
  };

  const handleUpdateStatus = async (status: PointStatus, notes?: string) => {
    if (!selectedPoint) return;
    await updatePointStatus(selectedPoint.id, status, notes);
  };

  const handleGenerateQR = (pointNumber: number, pointId: string) => {
    setQrPointNumber(pointNumber);
    setQrPointId(pointId);
    setShowQRGenerator(true);
  };

  const downloadAllQRCodes = () => {
    // This would generate a PDF with all QR codes for the department
    alert('Funktion för att ladda ner alla QR-koder kommer snart!');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Building2 size={32} className="text-indigo-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Avdelnings Dashboard</h1>
                <p className="text-sm text-gray-600">
                  {currentDepartment ? `${currentDepartment.name} - ${currentDepartment.location}` : 'Välj avdelning'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={downloadAllQRCodes}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                <Download size={20} />
                <span className="hidden sm:inline">Ladda ner QR-koder</span>
              </button>
              
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                <Home size={20} />
                <span className="hidden sm:inline">Hem</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Department Selector */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Välj Avdelning
          </label>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} - {dept.location}
              </option>
            ))}
          </select>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-lg shadow-lg"
          >
            <h3 className="text-xs font-semibold opacity-90 mb-1">LEDIG</h3>
            <p className="text-3xl font-bold">{statusCounts.LEDIG || 0}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-4 rounded-lg shadow-lg"
          >
            <h3 className="text-xs font-semibold opacity-90 mb-1">UPPTAGEN</h3>
            <p className="text-3xl font-bold">{statusCounts.UPPTAGEN || 0}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-lg shadow-lg"
          >
            <h3 className="text-xs font-semibold opacity-90 mb-1">SKRÄP</h3>
            <p className="text-3xl font-bold">{statusCounts.SKRAP || 0}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-red-500 to-red-600 text-white p-4 rounded-lg shadow-lg"
          >
            <h3 className="text-xs font-semibold opacity-90 mb-1">KUNDORDER</h3>
            <p className="text-3xl font-bold">{statusCounts.KUNDORDER || 0}</p>
          </motion.div>
        </div>

        {/* Points Grid */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              Mina Punkter ({departmentPoints.length})
            </h2>
          </div>

          {departmentPoints.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Building2 size={48} className="mx-auto mb-4 opacity-50" />
              <p>Inga punkter tilldelade denna avdelning</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {departmentPoints.map((point) => (
                <div key={point.id} className="relative">
                  <div 
                    className="
                      relative bg-white rounded-lg shadow-sm border-2 p-4 cursor-pointer
                      transition-all hover:shadow-md
                      border-gray-200
                    "
                    onClick={() => handlePointClick(point)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full bg-${point.status.toLowerCase()}`}></div>
                        <div>
                          <h3 className="text-2xl font-bold text-gray-800">
                            {assignments[point.id] ? assignments[point.id] : `#${point.point_number}`}
                          </h3>
                          <p className="text-xs text-gray-500">{point.status}</p>
                          <p className="text-xs text-gray-400">Point ID: {point.id}</p>
                          <p className="text-xs text-gray-400">Dept Assignment: {assignments[point.id] || 'NONE'}</p>
                          <p className="text-xs text-gray-400">Point Dept: {point.department_id}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <MapPin size={16} />
                      <span>{currentDepartment?.name}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-3">
                      Uppdaterad {new Date(point.last_updated).toLocaleString('sv-SE', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                    <div className={`absolute bottom-0 left-0 right-0 h-1 bg-${point.status.toLowerCase()} rounded-b-lg`}></div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateQR(point.point_number, point.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-lg shadow-sm transition"
                    title="Generera QR-kod"
                  >
                    <QrCode size={16} className="text-indigo-600" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Point Action Modal */}
      {selectedPoint && (
        <PointActionModal
          point={selectedPoint}
          onClose={() => setSelectedPoint(null)}
          onUpdateStatus={handleUpdateStatus}
          allowedActions={['LEDIG', 'UPPTAGEN', 'SKRAP', 'KUNDORDER']}
        />
      )}

      {/* QR Generator Modal */}
      {showQRGenerator && qrPointNumber && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">QR-kod för Punkt {qrPointNumber}</h2>
              <button
                onClick={() => {
                  setShowQRGenerator(false);
                  setQrPointNumber(null);
                  setQrPointId(null);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                ✕
              </button>
            </div>
            <QRGenerator 
              pointNumber={qrPointNumber} 
              value={`RP-${String(qrPointNumber).padStart(3, '0')}`} 
              assignments={assignments}
              pointId={qrPointId}
            />
          </div>
        </div>
      )}
    </div>
  );
}
