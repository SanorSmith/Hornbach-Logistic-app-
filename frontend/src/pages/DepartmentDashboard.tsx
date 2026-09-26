import { useState, useEffect } from 'react';
import { useDialog } from '../hooks/useDialog';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Building2, QrCode, Download, MapPin, Loader2, LayoutGrid } from 'lucide-react';
import { useRedPoints } from '../hooks/useRedPoints';
import { useDepartmentAssignments } from '../hooks/useDepartmentAssignments';
import { RedPoint, PointStatus } from '../types';
import PointActionModal from '../components/redpoints/PointActionModal';
import QRGenerator from '../components/qr/QRGenerator';
import { supabase } from '../lib/supabase';
import { downloadAllPointsQrSheet, downloadQrSheet } from '../lib/qrPdf';
import toast from 'react-hot-toast';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { findPointByScan } from '../lib/scanLookup';
import ScannerReadyBadge from '../components/redpoints/ScannerReadyBadge';
import OverdueBadge from '../components/redpoints/OverdueBadge';
import PalletBadge from '../components/redpoints/PalletBadge';
import { usePallets } from '../hooks/usePallets';
import { formatDuration, isOverdue, sortPointsByName, statusSince, useNow } from '../lib/pointAge';
import { getStatusLabel } from '../utils/statusColors';
import { useAuth } from '../hooks/useAuth';
import { clickableProps } from '../lib/clickable';

