import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useRedPoints } from '../hooks/useRedPoints';
import { useDepartmentAssignments } from '../hooks/useDepartmentAssignments';
import { RedPoint, PointStatus } from '../types';
import RedPointGrid from '../components/redpoints/RedPointGrid';
import PointActionModal from '../components/redpoints/PointActionModal';
import QRScanner from '../components/qr/QRScanner';
import { QrCode, Home, Filter, ScanLine } from 'lucide-react';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import toast from 'react-hot-toast';

export default function LineFeederDashboard() {
  const navigate = useNavigate();
  const { points, updatePointStatus } = useRedPoints();
  const { assignments } = useDepartmentAssignments();
  const [selectedPoint, setSelectedPoint] = useState<RedPoint | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [filterStatus, setFilterStatus] = useState<PointStatus | 'ALL'>('ALL');

  const handlePointClick = (point: RedPoint) => {
    setSelectedPoint(point);
  };

  const handleUpdateStatus = async (status: PointStatus, notes?: string) => {
    if (!selectedPoint) return;
    await updatePointStatus(selectedPoint.id, status, notes);
  };

  // Finds the point for a scanned value (camera or hardware scanner such as a
  // Zebra). Accepts "RP-003", anything containing it (e.g. a link), or the
  // point's department name such as "KASSA" / "D1".
  const handleQRScan = (qrCode: string) => {
    const code = qrCode.trim();
    let point: RedPoint | undefined;

    const rpMatch = code.match(/RP-(\d{1,3})/i);
    if (rpMatch) {
      const pointNumber = parseInt(rpMatch[1], 10);
      point = points.find((p) => p.point_number === pointNumber);
    }

    if (!point) {
      point = points.find((p) => p.qr_code?.toLowerCase() === code.toLowerCase());
    }

    if (!point) {
      const byName = points.filter((p) => assignments[p.id]?.toLowerCase() === code.toLowerCase());
      if (byName.length === 1) {
        point = byName[0];
      } else if (byName.length > 1) {
        toast.error(`"${code}" finns i flera avdelningar – skanna punktens QR-kod`);
        return;
      }
    }

    if (!point) {
      toast.error(`QR-kod "${code}" hittades inte i systemet`);
      return;
    }

    const found = point;
    toast.success(`Punkt ${assignments[found.id] || found.point_number} scannad!`);
    setShowScanner(false);
    // Small delay so the camera scanner is closed before the point dialog opens.
    setTimeout(() => setSelectedPoint(found), 100);
  };

  // Hardware scanners (Zebra TC2x etc.) type the code like a keyboard.
  useBarcodeScanner(handleQRScan, !showScanner);

  const filteredPoints = filterStatus === 'ALL'
    ? points
    : points.filter(p => p.status === filterStatus);

  const kundorderPoints = points.filter(p => p.status === 'KUNDORDER');
  const skrapPoints = points.filter(p => p.status === 'SKRAP');

  const getAllowedActions = (point: RedPoint): PointStatus[] => {
    // Allow all status changes for LineFeeder role
    return ['LEDIG', 'UPPTAGEN', 'SKRAP', 'KUNDORDER'];
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
              <span
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-sm"
                title="Skanna en punkts QR-kod med Zebra-skannern för att öppna punkten"
              >
                <ScanLine size={16} />
                Skanner redo
              </span>
              
              <button
                onClick={() => setShowScanner(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <QrCode size={20} />
                <span className="hidden sm:inline">Scanna QR</span>
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
            {(['ALL', 'KUNDORDER', 'SKRAP', 'UPPTAGEN', 'LEDIG'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
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
          </div>
        </div>

        <RedPointGrid 
            points={filteredPoints} 
            onPointClick={handlePointClick}
            assignments={assignments}
          />
      </div>

      {selectedPoint && (
        <PointActionModal
          point={selectedPoint}
          onClose={() => setSelectedPoint(null)}
          onUpdateStatus={handleUpdateStatus}
          allowedActions={getAllowedActions(selectedPoint)}
          canDeleteImages
        />
      )}

      {showScanner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg p-6 max-w-lg w-full"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Scanna QR-kod</h3>
              <button
                onClick={() => setShowScanner(false)}
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
