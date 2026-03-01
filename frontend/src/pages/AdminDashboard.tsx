import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Users, Building2, MapPin, Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import AddUserModal from '../components/admin/AddUserModal';
import AddDepartmentModal from '../components/admin/AddDepartmentModal';
import AssignPointsModal from '../components/admin/AssignPointsModal';

interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
  location: string;
  is_active: boolean;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, activeUsers: 0, totalDepartments: 0, totalPoints: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddDepartmentModal, setShowAddDepartmentModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<any>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch users
      // @ts-ignore - Supabase type inference issue
      const { data: usersData } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch departments
      // @ts-ignore - Supabase type inference issue
      const { data: deptsData } = await supabase
        .from('departments')
        .select('*');

      // Fetch red points count
      // @ts-ignore - Supabase type inference issue
      const { count: pointsCount } = await supabase
        .from('red_points')
        .select('*', { count: 'exact', head: true });

      if (usersData) setUsers(usersData);
      if (deptsData) setDepartments(deptsData);

      setStats({
        totalUsers: usersData?.length || 0,
        // @ts-ignore - Supabase type inference issue
        activeUsers: usersData?.filter(u => u.is_active).length || 0,
        totalDepartments: deptsData?.length || 0,
        totalPoints: pointsCount || 0,
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Fel vid hämtning av data');
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      // @ts-ignore - Supabase type inference issue
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      toast.success(`Användare ${!currentStatus ? 'aktiverad' : 'inaktiverad'}`);
      fetchData();
    } catch (error) {
      toast.error('Kunde inte ändra användarstatus');
    }
  };

  const handleEditUser = (user: any) => {
    // TODO: Implement edit user functionality
    toast.info('Redigera användare - Kommer snart!');
    console.log('Edit user:', user);
  };

  const handleEditDepartment = (dept: any) => {
    setEditingDepartment(dept);
  };

  const handleDeleteDepartment = async (dept: any) => {
    if (!confirm(`Är du säker på att du vill radera avdelning "${dept.name}"?`)) {
      return;
    }

    try {
      // @ts-ignore - Supabase type inference issue
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', dept.id);

      if (error) {
        if (error.code === '23503') {
          alert('Kan inte radera avdelning. Den används av punkter i systemet. Ta bort tilldelningen först.');
        } else {
          throw error;
        }
      } else {
        alert('Avdelning raderad');
        fetchData();
      }
    } catch (error) {
      alert('Kunde inte radera avdelning');
      console.error('Delete department error:', error);
    }
  };

  const handleClearDepartmentAssignments = async (dept: any) => {
    if (!confirm(`Är du säker på att du vill ta bort alla tilldelningar från "${dept.name}"?`)) {
      return;
    }

    try {
      console.log('Clearing assignments for department:', dept);
      
      // Get all points assigned to this department
      // @ts-ignore - Supabase type inference issue
      const { data: points, error: fetchError } = await supabase
        .from('red_points')
        .select('id, point_number')
        .eq('department_id', dept.id);

      console.log('Points found:', points);
      console.log('Fetch error:', fetchError);

      if (fetchError) throw fetchError;

      if (points && points.length > 0) {
        // Reassign points to GM department instead of clearing
        // First get GM department ID
        // @ts-ignore - Supabase type inference issue
        const { data: gmDept } = await supabase
          .from('departments')
          .select('id')
          .eq('name', 'GM')
          .single();

        if (gmDept) {
          // @ts-ignore - Supabase type inference issue
          const { error: updateError } = await supabase
            .from('red_points')
            .update({ department_id: gmDept.id })
            .eq('department_id', dept.id);

          console.log('Update error:', updateError);

          if (updateError) throw updateError;

          alert(`Omtilldelade ${points.length} punkter till GM-avdelningen från ${dept.name}`);
          fetchData();
        } else {
          throw new Error('GM department not found');
        }
      } else {
        alert(`Inga tilldelningar att ta bort från ${dept.name}`);
      }
    } catch (error) {
      alert('Kunde inte ta bort tilldelningar');
      console.error('Clear assignments error:', error);
    }
  };

  const handleSaveDepartment = async () => {
    if (!editingDepartment) return;

    try {
      // @ts-ignore - Supabase type inference issue
      const { error } = await supabase
        .from('departments')
        .update({
          name: editingDepartment.name,
          location: editingDepartment.location,
          is_active: editingDepartment.is_active
        })
        .eq('id', editingDepartment.id);

      if (error) throw error;

      alert('Avdelning uppdaterad');
      setEditingDepartment(null);
      fetchData();
    } catch (error) {
      alert('Kunde inte uppdatera avdelning');
      console.error('Update department error:', error);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (!confirm(`Är du säker på att du vill radera ${user.full_name}?`)) {
      return;
    }

    try {
      // Delete from user_profiles table (correct table for this app)
      // @ts-ignore - Supabase type inference issue
      const { error: dbError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('email', user.email);

      console.log('Delete result:', { dbError, userEmail: user.email });
      
      if (dbError) throw dbError;

      // Try to delete from Supabase Auth using email if available
      try {
        // First get the user by email
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        const authUser = authUsers?.users?.find((u: any) => u.email === user.email);
        
        if (authUser?.id) {
          const { error: authError } = await supabase.auth.admin.deleteUser(authUser.id);
          if (authError) {
            console.warn('Auth user deletion failed:', authError);
          }
        }
      } catch (authError) {
        console.warn('Auth user deletion failed (may not exist in Auth):', authError);
      }

      toast.success('Användare raderad');
      
      // Force refresh the data to remove the deleted user from the list
      setTimeout(() => {
        fetchData();
      }, 500);
    } catch (error) {
      toast.error('Kunde inte radera användare');
      console.error('Delete user error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
              <p className="text-sm text-gray-600">Systemadministration och användarhantering</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/team')}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                <Users size={20} />
                <span className="hidden sm:inline">Team Management</span>
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
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold opacity-90">Totalt Användare</h3>
              <Users size={24} />
            </div>
            <p className="text-4xl font-bold">{stats.totalUsers}</p>
            <p className="text-sm opacity-75 mt-1">{stats.activeUsers} aktiva</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold opacity-90">Avdelningar</h3>
              <Building2 size={24} />
            </div>
            <p className="text-4xl font-bold">{stats.totalDepartments}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold opacity-90">Röda Punkter</h3>
              <MapPin size={24} />
            </div>
            <p className="text-4xl font-bold">{stats.totalPoints}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-lg shadow-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold opacity-90">System Status</h3>
              <div className="w-3 h-3 bg-green-300 rounded-full animate-pulse"></div>
            </div>
            <p className="text-2xl font-bold">Online</p>
          </motion.div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Användare</h2>
            <button 
              onClick={() => setShowAddUserModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              <Plus size={20} />
              Ny Användare
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Namn</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Roll</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Åtgärder</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{user.full_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                        user.role === 'TEAM_LEADER' ? 'bg-blue-100 text-blue-800' :
                        user.role === 'LINEFEEDER' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleUserStatus(user.id, user.is_active)}
                        className={`px-2 py-1 text-xs rounded-full ${
                          user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.is_active ? 'Aktiv' : 'Inaktiv'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleEditUser(user)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Redigera användare"
                        >
                          <Edit size={16} className="text-blue-600" />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Radera användare"
                        >
                          <Trash2 size={16} className="text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Departments Table */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Avdelningar</h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowAssignModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                <MapPin size={20} />
                Tilldela Punkter
              </button>
              <button 
                onClick={() => setShowAddDepartmentModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus size={20} />
                Ny Avdelning
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => (
              <motion.div
                key={dept.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-gray-800">{dept.name}</h3>
                    <p className="text-sm text-gray-600">{dept.location}</p>
                  </div>
                  <Building2 size={20} className="text-blue-600" />
                </div>
                <div className="flex gap-2 mt-3">
                  <button 
                    onClick={() => handleEditDepartment(dept)}
                    className="flex-1 px-3 py-1 text-sm bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-50 transition"
                  >
                    Redigera
                  </button>
                  <button 
                    onClick={() => handleClearDepartmentAssignments(dept)}
                    className="px-3 py-1 text-sm bg-white border border-yellow-300 text-yellow-700 rounded hover:bg-yellow-50 transition"
                    title="Ta bort alla tilldelningar"
                  >
                    Rensa
                  </button>
                  <button 
                    onClick={() => handleDeleteDepartment(dept)}
                    className="px-3 py-1 text-sm bg-white border border-red-300 text-red-700 rounded hover:bg-red-50 transition"
                  >
                    Radera
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddUserModal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        onSuccess={fetchData}
        departments={departments}
      />
      
      <AddDepartmentModal
        isOpen={showAddDepartmentModal}
        onClose={() => setShowAddDepartmentModal(false)}
        onSuccess={fetchData}
      />
      
      <AssignPointsModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        onSuccess={fetchData}
        departments={departments}
      />

      {/* Edit Department Modal */}
      {editingDepartment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Redigera Avdelning</h2>
              <button
                onClick={() => setEditingDepartment(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Avdelningsnamn
                </label>
                <input
                  type="text"
                  value={editingDepartment.name}
                  onChange={(e) => setEditingDepartment({...editingDepartment, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plats
                </label>
                <input
                  type="text"
                  value={editingDepartment.location}
                  onChange={(e) => setEditingDepartment({...editingDepartment, location: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editingDepartment.is_active}
                  onChange={(e) => setEditingDepartment({...editingDepartment, is_active: e.target.checked})}
                  className="mr-2"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Aktiv
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setEditingDepartment(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
              >
                Avbryt
              </button>
              <button
                onClick={handleSaveDepartment}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Spara
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
