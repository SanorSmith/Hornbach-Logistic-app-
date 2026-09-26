import { useState } from 'react';
import { useDialog } from '../hooks/useDialog';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useRedPoints } from '../hooks/useRedPoints';
import { useDepartmentAssignments } from '../hooks/useDepartmentAssignments';
import { useDepartments } from '../hooks/useDepartments';
import { usePallets } from '../hooks/usePallets';
import { useDeviceSetting } from '../hooks/useDeviceSetting';
import { useAuth } from '../hooks/useAuth';
import { RedPoint, PointStatus } from '../types';
import RedPointGrid from '../components/redpoints/RedPointGrid';
import PointActionModal from '../components/redpoints/PointActionModal';
import QRScanner from '../components/qr/QRScanner';
import { QrCode, Home, Filter } from 'lucide-react';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { findPointByScan } from '../lib/scanLookup';
import ScannerReadyBadge from '../components/redpoints/ScannerReadyBadge';
import toast from 'react-hot-toast';

const STATUS_FILTERS = ['ALL', 'KUNDORDER', 'SKRAP', 'UPPTAGEN', 'LEDIG'] as const;

export default function LineFeederDashboard() {
  const navigate = useNavigate();
  const { points, updatePointStatus } = useRedPoints();
  const { assignments, assignedDepartments } = useDepartmentAssignments();
  const departments = useDepartments();
  usePallets();
  const { user } = useAuth();
  const isLeader = user?.role === 'ADMIN' || user?.role === 'TEAM_LEADER';
  // Keep only the id: the point itself always comes from the live list, so an
  // open dialog shows changes made on other devices.
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const selectedPoint = points.find((p) => p.id === selectedPointId) ?? null;
  const [showScanner, setShowScanner] = useState(false);
  const scannerDialogRef = useDialog(showScanner, () => setShowScanner(false));
  // Remembered on this device too; anything unknown falls back to every status.
  const [storedStatus, setFilterStatus] = useDeviceSetting('linefeeder.status');
  const filterStatus: PointStatus | 'ALL' = (STATUS_FILTERS as readonly string[]).includes(storedStatus)
    ? (storedStatus as PointStatus | 'ALL')
    : 'ALL';
  // '' = every avdelning. Remembered on this device: a handheld usually serves
  // the same avdelning. A remembered avdelning that no longer exists is ignored.
  const [storedDepartment, setFilterDepartment] = useDeviceSetting('linefeeder.avdelning');
  const filterDepartment =
    departments.length === 0 || departments.some((d) => d.id === storedDepartment) ? storedDepartment : '';

  const handlePointClick = (point: RedPoint) => {
    setSelectedPointId(point.id);
  };

  const handleUpdateStatus = async (status: PointStatus) => {
    if (!selectedPoint) return false;
    return (await updatePointStatus(selectedPoint.id, status)) === true;
  };

  // Camera or hardware scanner (Zebra): open the scanned point.
  const handleQRScan = (qrCode: string) => {
    const result = findPointByScan(points, assignments, qrCode);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    const found = result.point;
    toast.success(`Punkt ${assignments[found.id]?.trim() || found.point_number} scannad!`);
    setShowScanner(false);
    // Small delay so the camera scanner is closed before the point dialog opens.
    setTimeout(() => setSelectedPointId(found.id), 100);
  };

  // Hardware scanners (Zebra TC2x etc.) type the code like a keyboard.
  useBarcodeScanner(handleQRScan, !showScanner);

  // A point belongs to the avdelning it is assigned to (Admin → Tilldela punkter).
  const filteredPoints = points.filter(
    (p) =>
      (filterStatus === 'ALL' || p.status === filterStatus) &&
      (!filterDepartment || assignedDepartments[p.id] === filterDepartment)
  );

  const kundorderPoints = points.filter(p => p.status === 'KUNDORDER');
  const skrapPoints = points.filter(p => p.status === 'SKRAP');

  // LineFeeders may make every status change.
  const allowedActions: PointStatus[] = ['LEDIG', 'UPPTAGEN', 'SKRAP', 'KUNDORDER'];

  return (
    <div className="min-h-dvh bg-gray-50">
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                LineFeeder Dashboard
              </h1>
              <p className="text-sm text-gray-600">
                Hantera röda punkter och materialflöde
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <ScannerReadyBadge />
              
              <button
                aria-label="Scanna QR"
                onClick={() => setShowScanner(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <QrCode size={20} />
                <span className="hidden sm:inline">Scanna QR</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-red-500 to-red-600 text-white p-4 rounded-lg shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold opacity-90">Kundorder</h3>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🔔
              </motion.div>
            </div>
            <p className="text-4xl font-bold">{kundorderPoints.length}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-lg shadow-lg"
          >
            <h3 className="text-sm font-semibold opacity-90 mb-2">Skräp</h3>
            <p className="text-4xl font-bold">{skrapPoints.length}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-lg shadow-lg"
          >
            <h3 className="text-sm font-semibold opacity-90 mb-2">Lediga</h3>
            <p className="text-4xl font-bold">
              {points.filter(p => p.status === 'LEDIG').length}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-4 rounded-lg shadow-lg"
          >
            <h3 className="text-sm font-semibold opacity-90 mb-2">Upptagna</h3>
            <p className="text-4xl font-bold">
              {points.filter(p => p.status === 'UPPTAGEN').length}
            </p>
          </motion.div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={20} className="text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filtrera:</span>
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status === 'ALL' ? '' : status)}
                className={`
                  px-3 py-1 rounded-full text-sm font-medium transition
                  ${filterStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                {status === 'ALL' ? 'Alla' : status}
              </button>
            ))}
            {departments.length > 0 && (
              <select
                aria-label="Avdelning"
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className={`
                  w-full sm:w-auto sm:ml-auto px-3 py-1.5 rounded-full text-sm font-medium border transition
                  ${filterDepartment
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                  }
                `}
              >
                <option value="">Alla avdelningar</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {filteredPoints.length === 0 && points.length > 0 ? (
          <p className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
            Inga punkter matchar filtret.
          </p>
        ) : (
          <RedPointGrid
            points={filteredPoints}
            onPointClick={handlePointClick}
            assignments={assignments}
          />
        )}
      </div>

      {selectedPoint && (
        <PointActionModal
          key={selectedPoint.id}
          point={selectedPoint}
          onClose={() => setSelectedPointId(null)}
          onUpdateStatus={handleUpdateStatus}
          allowedActions={allowedActions}
          canDeleteImages
          // LineFeeders place and pick pallets; the privilege is the avdelning's.
          palletAccess={{
            canPlace: true,
            canPick: true,
            // Only the LineFeeder handles extra pallets: grants them (naming who
            // approved them), raises or lowers the maximum, and ends them.
            canGrant: true,
            grantNeedsAuthorizer: !isLeader,
            canChange: true,
            canRaise: true,
          }}
        />
      )}

      {showScanner && (
        <div
          ref={scannerDialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Scanna QR-kod"
          tabIndex={-1}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 focus:outline-none"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg p-6 max-w-lg w-full"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Scanna QR-kod</h3>
              <button
                onClick={() => setShowScanner(false)}
                aria-label="Stäng"
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <QRScanner onScan={handleQRScan} />
          </motion.div>
        </div>
      )}
    </div>
  );
}
