import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, TrendingUp, Users, MapPin, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PointStatus } from '../types';

interface Stats {
  totalPoints: number;
  ledig: number;
  upptagen: number;
  skrap: number;
  kundorder: number;
  activeUsers: number;
  todayChanges: number;
}

export default function TeamLeaderDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalPoints: 0,
    ledig: 0,
    upptagen: 0,
    skrap: 0,
    kundorder: 0,
    activeUsers: 0,
    todayChanges: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    
    // Subscribe to real-time updates
    const subscription = supabase
      .channel('team-leader-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'red_points' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleExportReport = async () => {
    try {
      // Fetch all red points with department assignments
      // @ts-ignore - Supabase type inference issue
      const { data: points } = await supabase
        .from('red_points')
        .select(`
          id,
          point_number,
          status,
          last_updated,
          department_id,
          departments(name)
        `);

      // @ts-ignore - Supabase type inference issue
      const { data: assignments } = await supabase
        .from('department_point_assignments')
        .select('point_id, department_number');

      // Create CSV content
      let csvContent = "Punktnummer,Status,Avdelning,Tilldelning,Senast Uppdaterad\n";
      
      points?.forEach(point => {
        const assignment = assignments?.find(a => a.point_id === point.id);
        const deptNumber = assignment ? assignment.department_number : `#${point.point_number}`;
        const deptName = point.departments?.name || 'Ej tilldelad';
        const lastUpdated = new Date(point.last_updated).toLocaleString('sv-SE');
        
        csvContent += `${deptNumber},${point.status},${deptName},${assignment?.department_number || 'Ej tilldelad'},${lastUpdated}\n`;
      });

      // Create and download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `rapport_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('Report exported successfully');
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Fel vid export av rapport');
    }
  };

  const handleManageTeam = () => {
    navigate('/team');
  };

  const fetchStats = async () => {
    try {
      // Fetch all red points
      // @ts-ignore - Supabase type inference issue
      const { data: points } = await supabase
        .from('red_points')
        .select('status');

      // Fetch active users
      // @ts-ignore - Supabase type inference issue
      const { data: users } = await supabase
        .from('users')
        .select('is_active')
        .eq('is_active', true);

      // Fetch today's status changes
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // @ts-ignore - Supabase type inference issue
      const { count: changesCount } = await supabase
        .from('status_history')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', today.toISOString());

      if (points) {
        // @ts-ignore - Supabase type inference issue
        const statusCounts = points.reduce((acc, point) => {
          const status = point.status as PointStatus;
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {} as Record<PointStatus, number>);

        setStats({
          totalPoints: points.length,
          ledig: statusCounts.LEDIG || 0,
          upptagen: statusCounts.UPPTAGEN || 0,
          skrap: statusCounts.SKRAP || 0,
          kundorder: statusCounts.KUNDORDER || 0,
          activeUsers: users?.length || 0,
          todayChanges: changesCount || 0,
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const utilizationRate = ((stats.upptagen + stats.skrap + stats.kundorder) / stats.totalPoints * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Team Leader Dashboard</h1>
              <p className="text-sm text-gray-600">Teamöversikt och rapportering</p>
            </div>
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

      <div className="container mx-auto px-4 py-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold opacity-90">Utnyttjandegrad</h3>
              <TrendingUp size={24} />
            </div>
            <p className="text-4xl font-bold">{utilizationRate}%</p>
            <p className="text-sm opacity-75 mt-1">{stats.upptagen + stats.skrap + stats.kundorder} av {stats.totalPoints} punkter</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold opacity-90">Aktiva Användare</h3>
              <Users size={24} />
            </div>
            <p className="text-4xl font-bold">{stats.activeUsers}</p>
            <p className="text-sm opacity-75 mt-1">Online nu</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold opacity-90">Dagens Ändringar</h3>
              <Activity size={24} />
            </div>
            <p className="text-4xl font-bold">{stats.todayChanges}</p>
            <p className="text-sm opacity-75 mt-1">Statusändringar</p>
          </motion.div>
        </div>

        {/* Status Breakdown */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Status Översikt</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-green-50 border-2 border-green-200 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-green-800">Lediga</h3>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <p className="text-3xl font-bold text-green-700">{stats.ledig}</p>
              <p className="text-xs text-green-600 mt-1">{(stats.ledig / stats.totalPoints * 100).toFixed(1)}% av total</p>
            </div>

            <div className="bg-yellow-50 border-2 border-yellow-200 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-yellow-800">Upptagna</h3>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              </div>
              <p className="text-3xl font-bold text-yellow-700">{stats.upptagen}</p>
              <p className="text-xs text-yellow-600 mt-1">{(stats.upptagen / stats.totalPoints * 100).toFixed(1)}% av total</p>
            </div>

            <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-orange-800">Skräp</h3>
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              </div>
              <p className="text-3xl font-bold text-orange-700">{stats.skrap}</p>
              <p className="text-xs text-orange-600 mt-1">{(stats.skrap / stats.totalPoints * 100).toFixed(1)}% av total</p>
            </div>

            <div className="bg-red-50 border-2 border-red-200 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-red-800">Kundorder</h3>
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              </div>
              <p className="text-3xl font-bold text-red-700">{stats.kundorder}</p>
              <p className="text-xs text-red-600 mt-1">{(stats.kundorder / stats.totalPoints * 100).toFixed(1)}% av total</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Snabbåtgärder</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/linefeeder')}
              className="flex items-center gap-3 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition"
            >
              <MapPin className="text-blue-600" size={24} />
              <div className="text-left">
                <h3 className="font-semibold text-blue-900">Visa Alla Punkter</h3>
                <p className="text-xs text-blue-600">Gå till LineFeeder vy</p>
              </div>
            </button>

            <button 
              onClick={handleExportReport}
              className="flex items-center gap-3 p-4 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 transition"
            >
              <TrendingUp className="text-green-600" size={24} />
              <div className="text-left">
                <h3 className="font-semibold text-green-900">Exportera Rapport</h3>
                <p className="text-xs text-green-600">Ladda ner statistik</p>
              </div>
            </button>

            <button 
              onClick={handleManageTeam}
              className="flex items-center gap-3 p-4 bg-purple-50 border-2 border-purple-200 rounded-lg hover:bg-purple-100 transition"
            >
              <Users className="text-purple-600" size={24} />
              <div className="text-left">
                <h3 className="font-semibold text-purple-900">Hantera Team</h3>
                <p className="text-xs text-purple-600">Användarhantering</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
