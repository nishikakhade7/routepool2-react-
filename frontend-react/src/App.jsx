import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FormGroup from './pages/FormGroup';
import Book from './pages/Book';
import History from './pages/History';
import JoinedGroups from './pages/JoinedGroups';
import Admin from './pages/Admin';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import CampusInsights from './pages/CampusInsights';
import DriverLogin from './pages/driver/DriverLogin';
import AdminLogin from './pages/admin/AdminLogin';
import AvailableRides from './pages/driver/AvailableRides';
import MyTrips from './pages/driver/MyTrips';
import DriverProfile from './pages/driver/DriverProfile';
import { DriverProvider } from './contexts/DriverContext';

// Customer (and staff) pages. A signed-in driver is sent back to their portal.
// Staff only reach the admin panel (staffOnly routes); student pages send them there.
function ProtectedRoute({ children, loginPath = '/login', staffOnly = false }) {
  const { token, role } = useAuth();
  if (!token) return <Navigate to={loginPath} replace />;
  if (role === 'driver') return <Navigate to="/driver/rides" replace />;
  if (role === 'admin' && !staffOnly) return <Navigate to="/admin/drivers" replace />;
  return children;
}

// Driver portal pages: drivers only; anyone else goes to driver sign-in.
function DriverRoute() {
  const { token, role } = useAuth();
  if (!token || role !== 'driver') return <Navigate to="/driver/login" replace />;
  return <DriverProvider><Outlet /></DriverProvider>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<Login />} />
          
          {/* Protected routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/form-group" element={<ProtectedRoute><FormGroup /></ProtectedRoute>} />
          <Route path="/book" element={<ProtectedRoute><Book /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/groups" element={<ProtectedRoute><JoinedGroups /></ProtectedRoute>} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<ProtectedRoute loginPath="/admin/login" staffOnly><Admin /></ProtectedRoute>} />
          <Route path="/admin/:tab" element={<ProtectedRoute loginPath="/admin/login" staffOnly><Admin /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/campus-insights" element={<ProtectedRoute><CampusInsights /></ProtectedRoute>} />
          
          {/* Driver portal */}
          <Route path="/driver/login" element={<DriverLogin />} />
          <Route path="/driver" element={<DriverRoute />}>
            <Route index element={<Navigate to="/driver/rides" replace />} />
            <Route path="rides" element={<AvailableRides />} />
            <Route path="trips" element={<MyTrips />} />
            <Route path="profile" element={<DriverProfile />} />
          </Route>

          {/* Redirect root */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
