import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import DashboardSelector from './pages/DashboardSelector';
import LineFeederDashboard from './pages/LineFeederDashboard';
import AdminDashboard from './pages/AdminDashboard';
import TeamLeaderDashboard from './pages/TeamLeaderDashboard';
import MonitorDashboard from './pages/MonitorDashboard';
import DepartmentDashboard from './pages/DepartmentDashboard';
import TeamManagement from './pages/TeamManagement';
import ReportsPage from './pages/ReportsPage';
import ChangePassword from './pages/ChangePassword';
import SuperAdminPage from './pages/SuperAdminPage';
import Login from './pages/Login';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuthListener } from './hooks/useAuth';
import { ROUTE_ROLES } from './lib/access';
import InstallPrompt from './components/pwa/InstallPrompt';

function App() {
  useAuthListener();

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4CAF50',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#F44336',
              secondary: '#fff',
            },
          },
        }}
      />
      <InstallPrompt />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><DashboardSelector /></ProtectedRoute>} />
        <Route path="/linefeeder" element={<ProtectedRoute roles={ROUTE_ROLES.linefeeder}><LineFeederDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute roles={ROUTE_ROLES.admin}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/teamleader" element={<ProtectedRoute roles={ROUTE_ROLES.teamleader}><TeamLeaderDashboard /></ProtectedRoute>} />
        <Route path="/monitor" element={<ProtectedRoute roles={ROUTE_ROLES.monitor}><MonitorDashboard /></ProtectedRoute>} />
        <Route path="/department" element={<ProtectedRoute roles={ROUTE_ROLES.department}><DepartmentDashboard /></ProtectedRoute>} />
        <Route path="/team" element={<ProtectedRoute roles={ROUTE_ROLES.team}><TeamManagement /></ProtectedRoute>} />
        <Route path="/superadmin" element={<ProtectedRoute roles={ROUTE_ROLES.superadmin}><SuperAdminPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute roles={ROUTE_ROLES.reports}><ReportsPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
