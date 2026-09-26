import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Home, Monitor as MonitorIcon, RefreshCw } from 'lucide-react';
import { useRedPointsStore } from '../store/redPointsStore';
import { useRedPoints } from '../hooks/useRedPoints';
import { useDepartmentAssignments } from '../hooks/useDepartmentAssignments';
import { usePallets } from '../hooks/usePallets';
import RedPointGrid from '../components/redpoints/RedPointGrid';
import PointImagesViewer from '../components/redpoints/PointImagesViewer';
import { PointStatus } from '../types';

export default function MonitorDashboard() {
  const navigate = useNavigate();
  const { points } = useRedPoints();
  const { assignments } = useDepartmentAssignments();
  usePallets();
  // When the data last changed, not a ticking clock: re-rendering the whole
  // grid every second wore out low-power screens left on all day.
  const lastSyncedAt = useRedPointsStore((state) => state.lastSyncedAt);
  // Keep only the id: the point itself always comes from the live list, so an
  // open dialog shows status changes made on other devices.
  const [viewedPointId, setViewedPointId] = useState<string | null>(null);
  const viewedPoint = points.find((p) => p.id === viewedPointId) ?? null;

  const statusCounts = points.reduce((acc, point) => {
    acc[point.status] = (acc[point.status] || 0) + 1;
    return acc;
  }, {} as Record<PointStatus, number>);

  const kundorderPoints = points.filter(p => p.status === 'KUNDORDER');
  const skrapPoints = points.filter(p => p.status === 'SKRAP');

  return (
    <div className="min-h-dvh bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 shadow-lg border-b border-gray-700 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <MonitorIcon size={32} className="text-orange-500" />
              <div>
                <h1 className="text-2xl font-bold">Monitor Dashboard</h1>
                <p className="text-sm text-gray-400">Realtidsövervakning av alla punkter</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <RefreshCw size={16} />
                <span>
                  Uppdaterad: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString('sv-SE') : '–'}
                </span>
              </div>
              <button
                aria-label="Hem"
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
              >
                <Home size={20} />
                <span className="hidden sm:inline">Hem</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Real-time Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-red-600 to-red-700 p-4 rounded-lg shadow-lg"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold opacity-90">KUNDORDER</h3>
              {kundorderPoints.length > 0 && (
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2 h-2 bg-white rounded-full"
                />
              )}
            </div>
            <p className="text-3xl font-bold">{statusCounts.KUNDORDER || 0}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-orange-600 to-orange-700 p-4 rounded-lg shadow-lg"
          >
            <h3 className="text-xs font-semibold opacity-90 mb-1">SKRÄP</h3>
            <p className="text-3xl font-bold">{statusCounts.SKRAP || 0}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-yellow-600 to-yellow-700 p-4 rounded-lg shadow-lg"
          >
            <h3 className="text-xs font-semibold opacity-90 mb-1">UPPTAGEN</h3>
            <p className="text-3xl font-bold">{statusCounts.UPPTAGEN || 0}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-green-600 to-green-700 p-4 rounded-lg shadow-lg"
          >
            <h3 className="text-xs font-semibold opacity-90 mb-1">LEDIG</h3>
            <p className="text-3xl font-bold">{statusCounts.LEDIG || 0}</p>
          </motion.div>
        </div>

        {/* Priority Alerts */}
        {(kundorderPoints.length > 0 || skrapPoints.length > 0) && (
          <div className="bg-gray-800 border-2 border-orange-500 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-bold text-orange-400 mb-3 flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              >
                ⚠️
              </motion.div>
              Prioriterade Punkter
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {kundorderPoints.map(point => (
                <div key={point.id} className="bg-red-900/30 border border-red-500 p-3 rounded">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-red-400">Punkt {assignments[point.id] ? assignments[point.id] : point.point_number}</span>
                    <span className="text-xs bg-red-500 px-2 py-1 rounded">KUNDORDER</span>
                  </div>
                </div>
              ))}
              {skrapPoints.map(point => (
                <div key={point.id} className="bg-orange-900/30 border border-orange-500 p-3 rounded">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-orange-400">Punkt {assignments[point.id] ? assignments[point.id] : point.point_number}</span>
                    <span className="text-xs bg-orange-500 px-2 py-1 rounded">SKRÄP</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grid View */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-1">Alla Punkter (Endast Visning)</h2>
          <p className="text-sm text-gray-400 mb-4">Klicka på en punkt för att se de senaste bilderna.</p>
          <RedPointGrid
            points={points}
            onPointClick={(point) => setViewedPointId(point.id)} // read-only: shows the latest photos
            assignments={assignments}
          />
        </div>

        {viewedPoint && (
          <PointImagesViewer
            point={viewedPoint}
            label={assignments[viewedPoint.id] || String(viewedPoint.point_number)}
            onClose={() => setViewedPointId(null)}
          />
        )}

        {/* System Info */}
        <div className="mt-6 bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>System Online</span>
            </div>
            <div>Totalt {points.length} punkter</div>
            <div>Realtidsuppdateringar aktiva</div>
          </div>
        </div>
      </div>
    </div>
  );
}
