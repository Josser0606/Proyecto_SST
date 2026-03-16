import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Toaster, ToastBar } from 'react-hot-toast';
import toast from 'react-hot-toast';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Admin from './pages/Admin';
import RegistroEmpleado from './pages/RegistroEmpleado';
import AdminPanel from './pages/AdminPanel';
import Reportes from './pages/Reportes';
import { setAuthToken } from './config/api';

const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutos

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('usuario') || 'null');
  } catch {
    return null;
  }
};

const isAuthenticated = () => {
  const token = localStorage.getItem('token');
  const user = getStoredUser();
  return Boolean(token && user?.id);
};

function PublicOnlyRoute({ children }) {
  if (isAuthenticated()) return <Navigate to="/dashboard" replace />;
  return children;
}

function ProtectedRoute({ children, adminOnly = false }) {
  if (!isAuthenticated()) return <Navigate to="/" replace />;
  if (adminOnly) {
    const user = getStoredUser();
    if (user?.rol !== 'admin') return <Navigate to="/dashboard" replace />;
  }
  return children;
}

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
        localStorage.removeItem('token');
        setAuthToken(null);
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
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) setAuthToken(token);
  }, []);

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
            pointerEvents: 'auto'
          },
          success: {
            style: { border: '1px solid #86efac' }
          },
          error: {
            style: { border: '1px solid #fca5a5' }
          }
        }}
      >
        {(t) => (
          <ToastBar toast={t}>
            {({ icon, message }) => (
              <div className="flex items-center gap-2 w-full">
                <span>{icon}</span>
                <span className="flex-1">{message}</span>
                <button
                  type="button"
                  onClick={() => toast.dismiss(t.id)}
                  className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all"
                  aria-label="Cerrar notificacion"
                  title="Cerrar"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true">
                    <path d="M6 6l8 8M14 6l-8 8" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}
          </ToastBar>
        )}
      </Toaster>
      <Routes>
        {/* Ruta por defecto: Login */}
        <Route
          path="/"
          element={(
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          )}
        />
        
        {/* Ruta principal: Dashboard */}
        <Route
          path="/dashboard"
          element={(
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          )}
        />

        {/* Ruta por defecto: Admin */}
        <Route
          path="/admin-reportes"
          element={(
            <ProtectedRoute adminOnly>
              <Admin />
            </ProtectedRoute>
          )}
        />

        {/* Ruta por defecto: RegistroEmpleado */}
        <Route
          path="/registro-personal"
          element={(
            <ProtectedRoute adminOnly>
              <RegistroEmpleado />
            </ProtectedRoute>
          )}
        />

        {/* Ruta por defeccto: AdminPanel */}
        <Route
          path="/admin"
          element={(
            <ProtectedRoute adminOnly>
              <AdminPanel />
            </ProtectedRoute>
          )}
        />

        {/* Ruta por defeccto: Reportes */}
        <Route
          path="/reportes"
          element={(
            <ProtectedRoute adminOnly>
              <Reportes />
            </ProtectedRoute>
          )}
        />
        
        {/* Si escriben cualquier locura, mandar al Login */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
