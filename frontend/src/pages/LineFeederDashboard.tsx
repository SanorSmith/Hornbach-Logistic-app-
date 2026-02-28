import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useRedPoints } from '../hooks/useRedPoints';
import { useDepartmentAssignments } from '../hooks/useDepartmentAssignments';
import { RedPoint, PointStatus } from '../types';
import RedPointGrid from '../components/redpoints/RedPointGrid';
import PointActionModal from '../components/redpoints/PointActionModal';
import QRScanner from '../components/qr/QRScanner';
import { QrCode, Home, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function LineFeederDashboard() {
  const navigate = useNavigate();
  const { points, updatePointStatus } = useRedPoints();
  const { assignments } = useDepartmentAssignments();
  const [selectedPoint, setSelectedPoint] = useState<RedPoint | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [filterStatus, setFilterStatus] = useState<PointStatus | 'ALL'>('ALL');

  const handleTestClick = () => {
    console.log('Button clicked!');
    alert('Button works!');
  };

  const handlePointClick = (point: RedPoint) => {
    setSelectedPoint(point);
  };

  const handleUpdateStatus = async (status: PointStatus, notes?: string) => {
    if (!selectedPoint) return;
    await updatePointStatus(selectedPoint.id, status, notes);
  };

  const handleQRScan = async (qrCode: string) => {
    try {
      console.log('Scanning QR code:', qrCode);
      
      const { data, error } = await supabase
        .from('red_points')
        .select(`
          *,
          department:departments(*),
          current_user:users(id, full_name)
        `)
        .eq('qr_code', qrCode)
        .single();

      if (error) {
        console.error('Database error:', error);
        if (error.code === 'PGRST116') {
          // No rows returned - QR code not found
          // Try to extract point number from QR code (fallback)
          const pointNumberMatch = qrCode.match(/RP-(\d{3})/);
          if (pointNumberMatch) {
            const pointNumber = parseInt(pointNumberMatch[1]);
            try {
              const { data: pointData, error: pointError } = await supabase
                .from('red_points')
                .select(`
                  *,
                  department:departments(*),
                  current_user:users(id, full_name)
                `)
                .eq('point_number', pointNumber)
                .single();

              if (pointError) throw pointError;
              
              if (pointData) {
                // @ts-ignore - Supabase type inference issue
                toast.success(`Punkt ${pointData.point_number} hittad via nummer!`);
                // Close scanner first
                setShowScanner(false);
                // Small delay to ensure scanner is closed before opening action modal
                setTimeout(() => {
                  // @ts-ignore - Supabase type inference issue
                  setSelectedPoint(pointData);
                }, 100);
                return;
              }
            } catch (fallbackError) {
              console.error('Fallback search failed:', fallbackError);
            }
          }
          toast.error(`QR-kod "${qrCode}" hittades inte i systemet`);
        } else {
          toast.error('Kunde inte söka efter QR-kod');
        }
        return;
      }

      if (data) {
        // @ts-ignore - Supabase type inference issue
        toast.success(`Punkt ${data.point_number} scannad!`);
        // Close scanner first
        setShowScanner(false);
        // Small delay to ensure scanner is closed before opening action modal
        setTimeout(() => {
          // @ts-ignore - Supabase type inference issue
          setSelectedPoint(data);
        }, 100);
      } else {
        toast.error('Ogiltig QR-kod');
      }
    } catch (error: any) {
      console.error('QR scan error:', error);
      toast.error('Kunde inte hitta punkt');
    }
  };

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
                Linefeedr Dashboard
              </h1>
              <p className="text-sm text-gray-600">
                Hantera röda punkter och materialflöde
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleTestClick}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                TEST
              </button>
              
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
        />
      )}

      {showScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
