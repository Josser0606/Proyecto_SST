import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Admin from './pages/Admin';
import RegistroEmpleado from './pages/RegistroEmpleado';
import AdminPanel from './pages/AdminPanel';
import Reportes from './pages/Reportes';

function App() {
  return (
    <BrowserRouter>
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
            fontWeight: 700
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
