import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import logoSaciar from '../assets/logo_saciar.png';
import { apiUrl, setAuthToken } from '../config/api';
import useSmartBack from '../hooks/useSmartBack';

const SEARCH_KEY_REPORTES = 'reportes_search_history_v1';
const REPORTES_SEARCH_SCOPES = [
  { key: 'comunicado', label: 'Comunicado' },
  { key: 'empleado', label: 'Empleado' },
  { key: 'area', label: 'Area' },
  { key: 'categoria', label: 'Categoria' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'reacciones', label: 'Reacciones' }
];
const REPORTES_SUGERENCIAS_BASE = ['reconfirmacion', 'confirmacion', 'sst', 'calidad', 'importante', 'util'];

const normalizarTexto = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const escaparRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  const [searchScopes, setSearchScopes] = useState({
    comunicado: true,
    empleado: true,
    area: true,
    categoria: true,
    tipo: true,
    reacciones: true
  });
  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(SEARCH_KEY_REPORTES) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const navigate = useNavigate();
  const goBack = useSmartBack('/dashboard');
  const usuarioActual = JSON.parse(localStorage.getItem('usuario'));
  const forzarReingreso = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setAuthToken(null);
    toast.error('Sesion invalida. Ingresa nuevamente.', { id: 'reportes-auth' });
    navigate('/', { replace: true });
  };

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
      // MySQL DATETIME suele venir sin zona; se interpreta como UTC para convertirlo
      // correctamente al reloj local del dispositivo al formatear.
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

  const resumenReaccionesTexto = (reg) => {
    const util = Number(reg.reaccion_util || 0);
    const importante = Number(reg.reaccion_importante || 0);
    const meGusta = Number(reg.reaccion_me_gusta || 0);
    const total = Number(reg.total_reacciones || 0);
    if (total <= 0) return 'Sin reacciones';
    return `${total} total · U:${util} I:${importante} MG:${meGusta}`;
  };

  const reaccionUsuarioTexto = (reg) => {
    const key = String(reg.reaccion_usuario || '').toLowerCase();
    if (key === 'util') return 'Util';
    if (key === 'importante') return 'Importante';
    if (key === 'me-gusta') return 'Me gusta';
    return 'Sin reaccion';
  };

  const desglosarReacciones = (reg) => ({
    total: Number(reg.total_reacciones || 0),
    util: Number(reg.reaccion_util || 0),
    importante: Number(reg.reaccion_importante || 0),
    meGusta: Number(reg.reaccion_me_gusta || 0)
  });

  const registrarBusqueda = (value) => {
    const term = String(value || '').trim();
    if (!term) return;
    setSearchHistory((prev) => {
      const next = [term, ...prev.filter((item) => normalizarTexto(item) !== normalizarTexto(term))].slice(0, 8);
      localStorage.setItem(SEARCH_KEY_REPORTES, JSON.stringify(next));
      return next;
    });
  };

  const obtenerReporte = async () => {
    try {
      const res = await axios.get(apiUrl('/api/reportes'));
      setReporte(res.data);
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        forzarReingreso();
        return;
      }
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
    const term = normalizarTexto(filtro);
    const tokens = term.split(/\s+/).filter(Boolean);
    const enabledScopes = Object.entries(searchScopes)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key);
    const scopes = enabledScopes.length ? enabledScopes : REPORTES_SEARCH_SCOPES.map((s) => s.key);

    const list = reporte
      .map((reg, idx) => {
        if (!tokens.length) return { reg, idx, score: 0, allMatch: true };
        const fields = {
          comunicado: normalizarTexto(reg.publicacion),
          empleado: normalizarTexto(reg.empleado),
          area: normalizarTexto(reg.area),
          categoria: normalizarTexto(reg.categoria_auditoria),
          tipo: normalizarTexto(reg.tipo_confirmacion === 'reconfirmacion' ? 'reconfirmacion' : 'confirmacion inicial'),
          reacciones: normalizarTexto(reaccionUsuarioTexto(reg))
        };

        let score = 0;
        const allMatch = tokens.every((tk) => {
          let matched = false;
          scopes.forEach((scope) => {
            const value = fields[scope] || '';
            if (value.includes(tk)) {
              matched = true;
              if (scope === 'comunicado') score += 6;
              if (scope === 'empleado') score += 5;
              if (scope === 'area') score += 4;
              if (scope === 'categoria') score += 3;
              if (scope === 'tipo') score += 2;
              if (scope === 'reacciones') score += 1;
            }
          });
          return matched;
        });

        return { reg, idx, score, allMatch };
      })
      .filter((item) => item.allMatch)
      .sort((a, b) => (b.score - a.score) || (a.idx - b.idx))
      .map((item) => item.reg);

    return list;
  }, [reporte, filtro, searchScopes]);

  const sugerenciasBusqueda = useMemo(() => {
    const term = normalizarTexto(filtro);
    const pool = [...searchHistory, ...REPORTES_SUGERENCIAS_BASE];
    const unique = Array.from(new Map(pool.map((item) => [normalizarTexto(item), item])).values());
    return unique
      .filter((item) => !term || normalizarTexto(item).includes(term))
      .slice(0, 6);
  }, [searchHistory, filtro]);

  const highlightText = (text) => {
    const raw = String(text || '');
    const query = String(filtro || '').trim();
    if (!query) return raw;
    const tokens = Array.from(new Set(query.split(/\s+/).filter(Boolean).map((t) => escaparRegExp(t))));
    if (!tokens.length) return raw;
    const regex = new RegExp(`(${tokens.join('|')})`, 'gi');
    const parts = raw.split(regex);
    return parts.map((part, i) => {
      const isMatch = tokens.some((tk) => new RegExp(`^${tk}$`, 'i').test(part));
      return isMatch
        ? (
          <mark key={`${part}-${i}`} className={`px-0.5 rounded ${darkMode ? 'bg-emerald-500/30 text-emerald-100' : 'bg-emerald-100 text-emerald-900'}`}>
            {part}
          </mark>
        )
        : <span key={`${part}-${i}`}>{part}</span>;
    });
  };

  const datosAgrupadosPorCategoria = useMemo(() => {
    const grupos = datosFiltrados.reduce((acc, reg) => {
      const categoria = (reg.categoria_auditoria || 'Confirmaciones iniciales').trim() || 'Confirmaciones iniciales';
      if (!acc[categoria]) acc[categoria] = [];
      acc[categoria].push(reg);
      return acc;
    }, {});

    const orden = { 'Confirmaciones iniciales': 1, Reconfirmaciones: 2 };
    return Object.entries(grupos)
      .sort((a, b) => (orden[a[0]] || 99) - (orden[b[0]] || 99))
      .map(([categoria, registros]) => ({ categoria, registros }));
  }, [datosFiltrados]);
  const totalReconfirmaciones = useMemo(
    () => datosFiltrados.filter((reg) => (reg.tipo_confirmacion || '').toLowerCase() === 'reconfirmacion').length,
    [datosFiltrados]
  );

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
    const totalReacciones = values.reduce((acc, v) => acc + v.total, 0);
    const totalUtil = values.reduce((acc, v) => acc + v.util, 0);
    const totalImportante = values.reduce((acc, v) => acc + v.importante, 0);
    const totalMeGusta = values.reduce((acc, v) => acc + v.meGusta, 0);
    return {
      comunicadosConReacciones: values.filter((v) => v.total > 0).length,
      totalReacciones,
      totalUtil,
      totalImportante,
      totalMeGusta
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
      const next = {
        ...prev,
        titulo: reg.publicacion || prev.titulo,
        total: Math.max(prev.total, Number(reg.total_reacciones || 0)),
        util: Math.max(prev.util, Number(reg.reaccion_util || 0)),
        importante: Math.max(prev.importante, Number(reg.reaccion_importante || 0)),
        meGusta: Math.max(prev.meGusta, Number(reg.reaccion_me_gusta || 0))
      };
      map.set(key, next);
    });
    return Array.from(map.values())
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total || a.titulo.localeCompare(b.titulo))
      .slice(0, 5);
  }, [datosFiltrados]);

  const notificacionesOperativas = useMemo(() => {
    const list = [];
    const hoy = toLocalYmd(new Date());
    const confirmacionesHoy = datosFiltrados.filter((reg) => {
      const d = parseFechaLectura(reg.fecha_lectura);
      if (!d || Number.isNaN(d.getTime())) return false;
      return toLocalYmd(d) === hoy;
    }).length;

    const reconfirmaciones = datosFiltrados.filter((reg) => (
      (reg.tipo_confirmacion || '').toLowerCase() === 'reconfirmacion'
    )).length;

    if (confirmacionesHoy > 0) {
      list.push({
        id: 'hoy',
        titulo: 'Actividad del dia',
        detalle: `${confirmacionesHoy} confirmacion(es) registradas hoy.`,
        nivel: 'ok'
      });
    }

    if (reconfirmaciones > 0) {
      list.push({
        id: 'reconfirmaciones',
        titulo: 'Reconfirmaciones activas',
        detalle: `${reconfirmaciones} registro(s) de reconfirmacion en auditoria.`,
        nivel: 'warn'
      });
    }

    if (resumenReaccionesAuditoria.totalReacciones === 0 && datosFiltrados.length > 0) {
      list.push({
        id: 'sin-reacciones',
        titulo: 'Sin reaccion del personal',
        detalle: 'Aun no hay reacciones registradas en los comunicados auditados.',
        nivel: 'info'
      });
    }

    if (topComunicadosReaccionados.length > 0) {
      const top = topComunicadosReaccionados[0];
      list.push({
        id: 'top',
        titulo: 'Comunicado mas comentado',
        detalle: `"${top.titulo}" lidera con ${top.total} reaccion(es).`,
        nivel: 'ok'
      });
    }

    if (list.length === 0) {
      list.push({
        id: 'sin-alertas',
        titulo: 'Sin alertas operativas',
        detalle: 'La auditoria no presenta eventos pendientes en este momento.',
        nivel: 'info'
      });
    }

    return list.slice(0, 4);
  }, [datosFiltrados, resumenReaccionesAuditoria.totalReacciones, topComunicadosReaccionados]);

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
      const d = parseFechaLectura(reg.fecha_lectura);
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
        <td>${escaparHtml(r.reacciones)}</td>
        <td>${escaparHtml(r.tipo_confirmacion)}</td>
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
            <th>Reacciones</th>
            <th>Tipo</th>
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
      reacciones: reaccionUsuarioTexto(reg),
      tipo_confirmacion: reg.tipo_confirmacion === 'reconfirmacion' ? 'Reconfirmacion' : 'Confirmacion inicial',
      fecha_confirmacion: formatearFechaLectura(reg.fecha_lectura)
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

  const eliminarReporte = async (id) => {
    const confirmado = await confirmarAccion('Seguro que deseas eliminar este registro de auditoria?');
    if (!confirmado) return;

    try {
      await axios.delete(apiUrl(`/api/reportes/${id}`));
      setReporte((prev) => prev.filter((item) => item.id !== id));
      toast.success('Registro eliminado');
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        forzarReingreso();
        return;
      }
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
          <div className={`text-right border-r pr-2 sm:pr-4 min-w-0 ${darkMode ? 'border-slate-700' : 'border-gray-100'}`}>
            <p className="text-xs sm:text-sm font-black max-w-[140px] sm:max-w-none truncate">{usuarioActual?.nombre_completo}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest hidden sm:block">{usuarioActual?.area}</p>
          </div>
          <button
            onClick={goBack}
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
                  onClick={() => navigate('/dashboard')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border font-bold text-sm transition-all flex items-center gap-2 ${
                    darkMode
                      ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white'
                      : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center ${darkMode ? 'bg-slate-700/80' : 'bg-slate-100'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 10.5L12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5"></path>
                    </svg>
                  </span>
                  Inicio
                </button>
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
                <button
                  onClick={() => navigate('/reportes-panel')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border font-bold text-sm transition-all flex items-center gap-2 ${
                    darkMode
                      ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white'
                      : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center ${darkMode ? 'bg-slate-700/80' : 'bg-slate-100'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 19h16M7 16V9m5 7V5m5 11v-6"></path>
                    </svg>
                  </span>
                  Panel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-start pt-1 gap-2">
              <button onClick={() => navigate('/dashboard')} className={`w-10 h-10 rounded-xl border transition flex items-center justify-center ${
                darkMode ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'
              }`} title="Inicio">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 10.5L12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5"></path>
                </svg>
              </button>
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
              <button onClick={() => navigate('/reportes')} className="w-10 h-10 rounded-xl border border-green-500 bg-green-600 text-white hover:bg-green-700 transition shadow-sm flex items-center justify-center" title="Auditoria">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 3v18h18M7 14l3-3 3 2 4-5"></path>
                </svg>
              </button>
              <button onClick={() => navigate('/reportes-panel')} className={`w-10 h-10 rounded-xl border transition flex items-center justify-center ${
                darkMode ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'
              }`} title="Panel analitico">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 19h16M7 16V9m5 7V5m5 11v-6"></path>
                </svg>
              </button>
            </div>
          )}
        </aside>

      <main className={`flex-1 min-w-0 p-4 sm:p-6 md:p-10 ${sidebarCollapsed ? 'lg:ml-16 lg:w-[calc(100%-4rem)]' : 'lg:ml-72 lg:w-[calc(100%-18rem)]'}`}>
        <div className="max-w-6xl mx-auto">
        <div className={`lg:hidden mb-4 rounded-2xl border p-2 overflow-x-auto sidebar-scroll ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-center gap-2 min-w-max">
            <button onClick={() => navigate('/dashboard')} className={`px-3 py-2 rounded-xl text-[11px] font-black border whitespace-nowrap ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
              Inicio
            </button>
            <button onClick={() => navigate('/admin')} className={`px-3 py-2 rounded-xl text-[11px] font-black border whitespace-nowrap ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
              Crear
            </button>
            <button onClick={() => navigate('/registro-personal')} className={`px-3 py-2 rounded-xl text-[11px] font-black border whitespace-nowrap ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
              Empleados
            </button>
            <button onClick={() => navigate('/reportes')} className="px-3 py-2 rounded-xl bg-green-600 text-white text-[11px] font-black whitespace-nowrap">
              Auditoria
            </button>
            <button onClick={() => navigate('/reportes-panel')} className={`px-3 py-2 rounded-xl text-[11px] font-black border whitespace-nowrap ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
              Panel
            </button>
          </div>
        </div>

        <section className={`mb-4 rounded-[2rem] border p-6 md:p-8 text-white shadow-xl min-h-[170px] ${
          darkMode
            ? 'border-green-900 bg-gradient-to-r from-green-700 to-green-800'
            : 'border-green-200 bg-gradient-to-r from-green-600 to-green-700'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-green-100 font-bold mb-2">Control de auditoria</p>
              <h1 className="text-2xl md:text-4xl font-black text-white">Auditoria de Lectura</h1>
              <p className="text-green-50 font-medium mt-2">Historico de lecturas por comunicado</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:min-w-[350px]">
              <div className="rounded-2xl bg-white/20 border border-white/30 p-3">
                <p className="text-[10px] uppercase tracking-widest text-green-100 font-bold">Registros</p>
                <p className="text-2xl font-black">{datosFiltrados.length}</p>
              </div>
              <div className="rounded-2xl bg-white/20 border border-white/30 p-3">
                <p className="text-[10px] uppercase tracking-widest text-green-100 font-bold">Categorias</p>
                <p className="text-2xl font-black">{datosAgrupadosPorCategoria.length}</p>
              </div>
              <div className="rounded-2xl bg-white/20 border border-white/30 p-3">
                <p className="text-[10px] uppercase tracking-widest text-green-100 font-bold">Reconfirm.</p>
                <p className="text-2xl font-black">{totalReconfirmaciones}</p>
              </div>
            </div>
          </div>
        </section>

        <div className={`grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_160px_auto] gap-3 w-full rounded-2xl border p-3 mb-3 sm:mb-5 ${
            darkMode ? 'border-slate-800 bg-slate-900/50' : 'border-gray-200 bg-white/90'
          }`}>
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
                onBlur={() => registrarBusqueda(filtro)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') registrarBusqueda(filtro);
                }}
              />
              {filtro.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setFiltro('')}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg border flex items-center justify-center ${
                    darkMode
                      ? 'border-slate-700 bg-slate-800 text-slate-300 hover:border-red-500 hover:text-red-300'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-red-300 hover:text-red-600'
                  }`}
                  title="Limpiar busqueda"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M6 6l12 12M18 6l-12 12"></path>
                  </svg>
                </button>
              )}
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
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-6 py-3 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
              </svg>
              Exportar
            </button>
        </div>

        <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Busqueda inteligente por empleado, comunicado, area, categoria y tipo.
          </p>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border ${
            darkMode ? 'border-slate-700 bg-slate-900 text-slate-300' : 'border-gray-200 bg-white text-slate-600'
          }`}>
            {datosFiltrados.length} resultado(s)
          </span>
        </div>
        <div className={`rounded-[1.5rem] sm:rounded-[2.5rem] shadow-xl border overflow-hidden ${
          darkMode ? 'bg-slate-900 border-slate-800 shadow-black/30' : 'bg-white border-gray-100 shadow-slate-200/60'
        }`}>
          <div className={`px-4 sm:px-6 pt-4 pb-3 border-b ${darkMode ? 'border-slate-800 bg-slate-900/70' : 'border-gray-100 bg-white'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
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
              </div>
              <span className={`text-xs font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {datosFiltrados.length} registro(s) en {datosAgrupadosPorCategoria.length} categoria(s)
              </span>
            </div>
          </div>
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
                            <p className={`font-bold text-sm leading-tight ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{highlightText(reg.publicacion)}</p>
                            <div className="mt-2">
                              <p className={`font-bold text-sm ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{highlightText(reg.empleado || 'Nombre no registrado')}</p>
                              <p className={`text-[10px] font-black uppercase tracking-tighter ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>ID registro: SAC-{(reg.id || index) + 100}</p>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase border ${
                                  darkMode ? 'bg-slate-900 text-slate-300 border-slate-700' : 'bg-white text-slate-600 border-slate-200'
                                }`}>
                                  {highlightText(reg.area)}
                                </span>
                                <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase border ${
                                  reg.tipo_confirmacion === 'reconfirmacion'
                                    ? (darkMode ? 'bg-amber-900/30 text-amber-200 border-amber-700' : 'bg-amber-50 text-amber-700 border-amber-200')
                                    : (darkMode ? 'bg-emerald-900/30 text-emerald-200 border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                                }`}>
                                  {reg.tipo_confirmacion === 'reconfirmacion' ? 'Reconfirmacion' : 'Confirmacion inicial'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[11px] font-mono text-right ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {formatearFechaLectura(reg.fecha_lectura)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => eliminarReporte(reg.id)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border transition ${
                                    darkMode ? 'border-red-800 bg-slate-900 text-red-300 hover:bg-red-900/20' : 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                                  }`}
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M6 7h12M9 7V5h6v2m-7 3v8m4-8v8m4-8v8M8 7h8l-1 13H9L8 7z"></path>
                                  </svg>
                                  Eliminar
                                </button>
                              </div>
                            </div>
                            <p className={`mt-2 text-[11px] font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              Reaccion: {reaccionUsuarioTexto(reg)}
                            </p>
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
                    <p className={`font-bold text-sm leading-tight ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{highlightText(reg.publicacion)}</p>
                    <div className="mt-2">
                      <p className={`font-bold text-sm ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{highlightText(reg.empleado || 'Nombre no registrado')}</p>
                      <p className={`text-[10px] font-black uppercase tracking-tighter ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>ID registro: SAC-{(reg.id || index) + 100}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase border ${
                          darkMode ? 'bg-slate-900 text-slate-300 border-slate-700' : 'bg-white text-slate-600 border-slate-200'
                        }`}>
                          {highlightText(reg.area)}
                        </span>
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase border ${
                          reg.tipo_confirmacion === 'reconfirmacion'
                            ? (darkMode ? 'bg-amber-900/30 text-amber-200 border-amber-700' : 'bg-amber-50 text-amber-700 border-amber-200')
                            : (darkMode ? 'bg-emerald-900/30 text-emerald-200 border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                        }`}>
                          {reg.tipo_confirmacion === 'reconfirmacion' ? 'Reconfirmacion' : 'Confirmacion inicial'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-mono text-right ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {formatearFechaLectura(reg.fecha_lectura)}
                        </span>
                        <button
                          type="button"
                          onClick={() => eliminarReporte(reg.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border transition ${
                            darkMode ? 'border-red-800 bg-slate-900 text-red-300 hover:bg-red-900/20' : 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                          }`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M6 7h12M9 7V5h6v2m-7 3v8m4-8v8m4-8v8M8 7h8l-1 13H9L8 7z"></path>
                          </svg>
                          Eliminar
                        </button>
                      </div>
                    </div>
                    <p className={`mt-2 text-[11px] font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Reaccion: {reaccionUsuarioTexto(reg)}
                    </p>
                  </article>
                ))
              )
            ) : (
              <div className="py-16 text-center">
                <p className="text-gray-400 font-bold italic tracking-tight">No hay evidencias registradas con ese filtro.</p>
              </div>
            )}
          </div>

          <div className="hidden md:block">
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
                        <div className={`p-4 space-y-2 max-h-[60vh] xl:max-h-[66vh] 2xl:max-h-[72vh] overflow-y-auto sidebar-scroll ${darkMode ? 'sidebar-scroll-dark' : ''}`}>
                          {grupo.registros.map((reg, index) => {
                            const reaccion = reaccionUsuarioTexto(reg);
                            return (
                              <article
                                key={`${grupo.categoria}-${index}`}
                                className={`rounded-xl border p-3 sm:p-4 transition-colors ${darkMode ? 'border-slate-700 bg-slate-900 hover:bg-slate-800/80' : 'border-slate-200 bg-white hover:bg-green-50/40'}`}
                              >
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3 items-start">
                                  <div className="col-span-1 sm:col-span-2 xl:col-span-4 min-w-0">
                                    <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Comunicado</p>
                                    <p className={`font-bold text-sm leading-tight break-words [overflow-wrap:anywhere] ${darkMode ? 'text-slate-100' : 'text-slate-800'}`} title={reg.publicacion || ''}>
                                      {highlightText(reg.publicacion)}
                                    </p>
                                  </div>
                                  <div className="col-span-1 xl:col-span-3 min-w-0">
                                    <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Empleado</p>
                                    <p className={`font-bold text-sm break-words [overflow-wrap:anywhere] ${darkMode ? 'text-slate-200' : 'text-slate-700'}`} title={reg.empleado || 'Nombre no registrado'}>
                                      {highlightText(reg.empleado || 'Nombre no registrado')}
                                    </p>
                                  </div>
                                  <div className="col-span-1 xl:col-span-2">
                                    <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Area</p>
                                    <span className={`inline-flex px-3 py-1 rounded-lg text-[10px] font-black uppercase border ${darkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                      {highlightText(reg.area)}
                                    </span>
                                  </div>
                                  <div className="col-span-1 xl:col-span-1">
                                    <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tipo</p>
                                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${reg.tipo_confirmacion === 'reconfirmacion'
                                      ? (darkMode ? 'bg-amber-900/30 text-amber-200 border-amber-700' : 'bg-amber-50 text-amber-700 border-amber-200')
                                      : (darkMode ? 'bg-emerald-900/30 text-emerald-200 border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                                      }`}>
                                      {reg.tipo_confirmacion === 'reconfirmacion' ? 'Reconf.' : 'Inicial'}
                                    </span>
                                  </div>
                                  <div className="col-span-1 sm:col-span-2 xl:col-span-2 xl:text-right">
                                    <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Fecha</p>
                                    <p className={`font-mono text-[11px] ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{formatearFechaLectura(reg.fecha_lectura)}</p>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${
                                    reaccion === 'Util'
                                      ? (darkMode ? 'bg-emerald-900/30 text-emerald-200 border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                                      : reaccion === 'Importante'
                                        ? (darkMode ? 'bg-amber-900/30 text-amber-200 border-amber-700' : 'bg-amber-50 text-amber-700 border-amber-200')
                                        : reaccion === 'Me gusta'
                                          ? (darkMode ? 'bg-sky-900/30 text-sky-200 border-sky-700' : 'bg-sky-50 text-sky-700 border-sky-200')
                                          : (darkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200')
                                  }`}>
                                    Reaccion: {reaccion}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => eliminarReporte(reg.id)}
                                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition w-full sm:w-auto ${
                                      darkMode ? 'border-red-800 bg-slate-900 text-red-300 hover:bg-red-900/20' : 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                                    }`}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M6 7h12M9 7V5h6v2m-7 3v8m4-8v8m4-8v8M8 7h8l-1 13H9L8 7z"></path>
                                    </svg>
                                    Eliminar
                                  </button>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              ) : (
                <div className={`p-4 space-y-2 max-h-[64vh] xl:max-h-[70vh] 2xl:max-h-[76vh] overflow-y-auto sidebar-scroll ${darkMode ? 'sidebar-scroll-dark' : ''}`}>
                  {datosFiltrados.map((reg, index) => {
                    const reaccion = reaccionUsuarioTexto(reg);
                    return (
                      <article
                        key={`desktop-list-${index}`}
                        className={`rounded-xl border p-3 sm:p-4 transition-colors ${darkMode ? 'border-slate-700 bg-slate-900 hover:bg-slate-800/80' : 'border-slate-200 bg-white hover:bg-green-50/40'}`}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-3 items-start">
                          <div className="col-span-1 sm:col-span-2 xl:col-span-4 min-w-0">
                            <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Comunicado</p>
                            <p className={`font-bold text-sm leading-tight break-words [overflow-wrap:anywhere] ${darkMode ? 'text-slate-100' : 'text-slate-800'}`} title={reg.publicacion || ''}>
                              {highlightText(reg.publicacion)}
                            </p>
                          </div>
                          <div className="col-span-1 xl:col-span-3 min-w-0">
                            <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Empleado</p>
                            <p className={`font-bold text-sm break-words [overflow-wrap:anywhere] ${darkMode ? 'text-slate-200' : 'text-slate-700'}`} title={reg.empleado || 'Nombre no registrado'}>
                              {highlightText(reg.empleado || 'Nombre no registrado')}
                            </p>
                          </div>
                          <div className="col-span-1 xl:col-span-2">
                            <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Area</p>
                            <span className={`inline-flex px-3 py-1 rounded-lg text-[10px] font-black uppercase border ${darkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                              {highlightText(reg.area)}
                            </span>
                          </div>
                          <div className="col-span-1 xl:col-span-1">
                            <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tipo</p>
                            <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${reg.tipo_confirmacion === 'reconfirmacion'
                              ? (darkMode ? 'bg-amber-900/30 text-amber-200 border-amber-700' : 'bg-amber-50 text-amber-700 border-amber-200')
                              : (darkMode ? 'bg-emerald-900/30 text-emerald-200 border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                              }`}>
                              {reg.tipo_confirmacion === 'reconfirmacion' ? 'Reconf.' : 'Inicial'}
                            </span>
                          </div>
                          <div className="col-span-1 sm:col-span-2 xl:col-span-2 xl:text-right">
                            <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Fecha</p>
                            <p className={`font-mono text-[11px] ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{formatearFechaLectura(reg.fecha_lectura)}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${
                            reaccion === 'Util'
                              ? (darkMode ? 'bg-emerald-900/30 text-emerald-200 border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                              : reaccion === 'Importante'
                                ? (darkMode ? 'bg-amber-900/30 text-amber-200 border-amber-700' : 'bg-amber-50 text-amber-700 border-amber-200')
                                : reaccion === 'Me gusta'
                                  ? (darkMode ? 'bg-sky-900/30 text-sky-200 border-sky-700' : 'bg-sky-50 text-sky-700 border-sky-200')
                                  : (darkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200')
                          }`}>
                            Reaccion: {reaccion}
                          </span>
                          <button
                            type="button"
                            onClick={() => eliminarReporte(reg.id)}
                            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition w-full sm:w-auto ${
                              darkMode ? 'border-red-800 bg-slate-900 text-red-300 hover:bg-red-900/20' : 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M6 7h12M9 7V5h6v2m-7 3v8m4-8v8m4-8v8M8 7h8l-1 13H9L8 7z"></path>
                            </svg>
                            Eliminar
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
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



