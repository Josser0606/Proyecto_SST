import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Admin from './pages/Admin';
import RegistroEmpleado from './pages/RegistroEmpleado';
import AdminPanel from './pages/AdminPanel';
import Reportes from './pages/Reportes';

const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutos

function SessionInactivityGuard() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/') return undefined;
    if (!localStorage.getItem('usuario')) return undefined;

    let timeoutId;
    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (!localStorage.getItem('usuario')) return;
        toast.dismiss();
        localStorage.removeItem('usuario');
        toast.error('Sesion cerrada por inactividad');
        navigate('/', { replace: true });
      }, INACTIVITY_TIMEOUT_MS);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resetTimer();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'focus'];
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
    document.addEventListener('visibilitychange', onVisibilityChange);
    resetTimer();

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [location.pathname, navigate]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <SessionInactivityGuard />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3200,
          style: {
            borderRadius: '14px',
            border: '1px solid #bbf7d0',
            background: '#ffffff',
            color: '#0f172a',
            boxShadow: '0 10px 30px rgba(20, 83, 45, 0.16)',
            fontWeight: 700,
            pointerEvents: 'none'
          },
          success: {
            style: { border: '1px solid #86efac' }
          },
          error: {
            style: { border: '1px solid #fca5a5' }
          }
        }}
      />
      <Routes>
        {/* Ruta por defecto: Login */}
        <Route path="/" element={<Login />} />
        
        {/* Ruta principal: Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Ruta por defecto: Admin */}
        <Route path="/admin-reportes" element={<Admin />} />

        {/* Ruta por defecto: RegistroEmpleado */}
        <Route path="/registro-personal" element={<RegistroEmpleado />} />

        {/* Ruta por defeccto: AdminPanel */}
        <Route path="/admin" element={<AdminPanel />} />

        {/* Ruta por defeccto: Reportes */}
        <Route path="/reportes" element={<Reportes />} />
        
        {/* Si escriben cualquier locura, mandar al Login */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
