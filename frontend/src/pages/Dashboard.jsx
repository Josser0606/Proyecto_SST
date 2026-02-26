import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import logoSaciar from '../assets/logo_saciar.png';
import { apiUrl, assetUrl } from '../config/api';

const CATEGORIAS = [
  'Todas',
  'SST y GH',
  'Calidad',
  'Logistica y Transporte',
  'Mercadeo Social',
  'Programas y Proyectos',
  'Relaciones Institucionales',
  'Financiero y Contable',
  'Direccion'
];

function Dashboard() {
  const [publicaciones, setPublicaciones] = useState([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [busqueda, setBusqueda] = useState('');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [formEdit, setFormEdit] = useState({
    titulo: '',
    contenido: '',
    categoria: 'SST y GH',
    imagenNueva: null,
    archivosNuevos: [],
    recursosExistentes: [],
    linksNuevos: ['']
  });

  const usuario = JSON.parse(localStorage.getItem('usuario'));
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = totalScroll > 0 ? (window.pageYOffset / totalScroll) * 100 : 0;
      setScrollProgress(progress);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const cargarPublicaciones = async () => {
    try {
      const res = await axios.get(apiUrl(`/api/publicaciones?usuario_id=${usuario.id}`));
      setPublicaciones(res.data);
    } catch {
      toast.error('Error al conectar con el servidor');
    }
  };

  useEffect(() => {
    if (!usuario) {
      navigate('/');
      return;
    }
    const timerId = window.setTimeout(() => {
      void cargarPublicaciones();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [navigate, usuario]);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('darkMode', String(next));
  };

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('sidebarCollapsed', String(next));
  };

  const marcarComoLeido = async (pubId) => {
    const loadingToast = toast.loading('Registrando lectura...');
    try {
      await axios.post(apiUrl('/api/registrar-vista'), {
        usuario_id: usuario.id,
        publicacion_id: pubId
      });
      toast.success('Lectura confirmada', { id: loadingToast });
      cargarPublicaciones();
    } catch {
      toast.error('Error al registrar', { id: loadingToast });
    }
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
    ), { duration: 8000 });
  });

  const cerrarSesion = async () => {
    const confirmado = await confirmarAccion('Seguro que deseas cerrar sesion?');
    if (!confirmado) return;
    localStorage.clear();
    toast.success('Sesion cerrada');
    navigate('/');
  };

  const eliminarPub = async (id) => {
    const confirmado = await confirmarAccion('Deseas eliminar este comunicado?');
    if (!confirmado) return;
    try {
      await axios.delete(apiUrl(`/api/publicaciones/${id}`));
      toast.success('Eliminado');
      cargarPublicaciones();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const activarEdicion = (pub) => {
    setEditandoId(pub.id);
    toast('Modo edicion activado');
    setFormEdit({
      titulo: pub.titulo || '',
      contenido: pub.contenido || '',
      categoria: pub.categoria || 'SST y GH',
      imagenNueva: null,
      archivosNuevos: [],
      recursosExistentes: (pub.recursos || []).map((r) => ({ id: r.id, tipo: r.tipo, nombre: r.nombre, url: r.url })),
      linksNuevos: ['']
    });
  };

  const quitarRecursoExistente = (id) => {
    setFormEdit((prev) => ({
      ...prev,
      recursosExistentes: prev.recursosExistentes.filter((r) => r.id !== id)
    }));
  };

  const setLinkNuevoAt = (idx, value) => {
    setFormEdit((prev) => ({
      ...prev,
      linksNuevos: prev.linksNuevos.map((l, i) => (i === idx ? value : l))
    }));
  };

  const addLinkNuevo = () => {
    setFormEdit((prev) => ({ ...prev, linksNuevos: [...prev.linksNuevos, ''] }));
  };

  const removeLinkNuevo = (idx) => {
    setFormEdit((prev) => ({ ...prev, linksNuevos: prev.linksNuevos.filter((_, i) => i !== idx) }));
  };

  const guardarEdicion = async (id) => {
    const fd = new FormData();
    fd.append('titulo', formEdit.titulo);
    fd.append('contenido', formEdit.contenido);
    fd.append('categoria', formEdit.categoria);
    if (formEdit.imagenNueva) fd.append('imagen', formEdit.imagenNueva);
    formEdit.archivosNuevos.forEach((file) => fd.append('archivos', file));
    fd.append('recursos_existentes', JSON.stringify(formEdit.recursosExistentes.map((r) => r.id)));
    fd.append('links_nuevos', JSON.stringify(formEdit.linksNuevos.map((l) => l.trim()).filter(Boolean)));

    try {
      await axios.put(apiUrl(`/api/publicaciones/${id}`), fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Publicacion actualizada');
      setEditandoId(null);
      cargarPublicaciones();
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const publicacionesFiltradas = publicaciones.filter((pub) => {
    const coincideCat = categoriaFiltro === 'Todas' || pub.categoria === categoriaFiltro;
    const term = busqueda.toLowerCase();
    return coincideCat && ((pub.titulo || '').toLowerCase().includes(term) || (pub.contenido || '').toLowerCase().includes(term));
  });

  const totalPublicaciones = publicaciones.length;
  const totalLeidas = publicaciones.filter((p) => Number(p.leido) > 0).length;
  const totalPendientes = Math.max(totalPublicaciones - totalLeidas, 0);

  return (
    <div className={`min-h-screen flex flex-col overflow-x-hidden transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-gray-50 text-slate-900'}`}>
      <nav className={`px-3 sm:px-6 py-2.5 flex justify-between items-center fixed top-0 left-0 right-0 z-50 border-b transition-colors ${darkMode ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="absolute bottom-0 left-0 h-[3px] bg-green-500 transition-all duration-150" style={{ width: `${scrollProgress}%` }}></div>
        <img
          src={logoSaciar}
          alt="Logo"
          onClick={() => navigate('/dashboard')}
          className={`h-11 sm:h-14 w-auto object-contain cursor-pointer ${darkMode ? 'brightness-125' : ''}`}
          title="Ir al dashboard"
        />
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={toggleDarkMode} className={`p-2.5 rounded-xl transition-all ${darkMode ? 'bg-slate-800 text-yellow-400' : 'bg-gray-100 text-slate-500 hover:bg-gray-200'}`}>
            {darkMode ? 'Claro' : 'Oscuro'}
          </button>
          <div className={`text-right border-r pr-4 hidden sm:block ${darkMode ? 'border-slate-700' : 'border-gray-100'}`}>
            <p className="text-sm font-black">{usuario?.nombre_completo}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">{usuario?.area}</p>
          </div>
          <button onClick={cerrarSesion} className="p-2 hover:text-red-500 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          </button>
        </div>
      </nav>

      <div className="flex flex-1 min-h-0 pt-[76px]">
        <aside className={`${sidebarCollapsed ? 'w-16' : 'w-72'} shrink-0 overflow-hidden border-r p-3 hidden lg:flex fixed top-[76px] left-0 z-40 h-[calc(100vh-76px)] flex-col transition-all duration-300 ${darkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center justify-between mb-3">
            {!sidebarCollapsed && <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Filtros</p>}
            <button onClick={toggleSidebar} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`} title={sidebarCollapsed ? 'Expandir' : 'Contraer'}>
              <svg className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>
          </div>

          {!sidebarCollapsed ? (
            <div className="min-h-0 flex-1 flex flex-col">
              <div className={`space-y-2 overflow-y-auto pr-1 sidebar-scroll ${darkMode ? 'sidebar-scroll-dark' : ''}`}>
                {CATEGORIAS.map((cat) => (
                  <button key={cat} onClick={() => setCategoriaFiltro(cat)} className={`w-full text-left px-3 py-2.5 rounded-xl font-bold text-sm transition-all ${
                    categoriaFiltro === cat
                      ? 'bg-green-600 text-white'
                      : darkMode
                        ? 'hover:bg-slate-800 text-slate-300'
                        : 'hover:bg-green-50 text-slate-600'
                  }`}>
                    {cat}
                  </button>
                ))}
              </div>
              {usuario?.rol === 'admin' && (
                <div className="pt-4 mt-4 border-t border-slate-800/10 space-y-2">
                  <p className="px-1 text-[10px] uppercase tracking-[0.18em] text-slate-400 font-black">Acciones rapidas</p>
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
                  className={`w-full text-left px-3 py-2.5 rounded-xl border font-bold text-sm transition-all flex items-center gap-2 ${
                    darkMode
                        ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white'
                        : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'
                    }`}
                >
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center ${darkMode ? 'bg-slate-700/80' : 'bg-slate-100'}`}>
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
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-between py-2">
              <button title={`Filtro actual: ${categoriaFiltro}`} className="w-10 h-10 rounded-xl bg-green-600 text-white flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 6h16M4 12h10M4 18h16"></path>
                </svg>
              </button>
              {usuario?.rol === 'admin' && (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => navigate('/admin')}
                    className={`w-10 h-10 rounded-xl border transition flex items-center justify-center ${
                      darkMode
                        ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white'
                        : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'
                    }`}
                    title="Crear nuevo"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 5v14m-7-7h14"></path>
                    </svg>
                  </button>
                  <button
                    onClick={() => navigate('/registro-personal')}
                    className={`w-10 h-10 rounded-xl border transition flex items-center justify-center ${
                      darkMode
                        ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white'
                        : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'
                    }`}
                    title="Empleados"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5.121 17.804A9 9 0 1118.88 17.8M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                  </button>
                  <button
                    onClick={() => navigate('/reportes')}
                    className={`w-10 h-10 rounded-xl border transition flex items-center justify-center ${
                      darkMode
                        ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white'
                        : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'
                    }`}
                    title="Auditoria"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 3v18h18M7 14l3-3 3 2 4-5"></path>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>

        <main className={`flex-1 p-4 sm:p-6 lg:p-10 w-full ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-72'}`}>
          <div className="max-w-5xl mx-auto">
          <div className="lg:hidden mb-4 space-y-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen((prev) => !prev)}
                className={`w-12 h-12 rounded-xl border transition-all flex items-center justify-center ${
                  darkMode
                    ? 'bg-slate-900 border-slate-700 text-slate-200'
                    : 'bg-white border-gray-200 text-slate-600'
                }`}
                aria-label="Abrir categorias"
                title="Categorias"
              >
                <svg className={`w-5 h-5 transition-transform ${mobileFiltersOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
                <span className="sr-only">Categorias</span>
              </button>

              {mobileFiltersOpen && (
                <div className={`mt-2 rounded-2xl border p-2 shadow-lg absolute left-0 z-30 w-[240px] ${
                  darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
                }`}>
                  <div className={`max-h-56 overflow-y-auto sidebar-scroll ${darkMode ? 'sidebar-scroll-dark' : ''}`}>
                    {CATEGORIAS.map((cat) => (
                      <button
                        key={`mobile-${cat}`}
                        onClick={() => {
                          setCategoriaFiltro(cat);
                          setMobileFiltersOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black transition-all ${
                          categoriaFiltro === cat
                            ? 'bg-green-600 text-white'
                            : darkMode
                              ? 'text-slate-200 hover:bg-slate-800'
                              : 'text-slate-600 hover:bg-green-50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {usuario?.rol === 'admin' && (
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => navigate('/admin')} className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-black">
                  Crear
                </button>
                <button onClick={() => navigate('/registro-personal')} className={`px-3 py-2 rounded-xl text-xs font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
                  Empleados
                </button>
                <button onClick={() => navigate('/reportes')} className={`px-3 py-2 rounded-xl text-xs font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
                  Auditoria
                </button>
              </div>
            )}
          </div>

          <section className={`mb-6 rounded-2xl border p-4 sm:p-5 ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100 shadow-sm'
          }`}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className={`text-sm sm:text-base font-black ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Resumen del Tablero</h2>
              <span className={`text-[10px] uppercase tracking-widest font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Comunicados</span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className={`rounded-xl border p-3 ${darkMode ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50/70'}`}>
                <p className={`text-[10px] uppercase tracking-wider font-black ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total</p>
                <p className={`text-xl font-black ${darkMode ? 'text-white' : 'text-slate-800'}`}>{totalPublicaciones}</p>
              </div>
              <div className={`rounded-xl border p-3 ${darkMode ? 'border-green-800 bg-green-900/20' : 'border-green-200 bg-green-50/70'}`}>
                <p className={`text-[10px] uppercase tracking-wider font-black ${darkMode ? 'text-green-300' : 'text-green-700'}`}>Leidos</p>
                <p className={`text-xl font-black ${darkMode ? 'text-green-200' : 'text-green-700'}`}>{totalLeidas}</p>
              </div>
              <div className={`rounded-xl border p-3 ${darkMode ? 'border-amber-800 bg-amber-900/20' : 'border-amber-200 bg-amber-50/70'}`}>
                <p className={`text-[10px] uppercase tracking-wider font-black ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>Pendientes</p>
                <p className={`text-xl font-black ${darkMode ? 'text-amber-200' : 'text-amber-700'}`}>{totalPendientes}</p>
              </div>
            </div>
          </section>

          <input type="text" placeholder="Buscar comunicado por titulo o contenido..." className={`w-full px-4 sm:px-6 py-3 sm:py-4 mb-6 sm:mb-10 rounded-2xl border outline-none transition-all ${darkMode ? 'bg-slate-900 border-slate-700 focus:border-green-500 text-white' : 'bg-white border-gray-200 focus:border-green-500 shadow-sm'}`} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />

          <div className="space-y-12">
            {publicacionesFiltradas.length === 0 && (
              <article className={`rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border transition-all duration-300 p-6 sm:p-10 text-center ${darkMode ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-gray-100 shadow-xl shadow-slate-200/50'}`}>
                <h3 className="text-xl sm:text-2xl font-black mb-2">No hay comunicados para mostrar</h3>
                <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'} mb-6`}>
                  Publica uno nuevo o ajusta los filtros para ver resultados.
                </p>
                {usuario?.rol === 'admin' && (
                  <button onClick={() => navigate('/admin')} className="bg-green-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest">
                    Crear comunicado
                  </button>
                )}
              </article>
            )}

            {publicacionesFiltradas.map((pub) => {
              const imagenesSecundarias = (pub.recursos || []).filter((r) => r.tipo === 'imagen');
              const otrosRecursos = (pub.recursos || []).filter((r) => r.tipo !== 'imagen');
              return (
              <article key={pub.id} className={`rounded-[2.5rem] overflow-hidden border transition-all duration-300 ${darkMode ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-gray-100 shadow-xl shadow-slate-200/50'}`}>
                {pub.imagen_url && (
                  <div className={`w-full flex justify-center p-4 sm:p-8 border-b ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-gray-50'}`}>
                    <img src={assetUrl(pub.imagen_url)} alt="Comunicado" className="max-w-full h-auto max-h-[85vh] rounded-2xl shadow-2xl object-contain transition-transform duration-500 hover:scale-[1.01]" />
                  </div>
                )}

                <div className="p-5 sm:p-8 lg:p-10">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-lg ${darkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-700'}`}>{pub.categoria}</span>
                    <span className="text-[11px] text-slate-400 font-bold">{new Date(pub.fecha_publicacion).toLocaleDateString()}</span>
                  </div>

                  {editandoId === pub.id ? (
                    <div className="space-y-4">
                      <input className={`w-full p-4 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : ''}`} value={formEdit.titulo} onChange={(e) => setFormEdit({ ...formEdit, titulo: e.target.value })} />
                      <select className={`w-full p-4 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : ''}`} value={formEdit.categoria} onChange={(e) => setFormEdit({ ...formEdit, categoria: e.target.value })}>
                        {CATEGORIAS.filter((c) => c !== 'Todas').map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <textarea className={`w-full p-4 rounded-xl border h-32 ${darkMode ? 'bg-slate-800 border-slate-700' : ''}`} value={formEdit.contenido} onChange={(e) => setFormEdit({ ...formEdit, contenido: e.target.value })} />

                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-slate-500 block mb-1">Reemplazar imagen</label>
                          <input type="file" accept="image/*" onChange={(e) => setFormEdit({ ...formEdit, imagenNueva: e.target.files?.[0] || null })} className="w-full text-xs border rounded-lg p-2" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 block mb-1">Nuevos adjuntos</label>
                          <input type="file" multiple onChange={(e) => setFormEdit({ ...formEdit, archivosNuevos: Array.from(e.target.files || []) })} className="w-full text-xs border rounded-lg p-2" />
                        </div>
                      </div>

                      <div className={`rounded-xl p-3 ${darkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                        <p className={`text-xs font-bold mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>Recursos actuales (quitar para eliminar)</p>
                        <div className="flex flex-wrap gap-2">
                          {formEdit.recursosExistentes.map((r) => (
                            <button key={r.id} type="button" onClick={() => quitarRecursoExistente(r.id)} className={`text-xs px-3 py-1.5 rounded-full border hover:border-red-300 hover:text-red-600 ${
                              darkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                            }`}>
                              {r.tipo === 'archivo' ? 'Archivo: ' : 'Link: '}{r.nombre} x
                            </button>
                          ))}
                          {formEdit.recursosExistentes.length === 0 && <p className="text-xs text-slate-400">Sin recursos conservados.</p>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <p className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>Agregar links nuevos</p>
                          <button type="button" onClick={addLinkNuevo} className="text-xs font-bold text-green-700">+ Link</button>
                        </div>
                        {formEdit.linksNuevos.map((l, idx) => (
                          <div key={idx} className="flex gap-2">
                            <input type="url" value={l} onChange={(e) => setLinkNuevoAt(idx, e.target.value)} className={`flex-1 text-sm border rounded-lg px-3 py-2 ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : ''}`} placeholder="https://..." />
                            {formEdit.linksNuevos.length > 1 && <button type="button" onClick={() => removeLinkNuevo(idx)} className={`px-3 border rounded-lg text-red-600 ${darkMode ? 'border-slate-700 bg-slate-900' : ''}`}>X</button>}
                          </div>
                        ))}
                      </div>

                      <div>
                        <button onClick={() => guardarEdicion(pub.id)} className="bg-green-600 text-white px-6 py-2 rounded-xl text-xs font-bold">Guardar</button>
                        <button onClick={() => setEditandoId(null)} className="ml-4 text-xs font-bold opacity-50">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-2xl font-black mb-4">{pub.titulo}</h3>
                      <p className={`text-base leading-relaxed mb-6 whitespace-pre-line ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{pub.contenido}</p>

                      {imagenesSecundarias.length > 0 && (
                        <div className={`mb-6 p-4 rounded-2xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                          <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>Galeria de imagenes</p>
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {imagenesSecundarias.map((img) => (
                              <a key={img.id} href={assetUrl(img.url)} target="_blank" rel="noreferrer" className={`block rounded-xl overflow-hidden border ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                                <img src={assetUrl(img.url)} alt={img.nombre} className="w-full h-36 object-cover" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {otrosRecursos.length > 0 && (
                        <div className={`mb-6 p-4 rounded-2xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                          <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>Recursos adjuntos</p>
                          <div className="flex flex-wrap gap-2">
                            {otrosRecursos.map((r) => (
                              <a key={r.id} href={r.tipo === 'archivo' ? assetUrl(r.url) : r.url} target="_blank" rel="noreferrer" className={`px-3 py-2 rounded-lg text-xs font-bold border hover:border-green-300 hover:text-green-700 ${
                                darkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                              }`}>
                                {r.tipo === 'archivo' ? 'Archivo' : 'Link'}: {r.nombre}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-8 border-t ${darkMode ? 'border-slate-800' : 'border-gray-100'}`}>
                    <button onClick={() => !pub.leido && marcarComoLeido(pub.id)} disabled={pub.leido > 0} className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${pub.leido > 0 ? (darkMode ? 'bg-slate-800 text-slate-500' : 'bg-gray-50 text-slate-300') : 'bg-green-600 text-white shadow-xl hover:bg-green-700 hover:-translate-y-1'}`}>
                      {pub.leido > 0 ? 'Leido' : 'Confirmar Lectura'}
                    </button>

                    {usuario?.rol === 'admin' && editandoId !== pub.id && (
                      <div className="flex gap-2">
                        <button onClick={() => activarEdicion(pub)} className="p-2 text-slate-400 hover:text-green-700">Editar</button>
                        <button onClick={() => eliminarPub(pub.id)} className="p-2 text-slate-400 hover:text-red-500">Eliminar</button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )})}
          </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
