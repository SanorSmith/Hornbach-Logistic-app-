import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, TrendingUp, Users, MapPin, Activity, Clock, Package, AlertCircle, UserCheck, BarChart3 } from 'lucide-react';
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

interface LineFeeder {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

interface LineFeederPerformance {
  userId: string;
  userName: string;
  blocksProcessed: number;
  statusChanges: number;
  averageTimePerBlock: number; // in minutes
  idleTime: number; // in minutes
  shiftStart: string;
  lastActivity: string;
  efficiency: number; // percentage
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
  const [lineFeeders, setLineFeeders] = useState<LineFeeder[]>([]);
  const [selectedLineFeeder, setSelectedLineFeeder] = useState<string>('');
  const [lineFeederPerformance, setLineFeederPerformance] = useState<LineFeederPerformance | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchLineFeeders();
    
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

  const fetchLineFeeders = async () => {
    try {
      console.log('Fetching LineFeeders...');
      
      // First, try to get all users to see what roles exist
      const { data: allUsers, error: allUsersError } = await supabase
        .from('users')
        .select('id, full_name, email, role, is_active')
        .eq('is_active', true);

      console.log('All users:', allUsers);
      console.log('All users error:', allUsersError);

      // Then try to get LINEFEEDER users
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, is_active')
        .eq('role', 'LINEFEEDER')
        .eq('is_active', true)
        .order('full_name');

      console.log('LineFeeder data:', data);
      console.log('LineFeeder error:', error);

      if (error) throw error;
      setLineFeeders((data as any) || []);
      
      // If no LINEFEEDER users found, try with 'LineFeeder' (different case)
      if (!data || data.length === 0) {
        console.log('No LINEFEEDER users found, trying LineFeeder...');
        const { data: altData, error: altError } = await supabase
          .from('users')
          .select('id, full_name, email, is_active')
          .eq('role', 'LineFeeder')
          .eq('is_active', true)
          .order('full_name');
        
        console.log('Alternative LineFeeder data:', altData);
        console.log('Alternative LineFeeder error:', altError);
        
        if (!altError && altData) {
          setLineFeeders(altData as any);
        } else {
          // If still no users found, show all active users as fallback
          console.log('No LineFeeder users found, showing all users as fallback');
          if (allUsers && allUsers.length > 0) {
            setLineFeeders(allUsers as any);
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching line feeders:', error);
    }
  };

  const fetchLineFeederPerformance = async (userId: string) => {
    if (!userId) return;
    
    setPerformanceLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get today's status changes for this user
      // @ts-ignore - Supabase type inference issue
      const { data: statusChanges, error: changesError } = await supabase
        .from('status_history')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', today.toISOString())
        .order('timestamp', { ascending: false });

      if (changesError) throw changesError;

      // Calculate performance metrics
      const blocksProcessed = statusChanges?.length || 0;
      const averageTimePerBlock = blocksProcessed > 0 ? 5 : 0; // Default 5 minutes per block
      const efficiency = blocksProcessed > 0 ? Math.min(100, (blocksProcessed / 8) * 100) : 0; // 8 blocks = 100%
      
      const now = new Date();
      const shiftStart = new Date(today.setHours(6, 0, 0, 0)); // 6 AM shift start
      const shiftDuration = (now.getTime() - shiftStart.getTime()) / (1000 * 60); // in minutes
      const workTime = blocksProcessed * averageTimePerBlock;
      const idleTime = Math.max(0, shiftDuration - workTime);

      // Get user info
      const user = lineFeeders.find(lf => lf.id === userId);
      
      setLineFeederPerformance({
        userId,
        userName: user?.full_name || 'Unknown',
        blocksProcessed,
        statusChanges: blocksProcessed,
        averageTimePerBlock,
        idleTime: Math.round(idleTime),
        shiftStart: shiftStart.toISOString(),
        lastActivity: statusChanges?.[0]?.timestamp || now.toISOString(),
        efficiency: Math.round(efficiency)
      });
    } catch (error: any) {
      console.error('Error fetching line feeder performance:', error);
    } finally {
      setPerformanceLoading(false);
    }
  };

  const handleLineFeederChange = (userId: string) => {
    setSelectedLineFeeder(userId);
    if (userId) {
      fetchLineFeederPerformance(userId);
    } else {
      setLineFeederPerformance(null);
    }
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

            {/* LineFeeder Performance Card */}
            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <BarChart3 className="text-orange-600" size={24} />
                <div className="text-left">
                  <h3 className="font-semibold text-orange-900">LineFeeder Rapport</h3>
                  <p className="text-xs text-orange-600">Prestationsövervakning</p>
                </div>
              </div>
              
              {/* LineFeeder Selector */}
              <select
                value={selectedLineFeeder}
                onChange={(e) => handleLineFeederChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-3"
              >
                <option value="">Välj LineFeeder...</option>
                {lineFeeders.map((feeder) => (
                  <option key={feeder.id} value={feeder.id}>
                    {feeder.full_name}
                  </option>
                ))}
              </select>

              {/* Performance Summary */}
              {performanceLoading ? (
                <div className="text-center py-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600 mx-auto"></div>
                  <p className="text-xs text-gray-600 mt-1">Laddar...</p>
                </div>
              ) : lineFeederPerformance ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Block:</span>
                    <span className="font-medium">{lineFeederPerformance.blocksProcessed}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Effektivitet:</span>
                    <span className={`font-medium ${
                      lineFeederPerformance.efficiency >= 80 ? 'text-green-600' :
                      lineFeederPerformance.efficiency >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {lineFeederPerformance.efficiency}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                    <div
                      className={`h-1.5 rounded-full ${
                        lineFeederPerformance.efficiency >= 80 ? 'bg-green-500' :
                        lineFeederPerformance.efficiency >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${lineFeederPerformance.efficiency}%` }}
                    />
                  </div>
                </div>
              ) : selectedLineFeeder ? (
                <p className="text-xs text-gray-500 text-center">Ingen data</p>
              ) : (
                <p className="text-xs text-gray-500 text-center">Välj LineFeeder</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
