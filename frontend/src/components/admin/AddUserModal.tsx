import { useState } from 'react';
import { X } from 'lucide-react';
import { createAppUser } from '../../lib/adminUsers';
import { UserRole } from '../../types';
import toast from 'react-hot-toast';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departments: { id: string; name: string }[];
}

export default function AddUserModal({ isOpen, onClose, onSuccess, departments }: AddUserModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'LINEFEEDER',
    department_id: '',
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { temporary_password } = await createAppUser({
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role as UserRole,
        department_id: formData.department_id || null,
        password: formData.password || undefined,
      });

      toast.success(
        temporary_password
          ? `Användare skapad! Temporärt lösenord: ${temporary_password} – användaren måste byta det vid första inloggningen.`
          : 'Användare skapad!',
        { duration: temporary_password ? 15000 : 3000 }
      );
      setFormData({
        email: '',
        password: '',
        full_name: '',
        role: 'LINEFEEDER',
        department_id: '',
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error((error as Error).message || 'Fel vid skapande av användare');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">Skapa Ny Användare</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fullständigt Namn *
            </label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lösenord (lämna tomt för att generera)
            </label>
            <input
              type="password"
              minLength={8}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Minst 8 tecken"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Roll *
            </label>
            <select
              required
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="ADMIN">Admin</option>
              <option value="TEAM_LEADER">Team Leader</option>
              <option value="LINEFEEDER">Linefeeder</option>
              <option value="MONITOR">Monitor</option>
              <option value="DEPARTMENT">Department</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Avdelning (valfritt)
            </label>
            <select
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Ingen avdelning</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
            >
              {loading ? 'Skapar...' : 'Skapa Användare'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
