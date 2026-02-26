import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import logoSaciar from '../assets/logo_saciar.png';
import { apiUrl } from '../config/api';

const AREAS = [
  'SST y GH',
  'Aseguramineto de Calidad',
  'Mercadeo Social',
  'Programas y Proyectos',
  'Relaciones Institucionales',
  'Logística y Transporte',
  'Financiero y Contable',
  'Dirección'
];

const BASE_FORM = {
  nombre_completo: '',
  area: 'SST y GH',
  rol: 'empleado',
  password: ''
};

function RegistroEmpleado() {
  const [usuarios, setUsuarios] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [formData, setFormData] = useState(BASE_FORM);
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const formRef = useRef(null);
  const navigate = useNavigate();

  const usuarioActual = JSON.parse(localStorage.getItem('usuario'));

  useEffect(() => {
    if (usuarioActual?.rol !== 'admin') {
      navigate('/dashboard');
      return;
    }
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      const { data } = await axios.get(apiUrl('/api/usuarios'));
      setUsuarios(data);
    } catch {
      toast.error('No fue posible cargar empleados');
    }
  };

  const limpiarFormulario = () => {
    setFormData(BASE_FORM);
    setEditandoId(null);
  };

  const validarFormulario = () => {
    if (!formData.nombre_completo.trim()) {
      toast.error('Escribe el nombre completo');
      return false;
    }
    if (!formData.area) {
      toast.error('Selecciona un area');
      return false;
    }
    if (formData.rol === 'admin' && !formData.password.trim() && !editandoId) {
      toast.error('Un admin nuevo requiere contrasena');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validarFormulario()) return;

    setLoading(true);
    try {
      const payload = {
        nombre_completo: formData.nombre_completo.trim(),
        area: formData.area,
        rol: formData.rol
      };

      if (formData.rol === 'admin' && formData.password.trim()) {
        payload.password = formData.password.trim();
      }

      if (editandoId) {
        await axios.put(apiUrl(`/api/usuarios/${editandoId}`), payload);
        toast.success('Empleado actualizado');
      } else {
        await axios.post(apiUrl('/api/usuarios'), payload);
        toast.success('Empleado agregado');
      }

      limpiarFormulario();
      cargarUsuarios();
    } catch (error) {
      const mensaje = error.response?.data?.message || 'No fue posible guardar';
      toast.error(mensaje);
    } finally {
      setLoading(false);
    }
  };

  const editarUsuario = (usuario) => {
    setEditandoId(usuario.id);
    toast('Editando empleado');
    setFormData({
      nombre_completo: usuario.nombre_completo,
      area: usuario.area,
      rol: usuario.rol,
      password: ''
    });
    window.requestAnimationFrame(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  const confirmarAccion = (mensaje) => new Promise((resolve) => {
    toast((t) => (
      <div className="flex items-center gap-3">
        <span className="text-sm">{mensaje}</span>
        <button
          className="px-2 py-1 text-xs rounded bg-red-600 text-white"
          onClick={() => {
            toast.dismiss(t.id);
            resolve(true);
          }}
        >
          Si
        </button>
        <button
          className="px-2 py-1 text-xs rounded border"
          onClick={() => {
            toast.dismiss(t.id);
            resolve(false);
          }}
        >
          No
        </button>
      </div>
    ), { duration: 8000, style: { pointerEvents: 'auto' } });
  });

  const eliminarUsuario = async (usuario) => {
    if (usuario.id === usuarioActual?.id) {
      toast.error('No puedes eliminar tu propio usuario');
      return;
    }

    const confirmado = await confirmarAccion(`Eliminar a ${usuario.nombre_completo}?`);
    if (!confirmado) return;

    try {
      await axios.delete(apiUrl(`/api/usuarios/${usuario.id}`));
      toast.success('Empleado eliminado');
      if (editandoId === usuario.id) limpiarFormulario();
      cargarUsuarios();
    } catch {
      toast.error('No fue posible eliminar');
    }
  };

  const usuariosFiltrados = useMemo(() => {
    const term = filtro.toLowerCase().trim();
    if (!term) return usuarios;
    return usuarios.filter((u) => {
      return (
        (u.nombre_completo || '').toLowerCase().includes(term) ||
        (u.area || '').toLowerCase().includes(term) ||
        (u.rol || '').toLowerCase().includes(term)
      );
    });
  }, [usuarios, filtro]);

  const totalAdmins = useMemo(() => usuarios.filter((u) => u.rol === 'admin').length, [usuarios]);
  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('sidebarCollapsed', String(next));
  };
  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('darkMode', String(next));
  };

  return (
    <div className={`min-h-screen flex flex-col overflow-x-hidden font-sans transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-gray-50 text-slate-900'}`}>

      <nav className={`px-3 sm:px-6 py-2.5 flex justify-between items-center fixed top-0 left-0 right-0 z-50 border-b transition-colors ${darkMode ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center gap-4">
          <img
            src={logoSaciar}
            alt="Logo"
            onClick={() => navigate('/dashboard')}
            className="h-11 sm:h-14 w-auto object-contain cursor-pointer"
            title="Ir al dashboard"
          />
          <div className={`h-5 w-[1px] hidden sm:block ${darkMode ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
          <span className="text-[11px] font-bold text-green-600 uppercase tracking-widest hidden sm:block">
            Gestion de Empleados
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={toggleDarkMode} className={`p-2.5 rounded-xl transition-all ${darkMode ? 'bg-slate-800 text-yellow-400' : 'bg-gray-100 text-slate-500 hover:bg-gray-200'}`}>
            {darkMode ? 'Light' : 'Dark'}
          </button>
          <div className={`text-right border-r pr-4 hidden sm:block ${darkMode ? 'border-slate-700' : 'border-gray-100'}`}>
            <p className="text-sm font-black">{usuarioActual?.nombre_completo}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">{usuarioActual?.area}</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="group flex items-center gap-2 text-slate-500 hover:text-green-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
            </svg>
            <span className="text-xs font-bold uppercase tracking-tighter hidden sm:block">Volver</span>
          </button>
        </div>
      </nav>

      <div className="flex flex-1 min-h-0 pt-[76px]">
        <aside className={`${sidebarCollapsed ? 'w-16' : 'w-72'} shrink-0 overflow-hidden border-r p-3 hidden lg:flex fixed top-[76px] left-0 z-40 h-[calc(100vh-76px)] flex-col transition-all duration-300 ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center justify-between mb-3">
            {!sidebarCollapsed && <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Navegacion</p>}
            <button onClick={toggleSidebar} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`} title={sidebarCollapsed ? 'Expandir' : 'Contraer'}>
              <svg className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>
          </div>

          {!sidebarCollapsed ? (
            <div className="min-h-0 flex-1 flex flex-col">
              <div className="space-y-2">
                <button
                  onClick={() => navigate('/admin')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border font-bold text-sm transition-all flex items-center gap-2 ${
                    darkMode
                      ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white'
                      : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center ${darkMode ? 'bg-slate-700/80' : 'bg-slate-100'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 5v14m-7-7h14"></path>
                    </svg>
                  </span>
                  Crear Nuevo
                </button>
                <button
                  onClick={() => navigate('/registro-personal')}
                  className="w-full text-left px-3 py-2.5 rounded-xl border border-green-500 bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-all flex items-center gap-2 shadow-sm"
                >
                  <span className="w-5 h-5 rounded-md bg-white/25 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5.121 17.804A9 9 0 1118.88 17.8M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                  </span>
                  Empleados
                </button>
                <button
                  onClick={() => navigate('/reportes')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border font-bold text-sm transition-all flex items-center gap-2 ${
                    darkMode
                      ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white'
                      : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center ${darkMode ? 'bg-slate-700/80' : 'bg-slate-100'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 3v18h18M7 14l3-3 3 2 4-5"></path>
                    </svg>
                  </span>
                  Auditoria
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <button onClick={() => navigate('/admin')} className={`w-10 h-10 rounded-xl border transition flex items-center justify-center ${
                darkMode ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'
              }`} title="Crear nuevo">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 5v14m-7-7h14"></path>
                </svg>
              </button>
              <button onClick={() => navigate('/registro-personal')} className="w-10 h-10 rounded-xl border border-green-500 bg-green-600 text-white hover:bg-green-700 transition shadow-sm flex items-center justify-center" title="Empleados">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5.121 17.804A9 9 0 1118.88 17.8M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </button>
              <button onClick={() => navigate('/reportes')} className={`w-10 h-10 rounded-xl border transition flex items-center justify-center ${
                darkMode ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'
              }`} title="Auditoria">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 3v18h18M7 14l3-3 3 2 4-5"></path>
                </svg>
              </button>
            </div>
          )}
        </aside>

      <main className={`flex-1 p-4 sm:p-6 md:p-10 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-72'}`}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="lg:hidden grid grid-cols-3 gap-2">
            <button onClick={() => navigate('/admin')} className={`px-2 py-2.5 rounded-xl text-[11px] font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
              Crear
            </button>
            <button onClick={() => navigate('/registro-personal')} className="px-2 py-2.5 rounded-xl bg-green-600 text-white text-[11px] font-black">
              Empleados
            </button>
            <button onClick={() => navigate('/reportes')} className={`px-2 py-2.5 rounded-xl text-[11px] font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
              Auditoria
            </button>
          </div>

          <section
            className={`rounded-[2rem] border p-6 md:p-8 text-white shadow-xl ${
              darkMode
                ? 'border-green-900 bg-gradient-to-r from-green-700 to-green-800'
                : 'border-green-200 bg-gradient-to-r from-green-600 to-green-700'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-green-100 font-bold mb-2">Control de acceso</p>
                <h1 className="text-2xl md:text-4xl font-black text-white">Gestion de empleados</h1>
                <p className="text-green-50 text-sm mt-2">Administra usuarios autorizados para ingresar al sistema.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:min-w-[240px]">
                <div className="rounded-2xl bg-white/20 border border-white/30 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-green-100 font-bold">Total</p>
                  <p className="text-2xl font-black">{usuarios.length}</p>
                </div>
                <div className="rounded-2xl bg-white/20 border border-white/30 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-green-100 font-bold">Admins</p>
                  <p className="text-2xl font-black">{totalAdmins}</p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid lg:grid-cols-5 gap-6">
          <form ref={formRef} onSubmit={handleSubmit} className={`lg:col-span-2 rounded-[1.5rem] sm:rounded-[2rem] border shadow-sm p-4 sm:p-6 space-y-4 ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'
          }`}>
            <div className={`pb-4 border-b ${darkMode ? 'border-slate-800' : 'border-gray-100'}`}>
              <h2 className={`text-lg font-black ${darkMode ? 'text-white' : 'text-slate-800'}`}>{editandoId ? 'Editar empleado' : 'Nuevo empleado'}</h2>
              <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{editandoId ? 'Actualiza la informacion del usuario seleccionado.' : 'Completa los datos para habilitar su acceso.'}</p>
            </div>

            <div>
              <label className={`block text-xs font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Nombre completo</label>
              <input
                type="text"
                value={formData.nombre_completo}
                onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-green-500/20 font-medium ${
                  darkMode ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-gray-200 bg-gray-50 focus:bg-white text-slate-700'
                }`}
                required
                placeholder="Ej: Alejandro Correa Zapata"
              />
            </div>

            <div>
              <label className={`block text-xs font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Area</label>
              <select
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-green-500/20 font-medium ${
                  darkMode ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-gray-200 bg-gray-50 focus:bg-white text-slate-700'
                }`}
              >
                {AREAS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-xs font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Rol</label>
              <select
                value={formData.rol}
                onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-green-500/20 font-medium ${
                  darkMode ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-gray-200 bg-gray-50 focus:bg-white text-slate-700'
                }`}
              >
                <option value="empleado">Empleado</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            {formData.rol === 'admin' && (
              <div>
                <label className={`block text-xs font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {editandoId ? 'Nueva contrasena (opcional)' : 'Contrasena'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-green-500/20 font-medium ${
                    darkMode ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-gray-200 bg-gray-50 focus:bg-white text-slate-700'
                  }`}
                  placeholder="Solo requerido para administradores nuevos"
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black text-xs uppercase tracking-wider py-3 rounded-xl transition disabled:opacity-60 shadow-lg"
              >
                {loading ? 'Guardando...' : editandoId ? 'Actualizar' : 'Agregar'}
              </button>
              {editandoId && (
                <button
                  type="button"
                  onClick={limpiarFormulario}
                  className={`px-4 py-3 rounded-xl border text-xs font-black uppercase tracking-wider ${
                    darkMode ? 'border-slate-700 text-slate-300 hover:text-white hover:border-slate-500' : 'border-gray-200 text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <section className={`lg:col-span-3 rounded-[1.5rem] sm:rounded-[2rem] border shadow-sm p-4 sm:p-6 ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'
          }`}>
            <div className="mb-5">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                  <h2 className={`text-lg font-black ${darkMode ? 'text-white' : 'text-slate-800'}`}>Empleados registrados</h2>
                  <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Listado general con busqueda por nombre, area o rol.</p>
                </div>

                <div className="w-full lg:w-[360px]">
                  <label className={`text-[10px] uppercase tracking-wider font-black ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Busqueda</label>
                  <div className="mt-1 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={filtro}
                      onChange={(e) => setFiltro(e.target.value)}
                      placeholder="Nombre, area o rol"
                      className={`flex-1 px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-green-500/20 text-sm ${
                        darkMode ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-gray-200 bg-gray-50 focus:bg-white'
                      }`}
                    />
                    {!!filtro && (
                      <button
                        type="button"
                        onClick={() => setFiltro('')}
                        className="px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border border-green-200 text-green-700 hover:bg-green-50"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="md:hidden space-y-3">
              {usuariosFiltrados.length > 0 ? (
                usuariosFiltrados.map((u) => (
                  <article key={`mobile-${u.id}`} className={`rounded-2xl border p-4 ${
                    darkMode ? 'border-slate-700 bg-slate-800/70' : 'border-gray-200 bg-gray-50/70'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 text-green-800 text-xs font-black flex items-center justify-center shrink-0">
                        {(u.nombre_completo || '?').split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-semibold leading-tight break-words ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{u.nombre_completo}</p>
                        <p className={`text-[10px] uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>ID: EMP-{u.id}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                        darkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
                      }`}>
                        {u.area}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${
                        u.rol === 'admin' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
                      }`}>
                        {u.rol}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => editarUsuario(u)}
                        className={`text-xs font-black px-3 py-2 rounded-lg border ${
                          darkMode ? 'text-green-300 bg-slate-900 border-green-800' : 'text-green-700 bg-white border-green-200'
                        }`}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminarUsuario(u)}
                        className={`text-xs font-black px-3 py-2 rounded-lg border ${
                          darkMode ? 'text-red-300 bg-slate-900 border-red-800' : 'text-red-600 bg-white border-red-200'
                        }`}
                      >
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className={`rounded-2xl border py-10 text-center ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-gray-100 bg-gray-50'}`}>
                  <p className="text-slate-400 text-sm font-semibold">No hay empleados con ese filtro.</p>
                </div>
              )}
            </div>

            <div className={`hidden md:block rounded-2xl border p-4 ${darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-gray-100 bg-slate-50/70'}`}>
              <div className={`grid grid-cols-[2fr_1.2fr_0.8fr_1fr] gap-3 px-4 py-2 rounded-xl text-[11px] uppercase tracking-wider font-black ${
                darkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-500 border border-slate-200'
              }`}>
                <span>Empleado</span>
                <span>Area</span>
                <span>Rol</span>
                <span className="text-right">Acciones</span>
              </div>

              <div className="mt-3 space-y-2 max-h-[560px] overflow-auto pr-1">
                {usuariosFiltrados.length > 0 ? (
                  usuariosFiltrados.map((u) => (
                    <article
                      key={u.id}
                      className={`grid grid-cols-[2fr_1.2fr_0.8fr_1fr] gap-3 items-center px-4 py-3 rounded-2xl border transition ${
                        darkMode ? 'bg-slate-900 border-slate-700 hover:bg-slate-800/90' : 'bg-white border-slate-200 hover:bg-green-50/70'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-green-100 text-green-800 text-xs font-black flex items-center justify-center shrink-0">
                          {(u.nombre_completo || '?').split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className={`font-semibold leading-tight truncate ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{u.nombre_completo}</p>
                          <p className={`text-[10px] uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>ID: EMP-{u.id}</p>
                        </div>
                      </div>

                      <div>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                          darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}>
                          {u.area}
                        </span>
                      </div>

                      <div>
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${
                            u.rol === 'admin' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
                          }`}
                        >
                          {u.rol}
                        </span>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => editarUsuario(u)}
                          className={`text-xs font-black px-3 py-1.5 rounded-lg border transition ${
                            darkMode ? 'text-green-300 bg-slate-800 border-green-800 hover:bg-slate-700' : 'text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 border-green-200'
                          }`}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarUsuario(u)}
                          className={`text-xs font-black px-3 py-1.5 rounded-lg border transition ${
                            darkMode ? 'text-red-300 bg-slate-800 border-red-800 hover:bg-slate-700' : 'text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border-red-200'
                          }`}
                        >
                          Eliminar
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className={`text-center py-12 rounded-2xl border ${
                    darkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'
                  }`}>
                    <p className="text-slate-400 text-sm font-semibold">No hay empleados con ese filtro.</p>
                    {!!filtro && (
                      <button
                        type="button"
                        onClick={() => setFiltro('')}
                        className="mt-3 px-4 py-2 rounded-xl bg-green-50 text-green-700 border border-green-200 text-xs font-black uppercase tracking-wider"
                      >
                        Mostrar todos
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
        </div>
      </main>
      </div>
    </div>
  );
}

export default RegistroEmpleado;
