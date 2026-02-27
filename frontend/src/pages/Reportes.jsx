import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import logoSaciar from '../assets/logo_saciar.png';
import { apiUrl } from '../config/api';

function Reportes() {
  const [reporte, setReporte] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [formatoExportacion, setFormatoExportacion] = useState('excel');
  const [vistaAuditoria, setVistaAuditoria] = useState('categorias');
  const [categoriasAbiertas, setCategoriasAbiertas] = useState({});
  const [mesCalendario, setMesCalendario] = useState(() => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  });
  const [fechaCalendarioSeleccionada, setFechaCalendarioSeleccionada] = useState('');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
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
      // MySQL DATETIME suele venir sin zona; se interpreta como UTC para evitar desfase.
      return new Date(sinZona.test(limpio) ? `${limpio}Z` : limpio);
    }
    return new Date(fecha);
  };

  const formatearFechaLectura = (fecha) => {
    const d = parseFechaLectura(fecha);
    if (Number.isNaN(d.getTime())) return '-';
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

  const obtenerReporte = async () => {
    try {
      const res = await axios.get(apiUrl('/api/reportes'));
      setReporte(res.data);
    } catch (error) {
      console.error('Error al cargar reporte', error);
    }
  };

  useEffect(() => {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (usuario?.rol !== 'admin') {
      navigate('/dashboard');
      return;
    }
    const timerId = window.setTimeout(() => {
      void obtenerReporte();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [navigate]);

  const datosFiltrados = useMemo(() => {
    const t = filtro.toLowerCase().trim();
    return reporte.filter((reg) =>
      (reg.empleado || '').toLowerCase().includes(t) ||
      (reg.publicacion || '').toLowerCase().includes(t) ||
      (reg.area || '').toLowerCase().includes(t)
    );
  }, [reporte, filtro]);

  const datosAgrupadosPorCategoria = useMemo(() => {
    const grupos = datosFiltrados.reduce((acc, reg) => {
      const categoria = (reg.area || 'Sin area').trim() || 'Sin area';
      if (!acc[categoria]) acc[categoria] = [];
      acc[categoria].push(reg);
      return acc;
    }, {});

    return Object.entries(grupos)
      .sort((a, b) => a[0].localeCompare(b[0], 'es', { sensitivity: 'base' }))
      .map(([categoria, registros]) => ({ categoria, registros }));
  }, [datosFiltrados]);

  const conteoPorFecha = useMemo(() => {
    const acc = {};
    datosFiltrados.forEach((reg) => {
      const d = parseFechaLectura(reg.fecha_lectura_local || reg.fecha_lectura);
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
    const primerDiaSemana = primerDia.getDay(); // 0-domingo
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

  const publicacionesPorFechaSeleccionada = useMemo(() => {
    if (!fechaCalendarioSeleccionada) return [];
    return datosFiltrados.filter((reg) => {
      const d = parseFechaLectura(reg.fecha_lectura_local || reg.fecha_lectura);
      if (!d || Number.isNaN(d.getTime())) return false;
      return toLocalYmd(d) === fechaCalendarioSeleccionada;
    });
  }, [datosFiltrados, fechaCalendarioSeleccionada]);

  useEffect(() => {
    setCategoriasAbiertas((prev) => {
      const next = { ...prev };
      datosAgrupadosPorCategoria.forEach(({ categoria }) => {
        if (typeof next[categoria] === 'undefined') {
          next[categoria] = true;
        }
      });
      return next;
    });
  }, [datosAgrupadosPorCategoria]);

  const toggleCategoria = (categoria) => {
    setCategoriasAbiertas((prev) => ({ ...prev, [categoria]: !prev[categoria] }));
  };

  const descargarArchivo = (contenido, tipo, extension) => {
    const blob = new Blob([contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fechaBase = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `Reporte_SST_SACIAR_${fechaBase}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const escaparHtml = (texto) => {
    return String(texto ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const construirTablaHtml = (datos) => {
    const filas = datos.map((r) => `
      <tr>
        <td>${escaparHtml(r.comunicado)}</td>
        <td>${escaparHtml(r.empleado)}</td>
        <td>${escaparHtml(r.area)}</td>
        <td>${escaparHtml(r.fecha_confirmacion)}</td>
      </tr>
    `).join('');

    return `
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse; width:100%; font-family:Arial, sans-serif; font-size:12px;">
        <thead>
          <tr style="background:#0f172a; color:#fff;">
            <th>Comunicado</th>
            <th>Empleado</th>
            <th>Area</th>
            <th>Fecha de Confirmacion</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    `;
  };

  const abrirVistaImpresionPdf = (tablaHtml) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Reporte Auditoria</title>
      </head>
      <body style="font-family:Arial, sans-serif; padding:24px;">
        <h2>Reporte de Auditoria de Lectura</h2>
        <p>Generado: ${escaparHtml(new Date().toLocaleString('es-CO'))}</p>
        ${tablaHtml}
      </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  const exportarInformacion = () => {
    if (datosFiltrados.length === 0) return;

    const normalizados = datosFiltrados.map((reg) => ({
      comunicado: reg.publicacion || '',
      empleado: reg.empleado || '',
      area: reg.area || '',
      fecha_confirmacion: formatearFechaLectura(reg.fecha_lectura_local || reg.fecha_lectura)
    }));

    const tablaHtml = construirTablaHtml(normalizados);

    if (formatoExportacion === 'word') {
      const docHtml = `
        <html>
        <head><meta charset="UTF-8"></head>
        <body>
          <h2>Reporte de Auditoria de Lectura</h2>
          ${tablaHtml}
        </body>
        </html>
      `;
      descargarArchivo(docHtml, 'application/msword;charset=utf-8', 'doc');
      return;
    }

    if (formatoExportacion === 'pdf') {
      abrirVistaImpresionPdf(tablaHtml);
      return;
    }

    const excelHtml = `
      <html>
      <head><meta charset="UTF-8"></head>
      <body>${tablaHtml}</body>
      </html>
    `;
    descargarArchivo(excelHtml, 'application/vnd.ms-excel;charset=utf-8', 'xls');
  };

  const eliminarReporte = async (id) => {
    const confirmado = window.confirm('Seguro que deseas eliminar este registro de auditoria?');
    if (!confirmado) return;

    try {
      await axios.delete(apiUrl(`/api/reportes/${id}`));
      setReporte((prev) => prev.filter((item) => item.id !== id));
      toast.success('Registro eliminado');
    } catch (error) {
      const msg = error.response?.data?.message || 'No fue posible eliminar el registro';
      toast.error(msg);
    }
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
  const irAHoyCalendario = () => {
    const hoy = new Date();
    setMesCalendario(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
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
    setFechaCalendarioSeleccionada(ymd);
  };
  const cambiarMesCalendario = (delta) => {
    setMesCalendario((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };
  const etiquetaMesCalendario = new Intl.DateTimeFormat('es-CO', {
    month: 'long'
  }).format(mesCalendario);

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
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
            Auditoria de Lectura
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
                  className="w-full text-left px-3 py-2.5 rounded-xl border border-green-300 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold text-sm hover:brightness-105 transition-all flex items-center gap-2 shadow-sm"
                >
                  <span className="w-5 h-5 rounded-md bg-white/25 flex items-center justify-center">
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
              <button onClick={() => navigate('/registro-personal')} className={`w-10 h-10 rounded-xl border transition flex items-center justify-center ${
                darkMode ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'
              }`} title="Empleados">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5.121 17.804A9 9 0 1118.88 17.8M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </button>
              <button onClick={() => navigate('/reportes')} className="w-10 h-10 rounded-xl border border-green-300 bg-gradient-to-r from-green-600 to-green-700 text-white hover:brightness-105 transition shadow-sm flex items-center justify-center" title="Auditoria">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 3v18h18M7 14l3-3 3 2 4-5"></path>
                </svg>
              </button>
            </div>
          )}
        </aside>

      <main className={`flex-1 p-4 sm:p-6 lg:p-12 w-full ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-72'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="lg:hidden grid grid-cols-3 gap-2 mb-4">
          <button onClick={() => navigate('/admin')} className={`px-2 py-2.5 rounded-xl text-[11px] font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
            Crear
          </button>
          <button onClick={() => navigate('/registro-personal')} className={`px-2 py-2.5 rounded-xl text-[11px] font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
            Empleados
          </button>
          <button onClick={() => navigate('/reportes')} className="px-2 py-2.5 rounded-xl bg-green-600 text-white text-[11px] font-black">
            Auditoria
          </button>
        </div>

        <div className="flex flex-col 2xl:flex-row justify-between items-start 2xl:items-center mb-6 sm:mb-10 gap-4 sm:gap-6">
          <div className="min-w-0">
            <h1 className={`text-2xl sm:text-4xl 2xl:text-[2.8rem] leading-[1] font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-800'}`}>Auditoria de Lectura</h1>
            <p className={`${darkMode ? 'text-slate-400' : 'text-gray-500'} font-medium`}>Historico de lecturas por cominicado</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_160px_auto] gap-3 w-full 2xl:w-auto 2xl:min-w-[620px]">
            <div className="relative w-full min-w-0">
              <svg className={`w-5 h-5 absolute left-3 top-3 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <input
                type="text"
                placeholder="Buscar por empleado, area o comunicado..."
                className={`w-full pl-10 pr-4 py-3 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-green-500 font-medium ${
                  darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-gray-200 shadow-sm'
                }`}
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>

            <select
              value={formatoExportacion}
              onChange={(e) => setFormatoExportacion(e.target.value)}
              className={`w-full px-4 py-3 rounded-2xl border font-semibold text-sm ${
                darkMode ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-gray-200 bg-white'
              }`}
            >
              <option value="excel">Excel (.xls)</option>
              <option value="word">Word (.doc)</option>
              <option value="pdf">PDF (Imprimir)</option>
            </select>

            <button
              onClick={exportarInformacion}
              disabled={datosFiltrados.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-6 py-3 rounded-2xl font-bold shadow-lg  flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
              </svg>
              Exportar
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setVistaAuditoria('categorias')}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition ${
              vistaAuditoria === 'categorias'
                ? 'bg-green-600 text-white border-green-600'
                : darkMode
                  ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                  : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'
            }`}
          >
            Por categorias
          </button>
          <button
            type="button"
            onClick={() => setVistaAuditoria('lista')}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition ${
              vistaAuditoria === 'lista'
                ? 'bg-green-600 text-white border-green-600'
                : darkMode
                  ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                  : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'
            }`}
          >
            Vista general
          </button>
          <span className={`text-xs font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {datosFiltrados.length} registro(s) en {datosAgrupadosPorCategoria.length} categoria(s)
          </span>
        </div>

        <section className={`mb-6 rounded-2xl border p-4 sm:p-5 ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100 shadow-sm'
        }`}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className={`text-sm sm:text-base font-black ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Calendario de actividad</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => cambiarMesCalendario(-1)}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
                  darkMode ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-gray-200 bg-white text-slate-700'
                }`}
                title="Mes anterior"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                </svg>
              </button>
              <span className={`text-xs sm:text-sm font-black capitalize ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{etiquetaMesCalendario}</span>
              <button
                type="button"
                onClick={() => cambiarMesCalendario(1)}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
                  darkMode ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-gray-200 bg-white text-slate-700'
                }`}
                title="Mes siguiente"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </button>
            </div>
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
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center mb-2">
            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
              <span key={`${d}-${i}`} className={`text-[10px] font-black uppercase ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {diasCalendario.map((celda, idx) => (
              <div key={`cal-${idx}`} className="min-h-[44px]">
                {celda ? (
                  <button
                    type="button"
                    onClick={() => setFechaCalendarioSeleccionada(celda.ymd)}
                    className={`w-full h-full rounded-lg border p-1.5 text-left transition ${
                      fechaCalendarioSeleccionada === celda.ymd
                        ? 'bg-green-600 border-green-600 text-white'
                        : darkMode
                          ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                          : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black">{celda.dia}</span>
                      {celda.count > 0 && (
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          fechaCalendarioSeleccionada === celda.ymd ? 'bg-white/20 text-white' : darkMode ? 'bg-green-900/40 text-green-200' : 'bg-green-100 text-green-700'
                        }`}>
                          {celda.count}
                        </span>
                      )}
                    </div>
                  </button>
                ) : (
                  <div className="w-full h-full"></div>
                )}
              </div>
            ))}
          </div>

          <div className={`mt-4 rounded-xl border p-3 ${
            darkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50/70'
          }`}>
            {!fechaCalendarioSeleccionada ? (
              <p className={`text-xs font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Selecciona un dia para ver publicaciones registradas en auditoria.</p>
            ) : publicacionesPorFechaSeleccionada.length === 0 ? (
              <p className={`text-xs font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>No hay registros para la fecha seleccionada.</p>
            ) : (
              <div className="space-y-2">
                <p className={`text-xs font-black uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  {publicacionesPorFechaSeleccionada.length} registro(s) el {fechaCalendarioSeleccionada}
                </p>
                <div className="flex flex-wrap gap-2">
                  {publicacionesPorFechaSeleccionada.slice(0, 12).map((reg, idx) => (
                    <span key={`pub-dia-${idx}`} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                      darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-200 bg-white text-slate-700'
                    }`}>
                      {reg.publicacion}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <div className={`rounded-[1.5rem] sm:rounded-[2.5rem] shadow-xl border overflow-hidden ${
          darkMode ? 'bg-slate-900 border-slate-800 shadow-black/30' : 'bg-white border-gray-100 shadow-slate-200/60'
        }`}>
          <div className="md:hidden p-3 space-y-3">
            {datosFiltrados.length > 0 ? (
              vistaAuditoria === 'categorias' ? (
                datosAgrupadosPorCategoria.map((grupo) => (
                  <section key={`mobile-group-${grupo.categoria}`} className={`rounded-2xl border p-3 ${
                    darkMode ? 'border-slate-700 bg-slate-900/60' : 'border-green-100 bg-green-50/40'
                  }`}>
                    <button
                      type="button"
                      onClick={() => toggleCategoria(grupo.categoria)}
                      className="w-full mb-2 flex items-center justify-between gap-2 text-left"
                    >
                      <h3 className={`text-sm font-black ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{grupo.categoria}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${
                          darkMode ? 'border-green-700 bg-green-900/30 text-green-200' : 'border-green-200 bg-white text-green-700'
                        }`}>
                          {grupo.registros.length} registro(s)
                        </span>
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border ${
                          darkMode ? 'border-slate-600 bg-slate-800 text-slate-200' : 'border-green-200 bg-white text-green-700'
                        }`}>
                          <svg className={`w-4 h-4 transition-transform ${categoriasAbiertas[grupo.categoria] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                          </svg>
                        </span>
                      </div>
                    </button>

                    {categoriasAbiertas[grupo.categoria] && (
                      <div className="space-y-2">
                        {grupo.registros.map((reg, index) => (
                          <article key={`mobile-${grupo.categoria}-${index}`} className={`rounded-2xl border p-4 ${
                            darkMode ? 'border-slate-700 bg-slate-800/70' : 'border-gray-200 bg-white'
                          }`}>
                            <p className={`font-bold text-sm leading-tight ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{reg.publicacion}</p>
                            <div className="mt-2">
                              <p className={`font-bold text-sm ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{reg.empleado || 'Nombre no registrado'}</p>
                              <p className={`text-[10px] font-black uppercase tracking-tighter ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>ID registro: SAC-{(reg.id || index) + 100}</p>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase border ${
                                darkMode ? 'bg-slate-900 text-slate-300 border-slate-700' : 'bg-white text-slate-600 border-slate-200'
                              }`}>
                                {reg.area}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[11px] font-mono text-right ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {formatearFechaLectura(reg.fecha_lectura_local || reg.fecha_lectura)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => eliminarReporte(reg.id)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${
                                    darkMode ? 'border-red-800 bg-slate-900 text-red-300' : 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                                  }`}
                                >
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                ))
              ) : (
                datosFiltrados.map((reg, index) => (
                  <article key={`mobile-${index}`} className={`rounded-2xl border p-4 ${
                    darkMode ? 'border-slate-700 bg-slate-800/70' : 'border-gray-200 bg-gray-50/70'
                  }`}>
                    <p className={`font-bold text-sm leading-tight ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{reg.publicacion}</p>
                    <div className="mt-2">
                      <p className={`font-bold text-sm ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{reg.empleado || 'Nombre no registrado'}</p>
                      <p className={`text-[10px] font-black uppercase tracking-tighter ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>ID registro: SAC-{(reg.id || index) + 100}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase border ${
                        darkMode ? 'bg-slate-900 text-slate-300 border-slate-700' : 'bg-white text-slate-600 border-slate-200'
                      }`}>
                        {reg.area}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-mono text-right ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {formatearFechaLectura(reg.fecha_lectura_local || reg.fecha_lectura)}
                        </span>
                        <button
                          type="button"
                          onClick={() => eliminarReporte(reg.id)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${
                            darkMode ? 'border-red-800 bg-slate-900 text-red-300' : 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                          }`}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )
            ) : (
              <div className="py-16 text-center">
                <p className="text-gray-400 font-bold italic tracking-tight">No hay evidencias registradas con ese filtro.</p>
              </div>
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            {datosFiltrados.length > 0 ? (
              vistaAuditoria === 'categorias' ? (
                <div className="p-4 space-y-4">
                  {datosAgrupadosPorCategoria.map((grupo) => (
                    <section key={`desktop-group-${grupo.categoria}`} className={`rounded-2xl border overflow-hidden ${
                      darkMode ? 'border-slate-700 bg-slate-900/60' : 'border-green-100 bg-white'
                    }`}>
                      <button
                        type="button"
                        onClick={() => toggleCategoria(grupo.categoria)}
                        className={`w-full px-6 py-3 flex items-center justify-between border-b text-left ${
                          darkMode ? 'border-slate-700 bg-slate-800/70' : 'border-green-100 bg-green-50/70'
                        }`}
                      >
                        <h3 className={`font-black ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{grupo.categoria}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase border ${
                            darkMode ? 'border-green-700 bg-green-900/30 text-green-200' : 'border-green-200 bg-white text-green-700'
                          }`}>
                            {grupo.registros.length} registro(s)
                          </span>
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border ${
                            darkMode ? 'border-slate-600 bg-slate-800 text-slate-200' : 'border-green-200 bg-white text-green-700'
                          }`}>
                            <svg className={`w-4 h-4 transition-transform ${categoriasAbiertas[grupo.categoria] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                          </span>
                        </div>
                      </button>

                      {categoriasAbiertas[grupo.categoria] && (
                        <table className="w-full text-left">
                          <thead>
                            <tr className={darkMode ? 'bg-green-700/90 text-white' : 'bg-green-600 text-white'}>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em]">Comunicado</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em]">Empleado</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em]">Area</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-right">Fecha de Confirmacion</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className={darkMode ? 'divide-y divide-slate-800' : 'divide-y divide-gray-100'}>
                            {grupo.registros.map((reg, index) => (
                              <tr key={`${grupo.categoria}-${index}`} className={`transition-colors group ${darkMode ? 'hover:bg-slate-800/70' : 'hover:bg-green-50/40'}`}>
                                <td className="px-6 py-4">
                                  <p className={`font-bold text-sm leading-tight ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{reg.publicacion}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <p className={`font-bold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{reg.empleado || 'Nombre no registrado'}</p>
                                  <p className={`text-[10px] font-black uppercase tracking-tighter ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>ID registro: SAC-{(reg.id || index) + 100}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase border ${
                                    darkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}>
                                    {reg.area}
                                  </span>
                                </td>
                                <td className={`px-6 py-4 text-right font-mono text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {formatearFechaLectura(reg.fecha_lectura_local || reg.fecha_lectura)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => eliminarReporte(reg.id)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border ${
                                      darkMode ? 'border-red-800 bg-slate-900 text-red-300' : 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                                    }`}
                                  >
                                    Eliminar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </section>
                  ))}
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className={darkMode ? 'bg-green-700 text-white' : 'bg-green-600 text-white'}>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em]">Comunicado</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em]">Empleado</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em]">Area</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-right">Fecha de Confirmacion</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className={darkMode ? 'divide-y divide-slate-800' : 'divide-y divide-gray-100'}>
                    {datosFiltrados.map((reg, index) => (
                      <tr key={index} className={`transition-colors group ${darkMode ? 'hover:bg-slate-800/70' : 'hover:bg-green-50/40'}`}>
                        <td className="px-8 py-5">
                          <p className={`font-bold text-sm leading-tight ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{reg.publicacion}</p>
                        </td>
                        <td className="px-8 py-5">
                          <p className={`font-bold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{reg.empleado || 'Nombre no registrado'}</p>
                          <p className={`text-[10px] font-black uppercase tracking-tighter ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>ID registro: SAC-{(reg.id || index) + 100}</p>
                        </td>
                        <td className="px-8 py-5">
                          <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase border ${
                            darkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {reg.area}
                          </span>
                        </td>
                        <td className={`px-8 py-5 text-right font-mono text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {formatearFechaLectura(reg.fecha_lectura_local || reg.fecha_lectura)}
                        </td>
                        <td className="px-8 py-5 text-right">
                          <button
                            type="button"
                            onClick={() => eliminarReporte(reg.id)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border ${
                              darkMode ? 'border-red-800 bg-slate-900 text-red-300' : 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                            }`}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              <div className="py-24 text-center">
                <p className="text-gray-400 font-bold italic tracking-tight">No hay evidencias registradas con ese filtro.</p>
              </div>
            )}
          </div>
        </div>
        </div>
      </main>
      </div>
    </div>
  );
}

export default Reportes;
