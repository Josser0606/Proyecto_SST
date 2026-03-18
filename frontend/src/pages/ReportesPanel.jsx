import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import logoSaciar from '../assets/logo_saciar.png';
import { apiUrl } from '../config/api';

function ReportesPanel() {
  const [reporte, setReporte] = useState([]);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const [modoCalendario, setModoCalendario] = useState('mes');
  const [mesCalendario, setMesCalendario] = useState(() => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  });
  const [fechaBaseSemana, setFechaBaseSemana] = useState(() => new Date());
  const [fechaCalendarioSeleccionada, setFechaCalendarioSeleccionada] = useState('');
  const navigate = useNavigate();
  const usuarioActual = JSON.parse(localStorage.getItem('usuario'));

  const toLocalYmd = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const parseFechaLectura = (fecha) => {
    if (!fecha) return null;
    if (fecha instanceof Date) return fecha;
    if (typeof fecha === 'string') {
      const limpio = fecha.trim().replace(' ', 'T');
      const sinZona = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;
      return new Date(sinZona.test(limpio) ? `${limpio}Z` : limpio);
    }
    return new Date(fecha);
  };

  const formatearFechaLectura = (fecha) => {
    const d = parseFechaLectura(fecha);
    if (!d || Number.isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(d);
  };

  const resumenReaccionesTexto = (reg) => {
    const util = Number(reg.reaccion_util || 0);
    const importante = Number(reg.reaccion_importante || 0);
    const meGusta = Number(reg.reaccion_me_gusta || 0);
    const total = Number(reg.total_reacciones || 0);
    if (total <= 0) return 'Sin reacciones';
    return `${total} total - U:${util} I:${importante} MG:${meGusta}`;
  };

  useEffect(() => {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (usuario?.rol !== 'admin') {
      navigate('/dashboard');
      return;
    }
    const load = async () => {
      try {
        const res = await axios.get(apiUrl('/api/reportes'));
        setReporte(res.data || []);
      } catch {
        setReporte([]);
      }
    };
    void load();
  }, [navigate]);

  const datosFiltrados = useMemo(() => reporte, [reporte]);

  const resumenReaccionesAuditoria = useMemo(() => {
    const map = new Map();
    datosFiltrados.forEach((reg) => {
      const key = reg.publicacion_id || reg.publicacion;
      const prev = map.get(key) || { total: 0, util: 0, importante: 0, meGusta: 0 };
      const next = {
        total: Math.max(prev.total, Number(reg.total_reacciones || 0)),
        util: Math.max(prev.util, Number(reg.reaccion_util || 0)),
        importante: Math.max(prev.importante, Number(reg.reaccion_importante || 0)),
        meGusta: Math.max(prev.meGusta, Number(reg.reaccion_me_gusta || 0))
      };
      map.set(key, next);
    });
    const values = Array.from(map.values());
    return {
      comunicadosConReacciones: values.filter((v) => v.total > 0).length,
      totalReacciones: values.reduce((acc, v) => acc + v.total, 0),
      totalUtil: values.reduce((acc, v) => acc + v.util, 0),
      totalImportante: values.reduce((acc, v) => acc + v.importante, 0),
      totalMeGusta: values.reduce((acc, v) => acc + v.meGusta, 0)
    };
  }, [datosFiltrados]);

  const topComunicadosReaccionados = useMemo(() => {
    const map = new Map();
    datosFiltrados.forEach((reg) => {
      const key = reg.publicacion_id || reg.publicacion;
      const prev = map.get(key) || {
        id: key,
        titulo: reg.publicacion || 'Sin titulo',
        total: 0,
        util: 0,
        importante: 0,
        meGusta: 0
      };
      map.set(key, {
        ...prev,
        titulo: reg.publicacion || prev.titulo,
        total: Math.max(prev.total, Number(reg.total_reacciones || 0)),
        util: Math.max(prev.util, Number(reg.reaccion_util || 0)),
        importante: Math.max(prev.importante, Number(reg.reaccion_importante || 0)),
        meGusta: Math.max(prev.meGusta, Number(reg.reaccion_me_gusta || 0))
      });
    });
    return Array.from(map.values())
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total || a.titulo.localeCompare(b.titulo))
      .slice(0, 5);
  }, [datosFiltrados]);

  const conteoPorFecha = useMemo(() => {
    const acc = {};
    datosFiltrados.forEach((reg) => {
      const d = parseFechaLectura(reg.fecha_lectura);
      if (!d || Number.isNaN(d.getTime())) return;
      const key = toLocalYmd(d);
      acc[key] = (acc[key] || 0) + 1;
    });
    return acc;
  }, [datosFiltrados]);

  const diasCalendario = useMemo(() => {
    const y = mesCalendario.getFullYear();
    const m = mesCalendario.getMonth();
    const primerDia = new Date(y, m, 1);
    const ultimoDia = new Date(y, m + 1, 0);
    const primerDiaSemana = primerDia.getDay();
    const celdas = [];
    for (let i = 0; i < primerDiaSemana; i += 1) celdas.push(null);
    for (let d = 1; d <= ultimoDia.getDate(); d += 1) {
      const fecha = new Date(y, m, d);
      celdas.push({
        dia: d,
        ymd: toLocalYmd(fecha),
        count: conteoPorFecha[toLocalYmd(fecha)] || 0
      });
    }
    return celdas;
  }, [mesCalendario, conteoPorFecha]);

  const diasSemana = useMemo(() => {
    const base = new Date(fechaBaseSemana);
    if (Number.isNaN(base.getTime())) return [];
    const inicio = new Date(base);
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - inicio.getDay());
    const celdas = [];
    for (let i = 0; i < 7; i += 1) {
      const fecha = new Date(inicio);
      fecha.setDate(inicio.getDate() + i);
      const ymd = toLocalYmd(fecha);
      celdas.push({
        dia: fecha.getDate(),
        ymd,
        count: conteoPorFecha[ymd] || 0
      });
    }
    return celdas;
  }, [fechaBaseSemana, conteoPorFecha]);

  const publicacionesPorFechaSeleccionada = useMemo(() => {
    if (!fechaCalendarioSeleccionada) return [];
    return datosFiltrados.filter((reg) => {
      const d = parseFechaLectura(reg.fecha_lectura);
      return d && !Number.isNaN(d.getTime()) && toLocalYmd(d) === fechaCalendarioSeleccionada;
    });
  }, [datosFiltrados, fechaCalendarioSeleccionada]);

  const notificacionesOperativas = useMemo(() => {
    const list = [];
    const hoy = toLocalYmd(new Date());
    const confirmacionesHoy = datosFiltrados.filter((reg) => {
      const d = parseFechaLectura(reg.fecha_lectura);
      return d && !Number.isNaN(d.getTime()) && toLocalYmd(d) === hoy;
    }).length;
    const reconfirmaciones = datosFiltrados.filter((reg) => (reg.tipo_confirmacion || '').toLowerCase() === 'reconfirmacion').length;

    if (confirmacionesHoy > 0) list.push({ id: 'hoy', titulo: 'Actividad del dia', detalle: `${confirmacionesHoy} confirmacion(es) registradas hoy.` });
    if (reconfirmaciones > 0) list.push({ id: 'rec', titulo: 'Reconfirmaciones activas', detalle: `${reconfirmaciones} registro(s) de reconfirmacion en auditoria.` });
    if (resumenReaccionesAuditoria.totalReacciones === 0 && datosFiltrados.length > 0) list.push({ id: 'no-rx', titulo: 'Sin reacciones', detalle: 'Aun no hay reacciones registradas.' });
    if (list.length === 0) list.push({ id: 'ok', titulo: 'Sin alertas operativas', detalle: 'Todo en orden por ahora.' });
    return list.slice(0, 4);
  }, [datosFiltrados, resumenReaccionesAuditoria.totalReacciones]);

  const etiquetaMesCalendario = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(mesCalendario);
  const etiquetaSemanaCalendario = useMemo(() => {
    if (!diasSemana.length) return '';
    const first = diasSemana[0]?.ymd;
    const last = diasSemana[diasSemana.length - 1]?.ymd;
    const a = first ? new Date(`${first}T00:00:00`) : null;
    const b = last ? new Date(`${last}T00:00:00`) : null;
    if (!a || !b || Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '';
    const f = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' });
    return `${f.format(a)} - ${f.format(b)}`;
  }, [diasSemana]);
  const hoyYmd = toLocalYmd(new Date());
  const totalEventosMes = useMemo(
    () => diasCalendario.reduce((acc, celda) => acc + (celda?.count || 0), 0),
    [diasCalendario]
  );
  const totalEventosSemana = useMemo(
    () => diasSemana.reduce((acc, celda) => acc + (celda?.count || 0), 0),
    [diasSemana]
  );
  const irAHoyCalendario = () => {
    const hoy = new Date();
    setMesCalendario(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    setFechaBaseSemana(new Date(hoy));
    setFechaCalendarioSeleccionada(toLocalYmd(hoy));
  };
  const limpiarSeleccionCalendario = () => setFechaCalendarioSeleccionada('');
  const irAFechaCalendario = (ymd) => {
    if (!ymd) {
      setFechaCalendarioSeleccionada('');
      return;
    }
    const [y, m, d] = ymd.split('-').map(Number);
    if (!y || !m || !d) return;
    setMesCalendario(new Date(y, m - 1, 1));
    setFechaBaseSemana(new Date(y, m - 1, d));
    setFechaCalendarioSeleccionada(ymd);
  };
  const cambiarPeriodoCalendario = (delta) => {
    if (modoCalendario === 'semana') {
      setFechaBaseSemana((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + (delta * 7));
        return next;
      });
      return;
    }
    setMesCalendario((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };
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
    <div className={`min-h-screen flex flex-col overflow-x-hidden transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-gradient-to-br from-slate-100 via-white to-slate-100 text-slate-900'}`}>
      <nav className={`px-3 sm:px-6 py-2.5 flex justify-between items-center fixed top-0 left-0 right-0 z-50 border-b transition-colors backdrop-blur-xl ${darkMode ? 'bg-slate-900/95 border-slate-800 shadow-2xl' : 'bg-white/90 border-gray-100 shadow-sm'}`}>
        <div className="flex items-center gap-4">
          <img src={logoSaciar} alt="Logo" onClick={() => navigate('/dashboard')} className="h-11 sm:h-14 w-auto object-contain cursor-pointer" />
          <div className={`h-5 w-[1px] hidden sm:block ${darkMode ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">Panel Analitico</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={toggleDarkMode} className={`p-2.5 rounded-xl ${darkMode ? 'bg-slate-800 text-yellow-400' : 'bg-gray-100 text-slate-500 hover:bg-gray-200'}`}>
            {darkMode ? 'Light' : 'Dark'}
          </button>
          <div className={`text-right border-r pr-4 hidden sm:block ${darkMode ? 'border-slate-700' : 'border-gray-100'}`}>
            <p className="text-sm font-black">{usuarioActual?.nombre_completo}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">{usuarioActual?.area}</p>
          </div>
          <button onClick={() => navigate('/dashboard')} className="group flex items-center gap-2 text-slate-500 hover:text-green-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            <span className="text-xs font-bold uppercase tracking-tighter hidden sm:block">Volver</span>
          </button>
        </div>
      </nav>

      <div className="flex flex-1 min-h-0 pt-[76px]">
        <aside className={`${sidebarCollapsed ? 'w-16' : 'w-72'} shrink-0 overflow-hidden border-r p-3 hidden lg:flex fixed top-[76px] left-0 z-40 h-[calc(100vh-76px)] flex-col transition-all duration-300 ${darkMode ? 'bg-slate-900/60 border-slate-800 shadow-2xl shadow-black/20' : 'bg-white/95 border-gray-100 shadow-xl shadow-slate-200/40'}`}>
          <div className="flex items-center justify-between mb-3">
            {!sidebarCollapsed && <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Navegacion</p>}
            <button onClick={toggleSidebar} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`} title={sidebarCollapsed ? 'Expandir' : 'Contraer'}>
              <svg className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>
          </div>

          {!sidebarCollapsed ? (
            <div className="min-h-0 flex-1 flex flex-col">
              <div className="space-y-2">
                <button onClick={() => navigate('/dashboard')} className={`w-full text-left px-3 py-2.5 rounded-xl border font-bold text-sm transition-all flex items-center gap-2 ${darkMode ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center ${darkMode ? 'bg-slate-700/80' : 'bg-slate-100'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 10.5L12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5"></path></svg>
                  </span>
                  Inicio
                </button>
                <button onClick={() => navigate('/admin')} className={`w-full text-left px-3 py-2.5 rounded-xl border font-bold text-sm transition-all flex items-center gap-2 ${darkMode ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center ${darkMode ? 'bg-slate-700/80' : 'bg-slate-100'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 5v14m-7-7h14"></path></svg>
                  </span>
                  Crear Nuevo
                </button>
                <button onClick={() => navigate('/registro-personal')} className={`w-full text-left px-3 py-2.5 rounded-xl border font-bold text-sm transition-all flex items-center gap-2 ${darkMode ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center ${darkMode ? 'bg-slate-700/80' : 'bg-slate-100'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5.121 17.804A9 9 0 1118.88 17.8M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  </span>
                  Empleados
                </button>
                <button onClick={() => navigate('/reportes')} className={`w-full text-left px-3 py-2.5 rounded-xl border font-bold text-sm transition-all flex items-center gap-2 ${darkMode ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center ${darkMode ? 'bg-slate-700/80' : 'bg-slate-100'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 3v18h18M7 14l3-3 3 2 4-5"></path></svg>
                  </span>
                  Auditoria
                </button>
                <button onClick={() => navigate('/reportes-panel')} className="w-full text-left px-3 py-2.5 rounded-xl border border-green-300 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold text-sm hover:brightness-105 transition-all flex items-center gap-2 shadow-sm">
                  <span className="w-5 h-5 rounded-md bg-white/25 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 19h16M7 16V9m5 7V5m5 11v-6"></path></svg>
                  </span>
                  Panel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <button onClick={() => navigate('/dashboard')} className={`w-10 h-10 rounded-xl border transition flex items-center justify-center ${darkMode ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`} title="Inicio">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 10.5L12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5"></path></svg>
              </button>
              <button onClick={() => navigate('/admin')} className={`w-10 h-10 rounded-xl border transition flex items-center justify-center ${darkMode ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`} title="Crear nuevo">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 5v14m-7-7h14"></path></svg>
              </button>
              <button onClick={() => navigate('/registro-personal')} className={`w-10 h-10 rounded-xl border transition flex items-center justify-center ${darkMode ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`} title="Empleados">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5.121 17.804A9 9 0 1118.88 17.8M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              </button>
              <button onClick={() => navigate('/reportes')} className={`w-10 h-10 rounded-xl border transition flex items-center justify-center ${darkMode ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`} title="Auditoria">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 3v18h18M7 14l3-3 3 2 4-5"></path></svg>
              </button>
              <button onClick={() => navigate('/reportes-panel')} className="w-10 h-10 rounded-xl border border-green-500 bg-green-600 text-white hover:bg-green-700 transition shadow-sm flex items-center justify-center" title="Panel analitico">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 19h16M7 16V9m5 7V5m5 11v-6"></path></svg>
              </button>
            </div>
          )}
        </aside>

        <main className={`flex-1 min-w-0 p-4 sm:p-6 md:p-10 ${sidebarCollapsed ? 'lg:ml-16 lg:w-[calc(100%-4rem)]' : 'lg:ml-72 lg:w-[calc(100%-18rem)]'}`}>
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="lg:hidden grid grid-cols-5 gap-2 mb-4">
              <button onClick={() => navigate('/dashboard')} className={`px-2 py-2.5 rounded-xl text-[11px] font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>Inicio</button>
              <button onClick={() => navigate('/admin')} className={`px-2 py-2.5 rounded-xl text-[11px] font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>Crear</button>
              <button onClick={() => navigate('/registro-personal')} className={`px-2 py-2.5 rounded-xl text-[11px] font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>Empleados</button>
              <button onClick={() => navigate('/reportes')} className={`px-2 py-2.5 rounded-xl text-[11px] font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>Auditoria</button>
              <button onClick={() => navigate('/reportes-panel')} className="px-2 py-2.5 rounded-xl bg-green-600 text-white text-[11px] font-black">Panel</button>
            </div>

          <div className="mb-4 sm:mb-5">
            <h1 className={`text-2xl sm:text-4xl 2xl:text-[2.8rem] leading-[1] font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-800'}`}>
              Auditoria de registros
            </h1>
            <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'} font-medium`}>
              Esta vista queda enfocada en consulta, filtros, eliminacion y exportacion.
            </p>
          </div>

          <section className={`rounded-[24px] border p-4 transition-all duration-300 ${darkMode ? 'bg-slate-900 border-slate-800 shadow-xl shadow-black/20' : 'bg-white border-gray-100 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.35)]'}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-sm sm:text-base font-black ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Notificaciones operativas</h2>
              <span className={`text-[10px] uppercase tracking-wider font-black ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{notificacionesOperativas.length} alerta(s)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {notificacionesOperativas.map((item) => (
                <article key={item.id} className={`rounded-2xl border p-3 transition-all duration-300 ${darkMode ? 'border-slate-700 bg-slate-800/70 hover:bg-slate-800' : 'border-slate-200 bg-slate-50/70 hover:bg-white hover:shadow-sm'}`}>
                  <p className={`text-xs font-black ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{item.titulo}</p>
                  <p className={`text-[11px] mt-1 font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{item.detalle}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={`rounded-[24px] border p-4 sm:p-5 transition-all duration-300 ${darkMode ? 'bg-slate-900 border-slate-800 shadow-xl shadow-black/20' : 'bg-white border-gray-100 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.35)]'}`}>
            <div className={`rounded-2xl border p-3 sm:p-4 mb-4 ${darkMode ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50/70 shadow-sm'}`}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className={`text-sm sm:text-base font-black ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Calendario de actividad</h2>
                <span className={`text-[10px] sm:text-[11px] px-2.5 py-1 rounded-lg border font-black uppercase tracking-wider ${
                  darkMode ? 'border-slate-600 text-slate-300 bg-slate-800' : 'border-slate-200 text-slate-600 bg-white'
                }`}>
                  {modoCalendario === 'semana' ? 'Vista semanal' : 'Vista mensual'}
                </span>
              </div>
              <p className={`text-xs font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Navega por periodos y selecciona una fecha para revisar actividad puntual.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => cambiarPeriodoCalendario(-1)} className={`w-8 h-8 rounded-lg border flex items-center justify-center ${darkMode ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-gray-200 bg-white text-slate-700'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <span className={`text-xs sm:text-sm font-black capitalize ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                  {modoCalendario === 'semana' ? etiquetaSemanaCalendario : etiquetaMesCalendario}
                </span>
                <button type="button" onClick={() => cambiarPeriodoCalendario(1)} className={`w-8 h-8 rounded-lg border flex items-center justify-center ${darkMode ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-gray-200 bg-white text-slate-700'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
              </div>
            </div>
            <div className={`mb-3 inline-flex rounded-xl border overflow-hidden ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setModoCalendario('mes')}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider ${
                  modoCalendario === 'mes'
                    ? 'bg-green-600 text-white'
                    : darkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-600'
                }`}
              >
                Mes
              </button>
              <button
                type="button"
                onClick={() => setModoCalendario('semana')}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider ${
                  modoCalendario === 'semana'
                    ? 'bg-green-600 text-white'
                    : darkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-600'
                }`}
              >
                Semana
              </button>
            </div>
            <div className="mb-4 flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3">
              <div>
                <label className={`block text-[10px] font-black uppercase tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Ir a fecha
                </label>
                <input
                  type="date"
                  value={fechaCalendarioSeleccionada}
                  onChange={(e) => irAFechaCalendario(e.target.value)}
                  className={`px-3 py-2 rounded-xl border text-sm ${
                    darkMode ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-gray-200 bg-white text-slate-700'
                  }`}
                />
              </div>
              <button
                type="button"
                onClick={irAHoyCalendario}
                className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-black uppercase tracking-wider"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={limpiarSeleccionCalendario}
                className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider border ${
                  darkMode ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800' : 'border-gray-200 bg-white text-slate-700 hover:bg-gray-50'
                }`}
              >
                Limpiar
              </button>
              <span className={`text-xs font-semibold sm:ml-auto ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {modoCalendario === 'semana' ? `${totalEventosSemana} registro(s) en la semana` : `${totalEventosMes} registro(s) en el mes`}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1.5 text-center mb-2">
              {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => <span key={`${d}-${i}`} className={`text-[10px] font-black uppercase ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {(modoCalendario === 'semana' ? diasSemana : diasCalendario).map((celda, idx) => (
                <div key={`c-${idx}`} className="min-h-[44px]">
                  {celda ? (
                    <button
                      type="button"
                      onClick={() => {
                        setFechaCalendarioSeleccionada(celda.ymd);
                        const [y, m, d] = celda.ymd.split('-').map(Number);
                        if (y && m && d) setFechaBaseSemana(new Date(y, m - 1, d));
                      }}
                      className={`w-full h-full rounded-lg border p-1.5 text-left transition ${
                        fechaCalendarioSeleccionada === celda.ymd
                          ? 'bg-green-600 border-green-600 text-white'
                          : celda.ymd === hoyYmd
                            ? (darkMode ? 'border-green-700 bg-green-900/20 text-green-200' : 'border-green-300 bg-green-50 text-green-800')
                            : darkMode ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black">{celda.dia}</span>
                        {celda.count > 0 && (
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                            fechaCalendarioSeleccionada === celda.ymd
                              ? 'bg-white/20 text-white'
                              : darkMode
                                ? 'bg-green-900/40 text-green-200'
                                : 'bg-green-100 text-green-700'
                          }`}>
                            {celda.count}
                          </span>
                        )}
                      </div>
                    </button>
                  ) : <div className="w-full h-full"></div>}
                </div>
              ))}
            </div>
            <div className={`mt-4 rounded-xl border p-3 ${darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50/70'}`}>
              {!fechaCalendarioSeleccionada ? (
                <p className={`text-xs font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Selecciona un dia para ver publicaciones registradas.</p>
              ) : publicacionesPorFechaSeleccionada.length === 0 ? (
                <p className={`text-xs font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>No hay registros para la fecha seleccionada.</p>
              ) : (
                <div className="space-y-2">
                  <p className={`text-xs font-black uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {publicacionesPorFechaSeleccionada.length} registro(s) el {fechaCalendarioSeleccionada}
                  </p>
                  {publicacionesPorFechaSeleccionada.slice(0, 8).map((reg, idx) => (
                    <p key={`d-${idx}`} className={`text-xs ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      {reg.publicacion} - {formatearFechaLectura(reg.fecha_lectura)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className={`rounded-[24px] border p-4 transition-all duration-300 ${darkMode ? 'bg-slate-900 border-slate-800 shadow-xl shadow-black/20' : 'bg-white border-gray-100 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.35)]'}`}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className={`text-sm sm:text-base font-black ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Impacto por reacciones</h2>
              <span className={`text-[10px] uppercase tracking-wider font-black ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Analitica</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className={`rounded-2xl border p-3 ${darkMode ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50/70'}`}><p className="text-[10px] uppercase tracking-wider font-black text-slate-500">Comunicados</p><p className="text-xl font-black">{resumenReaccionesAuditoria.comunicadosConReacciones}</p></div>
              <div className={`rounded-2xl border p-3 ${darkMode ? 'border-green-800 bg-green-900/20' : 'border-green-200 bg-green-50/70'}`}><p className={`text-[10px] uppercase tracking-wider font-black ${darkMode ? 'text-green-300' : 'text-green-700'}`}>Total</p><p className={`text-xl font-black ${darkMode ? 'text-green-200' : 'text-green-700'}`}>{resumenReaccionesAuditoria.totalReacciones}</p></div>
              <div className={`rounded-2xl border p-3 ${darkMode ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-white'}`}><p className="text-[10px] uppercase tracking-wider font-black text-slate-500">Util</p><p className="text-xl font-black">{resumenReaccionesAuditoria.totalUtil}</p></div>
              <div className={`rounded-2xl border p-3 ${darkMode ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-white'}`}><p className="text-[10px] uppercase tracking-wider font-black text-slate-500">Importante</p><p className="text-xl font-black">{resumenReaccionesAuditoria.totalImportante}</p></div>
              <div className={`rounded-2xl border p-3 ${darkMode ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-white'}`}><p className="text-[10px] uppercase tracking-wider font-black text-slate-500">Me gusta</p><p className="text-xl font-black">{resumenReaccionesAuditoria.totalMeGusta}</p></div>
            </div>
          </section>

          <section className={`rounded-[24px] border p-4 transition-all duration-300 ${darkMode ? 'bg-slate-900 border-slate-800 shadow-xl shadow-black/20' : 'bg-white border-gray-100 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.35)]'}`}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className={`text-sm sm:text-base font-black ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Top 5 comunicados mas reaccionados</h2>
            </div>
            {topComunicadosReaccionados.length === 0 ? (
              <p className={`text-xs font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Aun no hay reacciones registradas.</p>
            ) : (
              <div className="space-y-2">
                {topComunicadosReaccionados.map((item, idx) => (
                  <article key={`top-${item.id}-${idx}`} className={`rounded-2xl border p-3 flex items-center justify-between gap-3 transition-all duration-300 ${darkMode ? 'border-slate-700 bg-slate-800/70 hover:bg-slate-800' : 'border-slate-200 bg-slate-50/70 hover:bg-white hover:shadow-sm'}`}>
                    <div className="min-w-0">
                      <p className={`text-xs font-black ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>#{idx + 1} {item.titulo}</p>
                      <p className={`text-[11px] mt-1 font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>U:{item.util} - I:{item.importante} - MG:{item.meGusta}</p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${darkMode ? 'bg-green-900/30 text-green-200 border border-green-700' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                      {item.total} reacciones
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
          </div>
      </main>
      </div>
    </div>
  );
}

export default ReportesPanel;

