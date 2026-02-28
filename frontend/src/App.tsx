import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import DashboardSelector from './pages/DashboardSelector';
import LineFeederDashboard from './pages/LineFeederDashboard';
import AdminDashboard from './pages/AdminDashboard';
import TeamLeaderDashboard from './pages/TeamLeaderDashboard';
import MonitorDashboard from './pages/MonitorDashboard';
import DepartmentDashboard from './pages/DepartmentDashboard';

function App() {
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
      <Routes>
        <Route path="/" element={<DashboardSelector />} />
        <Route path="/linefeeder" element={<LineFeederDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/teamleader" element={<TeamLeaderDashboard />} />
        <Route path="/monitor" element={<MonitorDashboard />} />
        <Route path="/department" element={<DepartmentDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