export default function DepartmentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { points, updatePointStatus } = useRedPoints();
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [departments, setDepartments] = useState<{ id: string; name: string; location: string }[]>([]);
  const { assignments, assignedDepartments } = useDepartmentAssignments();
  usePallets();
  const isLeader = user?.role === 'ADMIN' || user?.role === 'TEAM_LEADER';
  // Keep only the id: the point itself always comes from the live list, so an
  // open dialog shows changes made on other devices.
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const selectedPoint = points.find((p) => p.id === selectedPointId) ?? null;
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [qrPointNumber, setQrPointNumber] = useState<number | null>(null);
  const [qrPointId, setQrPointId] = useState<string | null>(null);
  const closeQrGenerator = () => {
    setShowQRGenerator(false);
    setQrPointNumber(null);
    setQrPointId(null);
  };
  const qrDialogRef = useDialog(showQRGenerator && qrPointNumber !== null, closeQrGenerator);

  const ownDepartmentId = user?.department_id;
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const { data, error } = await supabase
          .from('departments')
          .select('id, name, location')
          .eq('is_active', true)
          .order('name');
        if (error) throw error;

        if (data) {
          const list = data as { id: string; name: string; location: string }[];
          setDepartments(list);
          // Start on the user's own avdelning; otherwise the first one.
          const own = list.find((d) => d.id === ownDepartmentId);
          if (list.length > 0) {
            setSelectedDepartment((current) => current || (own ?? list[0]).id);
          }
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
        toast.error('Fel vid hämtning av avdelningar');
      }
    };
    fetchDepartments();
  }, [ownDepartmentId]);

  const now = useNow();
  const departmentPoints = sortPointsByName(points, assignments).filter((p) => {
    // Special case: show all unassigned points
    if (selectedDepartment === 'UNASSIGNED') {
      return !assignments[p.id];
    }

    // A point belongs to the department it is assigned to; points without an
    // assignment fall back to their own department_id.
    const pointDepartment = assignedDepartments[p.id] ?? p.department_id;
    return pointDepartment === selectedDepartment;
  });

  const statusCounts = departmentPoints.reduce((acc, point) => {
    acc[point.status] = (acc[point.status] || 0) + 1;
    return acc;
  }, {} as Record<PointStatus, number>);

  const currentDepartment = departments.find(d => d.id === selectedDepartment);

  const handlePointClick = (point: RedPoint) => {
    setSelectedPointId(point.id);
  };

  const handleUpdateStatus = async (status: PointStatus) => {
    if (!selectedPoint) return false;
    return (await updatePointStatus(selectedPoint.id, status)) === true;
  };

  const handleGenerateQR = (pointNumber: number, pointId: string) => {
    setQrPointNumber(pointNumber);
    setQrPointId(pointId);
    setShowQRGenerator(true);
  };

  // Zebra / hardware scanner: open the scanned point. If it belongs to another
  // department, switch the view to that department first.
  const handleScan = (code: string) => {
    const result = findPointByScan(points, assignments, code);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    const point = result.point;
    const pointDepartment = assignedDepartments[point.id] ?? point.department_id;
    if (pointDepartment && pointDepartment !== selectedDepartment && departments.some((d) => d.id === pointDepartment)) {
      setSelectedDepartment(pointDepartment);
    }
    toast.success(`Punkt ${assignments[point.id]?.trim() || point.point_number} scannad!`);
    setSelectedPointId(point.id);
  };

  useBarcodeScanner(handleScan, !showQRGenerator);

  const [downloadingQr, setDownloadingQr] = useState<'department' | 'all' | null>(null);

  // One A4 page with the QR codes of every point shown for the selected department.
  const downloadAllQRCodes = async () => {
    if (departmentPoints.length === 0) {
      toast.error('Inga punkter att skriva ut för den här avdelningen');
      return;
    }

    const heading =
      selectedDepartment === 'UNASSIGNED'
        ? 'QR-koder – otilldelade punkter'
        : `QR-koder – ${currentDepartment?.name ?? 'Avdelning'}`;
    const items = departmentPoints.map((p) => ({
      code: `RP-${String(p.point_number).padStart(3, '0')}`,
      title: assignments[p.id] || `Punkt ${p.point_number}`,
    }));
    const fileSlug = (selectedDepartment === 'UNASSIGNED' ? 'otilldelade' : currentDepartment?.name ?? 'avdelning')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9åäö]+/g, '-');

    setDownloadingQr('department');
    try {
      await downloadQrSheet(items, heading, `qr-koder-${fileSlug}.pdf`);
    } catch (error) {
      console.error('Error creating QR PDF:', error);
      toast.error('Kunde inte skapa PDF');
    } finally {
      setDownloadingQr(null);
    }
  };

  // One A4 page with the QR codes of every red point in every department,
  // grouped by department.
  const downloadEveryQRCode = async () => {
    setDownloadingQr('all');
    try {
      await downloadAllPointsQrSheet();
    } catch (error) {
      console.error('Error creating QR PDF:', error);
      toast.error('Kunde inte skapa PDF');
    } finally {
      setDownloadingQr(null);
    }
  };

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Building2 size={32} className="text-indigo-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Avdelnings Dashboard</h1>
                <p className="text-sm text-gray-600">
                  {selectedDepartment === 'UNASSIGNED' 
                    ? 'Alla otilldelade punkter' 
                    : currentDepartment 
                      ? `${currentDepartment.name} - ${currentDepartment.location}` 
                      : 'Välj avdelning'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <ScannerReadyBadge />

              <button
                aria-label="Ladda ner QR-koder"
                onClick={downloadAllQRCodes}
                disabled={downloadingQr !== null}
                title="QR-koder för vald avdelning på ett A4"
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-60"
              >
                {downloadingQr === 'department' ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                <span className="hidden sm:inline">Ladda ner QR-koder</span>
              </button>

              <button
                aria-label="Alla QR-koder"
                onClick={downloadEveryQRCode}
                disabled={downloadingQr !== null}
                title="Alla röda punkters QR-koder, alla avdelningar, på ett A4"
                className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition disabled:opacity-60"
              >
                {downloadingQr === 'all' ? <Loader2 size={20} className="animate-spin" /> : <LayoutGrid size={20} />}
                <span className="hidden sm:inline">Alla QR-koder</span>
              </button>
              
              <button
                aria-label="Hem"
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
            <option value="UNASSIGNED">Visa alla otilldelade punkter</option>
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
              {departmentPoints.map((point) => {
                const overdue = isOverdue(point, now);
                return (
                <div key={point.id} className="relative">
                  {overdue && <OverdueBadge />}
                  <div
                    className={`
                      relative rounded-lg shadow-sm border-2 p-4 cursor-pointer
                      transition-all hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500
                      ${overdue ? 'border-red-600 ring-2 ring-red-600/40 bg-red-50' : 'border-gray-200 bg-white'}
                    `}
                    {...clickableProps(
                      () => handlePointClick(point),
                      `Punkt ${assignments[point.id]?.trim() || point.point_number}, ${getStatusLabel(point.status)}${overdue ? ', över 24 timmar' : ''}`
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full bg-${point.status.toLowerCase()}`}></div>
                        <div>
                          <h3 className="text-2xl font-bold text-gray-800">
                            {assignments[point.id]?.trim() || `#${point.point_number}`}
                          </h3>
                          <p className="text-xs text-gray-500">{getStatusLabel(point.status)}</p>
                          <PalletBadge pointId={point.id} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <MapPin size={16} />
                      <span>{currentDepartment?.name}</span>
                    </div>
                    {point.status === 'UPPTAGEN' ? (
                      <div className={`text-xs mt-3 ${overdue ? 'font-semibold text-red-700' : 'text-gray-500'}`}>
                        Upptagen i {formatDuration(now - statusSince(point).getTime())}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 mt-3">
                        Uppdaterad {new Date(point.last_updated).toLocaleString('sv-SE', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
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
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Point Action Modal */}
      {selectedPoint && (
        <PointActionModal
          key={selectedPoint.id}
          point={selectedPoint}
          onClose={() => setSelectedPointId(null)}
          onUpdateStatus={handleUpdateStatus}
          allowedActions={['LEDIG', 'UPPTAGEN', 'SKRAP', 'KUNDORDER']}
          disabledActions={['UPPTAGEN']}
          palletAccess={{
            canPlace: isLeader,
            // The privilege is the LineFeeder's to handle: an avdelning user can
            // see it but not grant, change or end it.
            canGrant: isLeader,
            canChange: isLeader,
            canRaise: isLeader,
          }}
        />
      )}

      {/* QR Generator Modal */}
      {showQRGenerator && qrPointNumber && (
        <div
          ref={qrDialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`QR-kod för punkt ${qrPointNumber}`}
          tabIndex={-1}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 focus:outline-none"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">QR-kod för Punkt {qrPointNumber}</h2>
              <button
                onClick={closeQrGenerator}
                aria-label="Stäng"
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
