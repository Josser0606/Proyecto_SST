import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiBell, FiCheckCircle, FiClock, FiEdit2, FiFileText, FiHeart, FiImage, FiLink2, FiStar, FiThumbsUp, FiTrash2, FiUpload, FiUser, FiX, FiZap } from 'react-icons/fi';
import logoSaciar from '../assets/logo_saciar.png';
import { apiUrl, assetUrl, setAuthToken } from '../config/api';

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

const SEARCH_KEY_DASHBOARD = 'dashboard_search_history_v1';
const DASHBOARD_SEARCH_SCOPES = [
  { key: 'titulo', label: 'Titulo' },
  { key: 'contenido', label: 'Contenido' },
  { key: 'categoria', label: 'Categoria' },
  { key: 'recursos', label: 'Archivos/Links' }
];
const DASHBOARD_SUGERENCIAS_BASE = [
  'capacitacion',
  'seguridad',
  'auditoria',
  'procedimiento',
  'sst',
  'calidad'
];

const normalizarTexto = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const escaparRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function Dashboard() {
  const [publicaciones, setPublicaciones] = useState([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [busqueda, setBusqueda] = useState('');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [searchScopes] = useState({
    titulo: true,
    contenido: true,
    categoria: true,
    recursos: true
  });
  const [, setSearchHistory] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(SEARCH_KEY_DASHBOARD) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsSeen, setNotificationsSeen] = useState({});
  const [panelAbierto, setPanelAbierto] = useState(null);
  const [soloFavoritos, setSoloFavoritos] = useState(false);
  const [comentariosPorPub, setComentariosPorPub] = useState({});
  const [comentarioDraft, setComentarioDraft] = useState({});
  const [comentariosOpen, setComentariosOpen] = useState({});
  const [cargandoComentarios, setCargandoComentarios] = useState({});
  const [miPerfil, setMiPerfil] = useState(null);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [perfilForm, setPerfilForm] = useState({ email: '', notificar_email: true });
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [formEdit, setFormEdit] = useState({
    titulo: '',
    contenido: '',
    categoria: 'SST y GH',
    imagenNueva: null,
    imagenesNuevas: [],
    archivosNuevos: [],
    recursosExistentes: [],
    linksNuevos: ['']
  });

  const usuario = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('usuario') || 'null');
    } catch {
      return null;
    }
  }, []);
  const navigate = useNavigate();
  const cargandoPublicacionesRef = useRef(false);
  const notificationPanelRef = useRef(null);
  const editSnapshotRef = useRef(null);
  const REACCIONES_DISPONIBLES = [
    { key: 'util', label: 'Util', icon: FiThumbsUp },
    { key: 'importante', label: 'Importante', icon: FiZap },
    { key: 'me-gusta', label: 'Me gusta', icon: FiHeart }
  ];

  useEffect(() => {
    if (!usuario?.id) return;
    try {
      const stored = JSON.parse(localStorage.getItem(`dashboard_notifications_seen_${usuario.id}`) || '{}');
      setNotificationsSeen(stored && typeof stored === 'object' ? stored : {});
    } catch {
      setNotificationsSeen({});
    }
  }, [usuario?.id]);

  useEffect(() => {
    if (!usuario?.id) return;
    localStorage.setItem(`dashboard_notifications_seen_${usuario.id}`, JSON.stringify(notificationsSeen));
  }, [notificationsSeen, usuario?.id]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!notificationPanelRef.current) return;
      if (!notificationPanelRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };
    if (notificationsOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [notificationsOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = totalScroll > 0 ? (window.pageYOffset / totalScroll) * 100 : 0;
      setScrollProgress(progress);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const cargarPublicaciones = useCallback(async (allowRetry = true) => {
    if (!usuario?.id || cargandoPublicacionesRef.current) return;
    cargandoPublicacionesRef.current = true;
    try {
      const res = await axios.get(apiUrl(`/api/publicaciones?usuario_id=${usuario.id}`));
      setPublicaciones(res.data);
    } catch (error) {
      const status = error?.response?.status;
      if (status === 429) {
        toast.error('Demasiadas solicitudes. Espera unos segundos.', { id: 'dashboard-rate-limit' });
      } else if (status === 401 || status === 403) {
        const token = localStorage.getItem('token');
        if (allowRetry && token) {
          setAuthToken(token);
          cargandoPublicacionesRef.current = false;
          await cargarPublicaciones(false);
          return;
        }
        toast.error('Sesion invalida. Ingresa nuevamente.', { id: 'dashboard-auth' });
      } else {
        toast.error('Error al conectar con el servidor', { id: 'dashboard-load-error' });
      }
    } finally {
      cargandoPublicacionesRef.current = false;
    }
  }, [usuario?.id]);

  useEffect(() => {
    if (!usuario) {
      navigate('/');
      return;
    }
    void cargarPublicaciones();
  }, [navigate, usuario, cargarPublicaciones]);

  const cargarPerfil = useCallback(async () => {
    try {
      const { data } = await axios.get(apiUrl('/api/me'));
      if (data?.usuario) {
        setMiPerfil(data.usuario);
        setPerfilForm({
          email: data.usuario.email || '',
          notificar_email: Number(data.usuario.notificar_email) !== 0
        });
      }
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    if (!usuario?.id) return;
    void cargarPerfil();
  }, [usuario?.id, cargarPerfil]);

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

  const tieneCambiosEdicion = useMemo(() => {
    if (!editandoId) return false;
    const snap = editSnapshotRef.current;
    if (!snap) return false;
    const normalizeLinks = (arr = []) => arr.map((l) => String(l || '').trim()).filter(Boolean);
    const currentLinks = normalizeLinks(formEdit.linksNuevos);
    const snapLinks = normalizeLinks(snap.linksNuevos);
    const linksEqual = currentLinks.length === snapLinks.length && currentLinks.every((v, i) => v === snapLinks[i]);
    const currentRecursos = [...(formEdit.recursosExistentes || [])].map((r) => Number(r.id)).sort((a, b) => a - b);
    const snapRecursos = [...(snap.recursosExistentes || [])].map((id) => Number(id)).sort((a, b) => a - b);
    const recursosEqual = currentRecursos.length === snapRecursos.length && currentRecursos.every((v, i) => v === snapRecursos[i]);

    return (
      String(formEdit.titulo || '').trim() !== String(snap.titulo || '').trim() ||
      String(formEdit.contenido || '').trim() !== String(snap.contenido || '').trim() ||
      String(formEdit.categoria || '') !== String(snap.categoria || '') ||
      Boolean(formEdit.imagenNueva) ||
      (formEdit.imagenesNuevas || []).length > 0 ||
      (formEdit.archivosNuevos || []).length > 0 ||
      !recursosEqual ||
      !linksEqual
    );
  }, [editandoId, formEdit]);

  useEffect(() => {
    if (!tieneCambiosEdicion) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [tieneCambiosEdicion]);

  const showResumen = panelAbierto === 'resumen';
  const showActividad = panelAbierto === 'actividad';
  const toggleResumen = () => setPanelAbierto((prev) => (prev === 'resumen' ? null : 'resumen'));
  const toggleActividad = () => setPanelAbierto((prev) => (prev === 'actividad' ? null : 'actividad'));

  const registrarBusqueda = useCallback((value) => {
    const term = String(value || '').trim();
    if (!term) return;
    setSearchHistory((prev) => {
      const next = [term, ...prev.filter((item) => normalizarTexto(item) !== normalizarTexto(term))].slice(0, 8);
      localStorage.setItem(SEARCH_KEY_DASHBOARD, JSON.stringify(next));
      return next;
    });
  }, []);

  const marcarComoLeido = async (pubId, esReconfirmacion = false) => {
    const loadingToast = toast.loading('Registrando lectura...');
    try {
      await axios.post(apiUrl('/api/registrar-vista'), {
        usuario_id: usuario.id,
        publicacion_id: pubId
      });
      toast.success(esReconfirmacion ? 'Lectura reconfirmada' : 'Lectura confirmada', { id: loadingToast });
      cargarPublicaciones();
    } catch (error) {
      const status = error?.response?.status;
      const msg = error?.response?.data?.message;
      if (status === 410) {
        toast.error(msg || 'El plazo para confirmar lectura ya vencio.', { id: loadingToast });
      } else {
        toast.error(msg || 'Error al registrar', { id: loadingToast });
      }
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
    ), { duration: 8000, style: { pointerEvents: 'auto' } });
  });

  const cerrarSesion = async () => {
    const confirmado = await confirmarAccion('Seguro que deseas cerrar sesion?');
    if (!confirmado) return;
    toast.dismiss();
    localStorage.clear();
    setAuthToken(null);
    toast.success('Sesion cerrada correctamente', { id: 'logout-success' });
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
    const recursosBase = (pub.recursos || []).map((r) => ({ id: r.id, tipo: r.tipo, nombre: r.nombre, url: r.url }));
    editSnapshotRef.current = {
      titulo: pub.titulo || '',
      contenido: pub.contenido || '',
      categoria: pub.categoria || 'SST y GH',
      recursosExistentes: recursosBase.map((r) => r.id),
      linksNuevos: []
    };
    setEditandoId(pub.id);
    toast('Modo edicion activado');
    setFormEdit({
      titulo: pub.titulo || '',
      contenido: pub.contenido || '',
      categoria: pub.categoria || 'SST y GH',
      imagenNueva: null,
      imagenesNuevas: [],
      archivosNuevos: [],
      recursosExistentes: recursosBase,
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

  const addImagenesNuevas = (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file?.type?.startsWith('image/'));
    if (!files.length) return;
    setFormEdit((prev) => {
      const next = [...prev.imagenesNuevas, ...files].slice(0, 15);
      return { ...prev, imagenesNuevas: next };
    });
  };

  const removeImagenNuevaAt = (idx) => {
    setFormEdit((prev) => ({ ...prev, imagenesNuevas: prev.imagenesNuevas.filter((_, i) => i !== idx) }));
  };

  const addArchivosNuevos = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setFormEdit((prev) => {
      const next = [...prev.archivosNuevos, ...files].slice(0, 20);
      return { ...prev, archivosNuevos: next };
    });
  };

  const removeArchivoNuevoAt = (idx) => {
    setFormEdit((prev) => ({ ...prev, archivosNuevos: prev.archivosNuevos.filter((_, i) => i !== idx) }));
  };

  const shortName = (name = '') => (name.length > 34 ? `${name.slice(0, 31)}...` : name);

  const toggleReaccion = async (publicacionId, actual, reactionKey) => {
    if (!usuario?.id) return;
    const nextReaction = actual === reactionKey ? null : reactionKey;
    try {
      const { data } = await axios.post(apiUrl(`/api/publicaciones/${publicacionId}/reaccion`), {
        reaccion: nextReaction
      });
      setPublicaciones((prev) => prev.map((p) => (
        p.id === publicacionId
          ? {
            ...p,
            reaccion_usuario: data?.reaccion_usuario ?? null,
            reacciones: data?.reacciones || p.reacciones
          }
          : p
      )));
    } catch (error) {
      const msg = error?.response?.data?.message || 'No fue posible registrar reaccion';
      toast.error(msg);
    }
  };

  const toggleFavorito = async (publicacionId, favoritoActual) => {
    try {
      const { data } = await axios.post(apiUrl(`/api/publicaciones/${publicacionId}/favorito`), {
        favorito: !favoritoActual
      });
      setPublicaciones((prev) => prev.map((p) => (
        p.id === publicacionId
          ? { ...p, favorito_usuario: Boolean(data?.favorito_usuario) }
          : p
      )));
      toast.success(!favoritoActual ? 'Guardado en favoritos' : 'Quitado de favoritos');
    } catch (error) {
      const msg = error?.response?.data?.message || 'No fue posible actualizar favoritos';
      toast.error(msg);
    }
  };

  const cargarComentarios = async (publicacionId, forzar = false) => {
    if (!forzar && comentariosPorPub[publicacionId]) return;
    setCargandoComentarios((prev) => ({ ...prev, [publicacionId]: true }));
    try {
      const { data } = await axios.get(apiUrl(`/api/publicaciones/${publicacionId}/comentarios?limit=20`));
      setComentariosPorPub((prev) => ({
        ...prev,
        [publicacionId]: Array.isArray(data?.comentarios) ? data.comentarios : []
      }));
    } catch (error) {
      const msg = error?.response?.data?.message || 'No fue posible cargar comentarios';
      toast.error(msg);
    } finally {
      setCargandoComentarios((prev) => ({ ...prev, [publicacionId]: false }));
    }
  };

  const enviarComentario = async (publicacionId) => {
    const texto = String(comentarioDraft[publicacionId] || '').trim();
    if (!texto) return;
    try {
      const { data } = await axios.post(apiUrl(`/api/publicaciones/${publicacionId}/comentarios`), {
        comentario: texto
      });
      setComentarioDraft((prev) => ({ ...prev, [publicacionId]: '' }));
      if (data?.comentario) {
        setComentariosPorPub((prev) => ({
          ...prev,
          [publicacionId]: [data.comentario, ...(prev[publicacionId] || [])]
        }));
      } else {
        await cargarComentarios(publicacionId, true);
      }
      setPublicaciones((prev) => prev.map((p) => (
        p.id === publicacionId
          ? { ...p, comentarios_total: Number(data?.comentarios_total ?? ((p.comentarios_total || 0) + 1)) }
          : p
      )));
      toast.success('Comentario publicado');
    } catch (error) {
      const msg = error?.response?.data?.message || 'No fue posible comentar';
      toast.error(msg);
    }
  };

  const guardarPerfil = async () => {
    setGuardandoPerfil(true);
    try {
      const payload = {
        email: perfilForm.email,
        notificar_email: Boolean(perfilForm.notificar_email)
      };
      const { data } = await axios.put(apiUrl('/api/me'), payload);
      if (data?.usuario) {
        setMiPerfil(data.usuario);
      }
      toast.success('Perfil actualizado');
      setPerfilOpen(false);
    } catch (error) {
      const msg = error?.response?.data?.message || 'No fue posible guardar el perfil';
      toast.error(msg);
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const guardarEdicion = async (id) => {
    const fd = new FormData();
    fd.append('titulo', formEdit.titulo);
    fd.append('contenido', formEdit.contenido);
    fd.append('categoria', formEdit.categoria);
    if (formEdit.imagenNueva) fd.append('imagen', formEdit.imagenNueva);
    formEdit.imagenesNuevas.forEach((file) => fd.append('imagenes', file));
    formEdit.archivosNuevos.forEach((file) => fd.append('archivos', file));
    fd.append('recursos_existentes', JSON.stringify(formEdit.recursosExistentes.map((r) => r.id)));
    fd.append('links_nuevos', JSON.stringify(formEdit.linksNuevos.map((l) => l.trim()).filter(Boolean)));

    try {
      await axios.put(apiUrl(`/api/publicaciones/${id}`), fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Publicacion actualizada');
      editSnapshotRef.current = null;
      setEditandoId(null);
      cargarPublicaciones();
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const publicacionesFiltradas = useMemo(() => {
    const term = normalizarTexto(busqueda);
    const tokens = term.split(/\s+/).filter(Boolean);

    const enabledScopes = Object.entries(searchScopes)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key);
    const scopes = enabledScopes.length ? enabledScopes : DASHBOARD_SEARCH_SCOPES.map((s) => s.key);

    const filtered = publicaciones
      .filter((pub) => categoriaFiltro === 'Todas' || pub.categoria === categoriaFiltro)
      .filter((pub) => !soloFavoritos || Boolean(pub.favorito_usuario))
      .map((pub, idx) => {
        if (!tokens.length) return { pub, idx, score: 0 };

        const recursosTexto = (pub.recursos || [])
          .map((r) => `${r?.nombre || ''} ${r?.url || ''} ${r?.tipo || ''}`)
          .join(' ');
        const fields = {
          titulo: normalizarTexto(pub.titulo),
          contenido: normalizarTexto(pub.contenido),
          categoria: normalizarTexto(pub.categoria),
          recursos: normalizarTexto(recursosTexto)
        };

        let score = 0;
        const allMatch = tokens.every((tk) => {
          let matched = false;
          scopes.forEach((scope) => {
            const value = fields[scope] || '';
            if (value.includes(tk)) {
              matched = true;
              if (scope === 'titulo') score += 6;
              if (scope === 'contenido') score += 3;
              if (scope === 'categoria') score += 4;
              if (scope === 'recursos') score += 2;
            }
          });
          return matched;
        });

        return { pub, idx, score, allMatch };
      })
      .filter((item) => !tokens.length || item.allMatch)
      .sort((a, b) => (b.score - a.score) || (a.idx - b.idx))
      .map((item) => item.pub);

    return filtered;
  }, [publicaciones, categoriaFiltro, busqueda, searchScopes, soloFavoritos]);

  const highlightText = useCallback((text) => {
    const raw = String(text || '');
    const query = String(busqueda || '').trim();
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
  }, [busqueda, darkMode]);

  const totalPublicaciones = publicaciones.length;
  const totalLeidas = publicaciones.filter((p) => Number(p.leido) > 0).length;
  const totalPendientes = Math.max(totalPublicaciones - totalLeidas, 0);
  const totalPendientesReconfirmar = publicaciones.filter((p) => Number(p.requiere_reconfirmacion) > 0 && Number(p.puede_confirmar_lectura) > 0 && Number(p.leido) === 0).length;
  const ultimaLectura = publicaciones
    .filter((p) => Number(p.leido) > 0 && p.fecha_lectura)
    .map((p) => new Date(p.fecha_lectura))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => b - a)[0] || null;

  const notificaciones = useMemo(() => {
    const list = [];
    publicaciones.forEach((pub) => {
      const leido = Number(pub.leido) > 0;
      const requiereReconfirmacion = Number(pub.requiere_reconfirmacion) > 0;
      const puedeConfirmar = Number(pub.puede_confirmar_lectura) > 0;
      const fechaPublicacion = pub.fecha_publicacion ? new Date(pub.fecha_publicacion) : null;

      if (!leido && requiereReconfirmacion && puedeConfirmar) {
        list.push({
          id: `reconfirmar-${pub.id}`,
          prioridad: 1,
          titulo: 'Reconfirmacion pendiente',
          detalle: pub.titulo || 'Comunicado sin titulo',
          categoria: pub.categoria || 'General'
        });
      } else if (!leido && puedeConfirmar) {
        list.push({
          id: `pendiente-${pub.id}`,
          prioridad: 2,
          titulo: 'Lectura pendiente',
          detalle: pub.titulo || 'Comunicado sin titulo',
          categoria: pub.categoria || 'General'
        });
      } else if (!leido && !puedeConfirmar) {
        list.push({
          id: `vencido-${pub.id}`,
          prioridad: 3,
          titulo: 'Plazo vencido',
          detalle: pub.titulo || 'Comunicado sin titulo',
          categoria: pub.categoria || 'General'
        });
      }

      if (fechaPublicacion && !Number.isNaN(fechaPublicacion.getTime())) {
        const hoursAgo = (Date.now() - fechaPublicacion.getTime()) / (1000 * 60 * 60);
        if (hoursAgo <= 24) {
          list.push({
            id: `nuevo-${pub.id}`,
            prioridad: 4,
            titulo: 'Nuevo comunicado',
            detalle: pub.titulo || 'Comunicado sin titulo',
            categoria: pub.categoria || 'General'
          });
        }
      }
    });

    return list
      .sort((a, b) => a.prioridad - b.prioridad)
      .slice(0, 12);
  }, [publicaciones]);

  const notificacionesNoVistas = notificaciones.filter((item) => !notificationsSeen[item.id]).length;

  const marcarNotificacionesComoVistas = () => {
    const next = { ...notificationsSeen };
    notificaciones.forEach((item) => {
      next[item.id] = true;
    });
    setNotificationsSeen(next);
  };

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
          <div className="relative" ref={notificationPanelRef}>
            <button
              onClick={() => setNotificationsOpen((prev) => !prev)}
              className={`relative p-2.5 rounded-xl transition-all ${
                darkMode ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
              title="Notificaciones"
            >
              <FiBell className="w-5 h-5" />
              {notificacionesNoVistas > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-green-600 text-white text-[10px] font-black flex items-center justify-center">
                  {notificacionesNoVistas > 9 ? '9+' : notificacionesNoVistas}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <div className={`absolute right-0 mt-2 w-[300px] sm:w-[360px] rounded-2xl border p-3 shadow-2xl z-[60] ${
                darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
              }`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className={`text-xs font-black uppercase tracking-widest ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Notificaciones</p>
                  <button
                    type="button"
                    onClick={marcarNotificacionesComoVistas}
                    className={`text-[11px] font-black px-2.5 py-1 rounded-lg border transition ${
                      darkMode ? 'border-slate-700 text-slate-200 hover:border-green-500 hover:text-green-300' : 'border-gray-200 text-slate-600 hover:border-green-300 hover:text-green-700'
                    }`}
                  >
                    Marcar vistas
                  </button>
                </div>
                {notificaciones.length === 0 ? (
                  <p className={`text-sm py-4 text-center ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>No hay novedades por ahora.</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto sidebar-scroll space-y-2 pr-1">
                    {notificaciones.map((item) => {
                      const seen = Boolean(notificationsSeen[item.id]);
                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border px-3 py-2.5 transition ${
                            seen
                              ? (darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-gray-200 bg-gray-50')
                              : (darkMode ? 'border-green-800 bg-green-900/20' : 'border-green-200 bg-green-50')
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`text-xs font-black ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{item.titulo}</p>
                              <p className={`text-xs truncate ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{item.detalle}</p>
                              <p className={`text-[10px] mt-1 uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{item.categoria}</p>
                            </div>
                            {!seen && <FiCheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          <button onClick={toggleDarkMode} className={`p-2.5 rounded-xl transition-all ${darkMode ? 'bg-slate-800 text-yellow-400' : 'bg-gray-100 text-slate-500 hover:bg-gray-200'}`}>
            {darkMode ? 'Claro' : 'Oscuro'}
          </button>
          <button
            onClick={() => setPerfilOpen(true)}
            className={`p-2.5 rounded-xl transition-all ${darkMode ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-gray-100 text-slate-500 hover:bg-gray-200'}`}
            title="Mi perfil"
          >
            <FiUser className="w-5 h-5" />
          </button>
          <div className={`text-right border-r pr-2 sm:pr-4 min-w-0 ${darkMode ? 'border-slate-700' : 'border-gray-100'}`}>
            <p className="text-xs sm:text-sm font-black max-w-[140px] sm:max-w-none truncate">{usuario?.nombre_completo}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest hidden sm:block">{usuario?.area}</p>
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
                    onClick={() => navigate('/dashboard')}
                    className="w-full text-left px-3 py-2.5 rounded-xl border border-green-500 bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-all flex items-center gap-2 shadow-sm"
                  >
                    <span className="w-5 h-5 rounded-md bg-white/25 flex items-center justify-center">
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
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-start pt-1 gap-2">
              <div className="flex flex-col gap-2">
                <button
                  onClick={toggleSidebar}
                  className="w-10 h-10 rounded-xl border border-green-500 bg-green-600 text-white hover:bg-green-700 transition shadow-sm flex items-center justify-center"
                  title="Filtros"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 6h16M4 12h16M4 18h16"></path>
                  </svg>
                </button>
              {usuario?.rol === 'admin' && (
                <>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="w-10 h-10 rounded-xl border border-green-500 bg-green-600 text-white hover:bg-green-700 transition shadow-sm flex items-center justify-center"
                    title="Inicio"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 10.5L12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5"></path>
                    </svg>
                  </button>
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
                  <button
                    onClick={() => navigate('/reportes-panel')}
                    className={`w-10 h-10 rounded-xl border transition flex items-center justify-center ${
                      darkMode
                        ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white'
                        : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'
                    }`}
                    title="Panel analitico"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 19h16M7 16V9m5 7V5m5 11v-6"></path>
                    </svg>
                  </button>
                </>
              )}
              </div>
            </div>
          )}
        </aside>

        <main className={`flex-1 min-w-0 p-4 sm:p-6 md:p-10 ${sidebarCollapsed ? 'lg:ml-16 lg:w-[calc(100%-4rem)]' : 'lg:ml-72 lg:w-[calc(100%-18rem)]'}`}>
          <div className="max-w-6xl mx-auto">
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
              <div className="grid grid-cols-5 gap-2">
                <button onClick={() => navigate('/dashboard')} className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-black">
                  Inicio
                </button>
                <button onClick={() => navigate('/admin')} className={`px-3 py-2 rounded-xl text-xs font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
                  Crear
                </button>
                <button onClick={() => navigate('/registro-personal')} className={`px-3 py-2 rounded-xl text-xs font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
                  Empleados
                </button>
                <button onClick={() => navigate('/reportes')} className={`px-3 py-2 rounded-xl text-xs font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
                  Auditoria
                </button>
                <button onClick={() => navigate('/reportes-panel')} className={`px-3 py-2 rounded-xl text-xs font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
                  Panel
                </button>
              </div>
            )}
          </div>

          <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <section className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100 shadow-sm'}`}>
              <button
                type="button"
                onClick={toggleResumen}
                className="w-full flex items-center justify-between gap-2 px-3 pt-3 pb-2"
                aria-expanded={showResumen}
              >
                <p className={`text-xs font-black uppercase tracking-wider ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                  Resumen comunicados
                </p>
                <span
                  className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-transform duration-300 ${
                    darkMode ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-500'
                  } ${showResumen ? 'rotate-180' : 'rotate-0'}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M6 9l6 6 6-6"></path>
                  </svg>
                </span>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  showResumen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="grid grid-cols-3 gap-2 px-3 pb-3 pt-1">
                  <article className={`rounded-lg border p-2 ${darkMode ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50'}`}>
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Total</p>
                    <p className={`text-base font-black ${darkMode ? 'text-white' : 'text-slate-800'}`}>{totalPublicaciones}</p>
                  </article>
                  <article className={`rounded-lg border p-2 ${darkMode ? 'border-green-800 bg-green-900/20' : 'border-green-200 bg-green-50/90'}`}>
                    <p className={`text-[9px] font-black uppercase tracking-wider ${darkMode ? 'text-green-300' : 'text-green-700'}`}>Leidos</p>
                    <p className={`text-base font-black ${darkMode ? 'text-green-200' : 'text-green-700'}`}>{totalLeidas}</p>
                  </article>
                  <article className={`rounded-lg border p-2 ${darkMode ? 'border-amber-800 bg-amber-900/20' : 'border-amber-200 bg-amber-50/90'}`}>
                    <p className={`text-[9px] font-black uppercase tracking-wider ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>Pend.</p>
                    <p className={`text-base font-black ${darkMode ? 'text-amber-200' : 'text-amber-700'}`}>{totalPendientes}</p>
                  </article>
                </div>
              </div>
            </section>

            <section className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100 shadow-sm'}`}>
              <button
                type="button"
                onClick={toggleActividad}
                className="w-full flex items-center justify-between gap-2 px-3 pt-3 pb-2"
                aria-expanded={showActividad}
              >
                <p className={`text-xs font-black uppercase tracking-wider ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                  Mi actividad
                </p>
                <span
                  className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-transform duration-300 ${
                    darkMode ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-500'
                  } ${showActividad ? 'rotate-180' : 'rotate-0'}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M6 9l6 6 6-6"></path>
                  </svg>
                </span>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  showActividad ? 'max-h-56 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="space-y-2 px-3 pb-3 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <article className={`rounded-lg border p-2 ${darkMode ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50'}`}>
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Leidos</p>
                      <p className={`text-base font-black ${darkMode ? 'text-white' : 'text-slate-800'}`}>{totalLeidas}</p>
                    </article>
                    <article className={`rounded-lg border p-2 ${darkMode ? 'border-sky-800 bg-sky-900/20' : 'border-sky-200 bg-sky-50/90'}`}>
                      <p className={`text-[9px] font-black uppercase tracking-wider ${darkMode ? 'text-sky-300' : 'text-sky-700'}`}>Reconfirmar</p>
                      <p className={`text-base font-black ${darkMode ? 'text-sky-200' : 'text-sky-700'}`}>{totalPendientesReconfirmar}</p>
                    </article>
                  </div>
                  <div className={`rounded-lg border px-2.5 py-2 text-[10px] ${darkMode ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                    Ultima lectura: {ultimaLectura ? ultimaLectura.toLocaleString() : 'Sin registros recientes'}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {(totalPendientes > 0 || totalPendientesReconfirmar > 0) && (
            <div className={`mb-4 rounded-2xl border px-4 py-3 flex items-start gap-2 ${darkMode ? 'border-amber-800 bg-amber-900/20' : 'border-amber-200 bg-amber-50'}`}>
              <FiClock className={`w-4 h-4 mt-0.5 ${darkMode ? 'text-amber-300' : 'text-amber-700'}`} />
              <div className="text-sm">
                <p className={`font-black ${darkMode ? 'text-amber-200' : 'text-amber-800'}`}>Recordatorio confirmación</p>
                <p className={`${darkMode ? 'text-amber-100/90' : 'text-amber-700'}`}>
                  Tienes {totalPendientes} pendiente(s) y {totalPendientesReconfirmar} por reconfirmar.
                </p>
              </div>
            </div>
          )}

          <div className="mb-4 sm:mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por titulo, contenido, categoria, archivos o links..."
                className={`w-full px-4 sm:px-6 py-3 sm:py-4 rounded-2xl border outline-none transition-all ${darkMode ? 'bg-slate-900 border-slate-700 focus:border-green-500 text-white' : 'bg-white border-gray-200 focus:border-green-500 shadow-sm'}`}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onBlur={() => registrarBusqueda(busqueda)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') registrarBusqueda(busqueda);
                }}
              />
              {busqueda.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
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
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSoloFavoritos((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-black transition ${
                    soloFavoritos
                      ? 'bg-green-600 border-green-600 text-white'
                      : darkMode
                        ? 'border-slate-700 bg-slate-900 text-slate-300 hover:border-green-500 hover:text-green-300'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-green-300 hover:text-green-700'
                  }`}
                >
                  <FiStar className="w-3.5 h-3.5" />
                  Favoritos
                </button>
                <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Resultados ordenados por relevancia.
                </p>
              </div>
              <p className={`text-[11px] font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {publicacionesFiltradas.length} resultado(s)
              </p>
            </div>
          </div>

          <div className="space-y-8">
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
              const leidoVigente = Number(pub.leido) > 0;
              const requiereReconfirmacion = Number(pub.requiere_reconfirmacion) > 0;
              const puedeConfirmarLectura = Number(pub.puede_confirmar_lectura) > 0;
              const bloqueoPorPlazo = !leidoVigente && !puedeConfirmarLectura;
              const etiquetaLectura = leidoVigente
                ? 'Leido'
                : bloqueoPorPlazo
                  ? 'Plazo vencido'
                  : requiereReconfirmacion
                    ? 'Reconfirmar lectura'
                    : 'Confirmar lectura';
              return (
              <article key={pub.id} className={`rounded-[2.2rem] overflow-hidden border transition-all duration-300 hover:-translate-y-[1px] ${darkMode ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-gray-100 shadow-xl shadow-slate-200/50'}`}>
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
                    <div className={`space-y-5 rounded-2xl border p-4 sm:p-5 ${darkMode ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50/60'}`}>
                      <div className={`rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${darkMode ? 'border-green-900 bg-green-900/20' : 'border-green-200 bg-green-50'}`}>
                        <p className={`text-xs font-semibold ${darkMode ? 'text-green-200' : 'text-green-800'}`}>
                          Editando este comunicado. Si deseas crear uno nuevo, abre el formulario principal.
                        </p>
                        <button
                          type="button"
                          onClick={() => navigate('/admin')}
                          className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-black border ${darkMode ? 'border-green-700 bg-slate-900 text-green-300' : 'border-green-300 bg-white text-green-700'}`}
                        >
                          Crear nuevo
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className={`text-[10px] font-black uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>Titulo</label>
                        <input
                          className={`w-full p-4 rounded-xl border text-sm font-semibold ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-700'}`}
                          value={formEdit.titulo}
                          onChange={(e) => setFormEdit({ ...formEdit, titulo: e.target.value })}
                        />
                      </div>

                      <div className="grid md:grid-cols-[220px_1fr] gap-4">
                        <div className="space-y-2">
                          <label className={`text-[10px] font-black uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>Area</label>
                          <select
                            className={`w-full p-4 rounded-xl border text-sm font-semibold ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-700'}`}
                            value={formEdit.categoria}
                            onChange={(e) => setFormEdit({ ...formEdit, categoria: e.target.value })}
                          >
                            {CATEGORIAS.filter((c) => c !== 'Todas').map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className={`text-[10px] font-black uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>Mensaje</label>
                          <textarea
                            className={`w-full p-4 rounded-xl border h-36 text-sm leading-relaxed ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-700'}`}
                            value={formEdit.contenido}
                            onChange={(e) => setFormEdit({ ...formEdit, contenido: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-3">
                        <div className={`rounded-xl border p-3 space-y-2 ${darkMode ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <label className={`text-xs font-bold inline-flex items-center gap-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              <FiImage className="w-3.5 h-3.5" />
                              Portada (opcional)
                            </label>
                            {formEdit.imagenNueva && (
                              <button type="button" onClick={() => setFormEdit({ ...formEdit, imagenNueva: null })} className="text-[11px] font-bold text-red-500">
                                Quitar
                              </button>
                            )}
                          </div>
                          <input type="file" accept="image/*" onChange={(e) => setFormEdit({ ...formEdit, imagenNueva: e.target.files?.[0] || null })} className="w-full text-xs border rounded-lg p-2" />
                          {formEdit.imagenNueva && (
                            <p className={`text-[11px] font-semibold ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
                              Portada seleccionada: {shortName(formEdit.imagenNueva.name)}
                            </p>
                          )}
                          <div className={`pt-2 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                            <label className={`text-xs font-bold inline-flex items-center gap-1.5 mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              <FiImage className="w-3.5 h-3.5" />
                              Imagenes adicionales
                            </label>
                            <input type="file" accept="image/*" multiple onChange={(e) => addImagenesNuevas(e.target.files)} className="w-full text-xs border rounded-lg p-2" />
                            {!!formEdit.imagenesNuevas.length && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {formEdit.imagenesNuevas.map((file, idx) => (
                                  <span key={`${file.name}-${idx}`} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border ${
                                    darkMode ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'
                                  }`}>
                                    {shortName(file.name)}
                                    <button type="button" onClick={() => removeImagenNuevaAt(idx)} className="text-red-500">
                                      <FiX className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className={`rounded-xl border p-3 space-y-2 ${darkMode ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
                          <label className={`text-xs font-bold inline-flex items-center gap-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                            <FiFileText className="w-3.5 h-3.5" />
                            Nuevos adjuntos
                          </label>
                          <input type="file" multiple onChange={(e) => addArchivosNuevos(e.target.files)} className="w-full text-xs border rounded-lg p-2" />
                          {!!formEdit.archivosNuevos.length && (
                            <div className="flex flex-wrap gap-2">
                              {formEdit.archivosNuevos.map((file, idx) => (
                                <span key={`${file.name}-${idx}`} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border ${
                                  darkMode ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'
                                }`}>
                                  {shortName(file.name)}
                                  <button type="button" onClick={() => removeArchivoNuevoAt(idx)} className="text-red-500">
                                    <FiX className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            Puedes agregar varios archivos en tandas.
                          </p>
                        </div>
                      </div>

                      <div className={`rounded-xl p-3 border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <p className={`text-xs font-bold mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>Recursos actuales (quitar para eliminar)</p>
                        <div className="flex flex-wrap gap-2">
                          {formEdit.recursosExistentes.map((r) => (
                            <button key={r.id} type="button" onClick={() => quitarRecursoExistente(r.id)} className={`text-xs px-3 py-1.5 rounded-full border hover:border-red-300 hover:text-red-600 ${
                              darkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200'
                            }`}>
                              {r.tipo === 'archivo' ? 'Archivo: ' : 'Link: '}{r.nombre} x
                            </button>
                          ))}
                          {formEdit.recursosExistentes.length === 0 && <p className="text-xs text-slate-400">Sin recursos conservados.</p>}
                        </div>
                      </div>

                      <div className={`space-y-2 rounded-xl p-3 border ${darkMode ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
                        <div className="flex justify-between items-center">
                          <p className={`text-xs font-bold inline-flex items-center gap-1.5 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                            <FiLink2 className="w-3.5 h-3.5" />
                            Links nuevos
                          </p>
                          <button type="button" onClick={addLinkNuevo} className="text-xs font-bold text-green-700 inline-flex items-center gap-1">
                            <FiUpload className="w-3.5 h-3.5" />
                            Agregar
                          </button>
                        </div>
                        {formEdit.linksNuevos.map((l, idx) => (
                          <div key={idx} className="flex gap-2">
                            <input type="url" value={l} onChange={(e) => setLinkNuevoAt(idx, e.target.value)} className={`flex-1 text-sm border rounded-lg px-3 py-2 ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : ''}`} placeholder="https://..." />
                            {formEdit.linksNuevos.length > 1 && <button type="button" onClick={() => removeLinkNuevo(idx)} className={`px-3 border rounded-lg text-red-600 ${darkMode ? 'border-slate-700 bg-slate-900' : ''}`}><FiX className="w-3.5 h-3.5" /></button>}
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button onClick={() => guardarEdicion(pub.id)} className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider">
                          <FiCheckCircle className="w-4 h-4" />
                          Guardar cambios
                        </button>
                        <button onClick={() => { editSnapshotRef.current = null; setEditandoId(null); }} className={`px-4 py-2.5 rounded-xl text-xs font-black border ${darkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-white'}`}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-2xl font-black mb-4 break-words [overflow-wrap:anywhere]">{highlightText(pub.titulo)}</h3>
                      <p className={`text-base leading-relaxed mb-6 whitespace-pre-line break-words [overflow-wrap:anywhere] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{highlightText(pub.contenido)}</p>

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

                      <div className={`mb-2 p-4 rounded-2xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>Reacciones</p>
                          <p className={`text-[11px] font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tu opinion sobre el comunicado</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {REACCIONES_DISPONIBLES.map((item) => {
                            const Icon = item.icon;
                            const active = pub.reaccion_usuario === item.key;
                            const count = Number(pub.reacciones?.[item.key] || 0);
                            return (
                              <button
                                key={`${pub.id}-${item.key}`}
                                type="button"
                                onClick={() => toggleReaccion(pub.id, pub.reaccion_usuario, item.key)}
                                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black border transition ${
                                  active
                                    ? 'bg-green-600 text-white border-green-600'
                                    : darkMode
                                      ? 'bg-slate-900 text-slate-300 border-slate-700 hover:border-green-500 hover:text-green-300'
                                      : 'bg-white text-slate-700 border-slate-200 hover:border-green-300 hover:text-green-700'
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                {item.label}
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                  active
                                    ? 'bg-white/20 text-white'
                                    : darkMode
                                      ? 'bg-slate-800 text-slate-300'
                                      : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className={`mb-2 p-4 rounded-2xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>Comentarios</p>
                          <button
                            type="button"
                            onClick={async () => {
                              const next = !comentariosOpen[pub.id];
                              setComentariosOpen((prev) => ({ ...prev, [pub.id]: next }));
                              if (next) await cargarComentarios(pub.id);
                            }}
                            className={`text-[11px] font-black px-2.5 py-1 rounded-lg border ${
                              darkMode ? 'border-slate-700 bg-slate-900 text-slate-300' : 'border-slate-200 bg-white text-slate-600'
                            }`}
                          >
                            {comentariosOpen[pub.id] ? 'Ocultar' : 'Ver'} ({Number(pub.comentarios_total || 0)})
                          </button>
                        </div>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={comentarioDraft[pub.id] || ''}
                            onChange={(e) => setComentarioDraft((prev) => ({ ...prev, [pub.id]: e.target.value.slice(0, 280) }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void enviarComentario(pub.id);
                              }
                            }}
                            placeholder="Escribe un comentario corto..."
                            className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                              darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => enviarComentario(pub.id)}
                            className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-black"
                          >
                            Enviar
                          </button>
                        </div>
                        {comentariosOpen[pub.id] && (
                          <div className={`max-h-44 overflow-y-auto sidebar-scroll pr-1 space-y-1.5 ${darkMode ? 'sidebar-scroll-dark' : ''}`}>
                            {cargandoComentarios[pub.id] && (
                              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Cargando comentarios...</p>
                            )}
                            {!cargandoComentarios[pub.id] && !(comentariosPorPub[pub.id] || []).length && (
                              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Aun no hay comentarios.</p>
                            )}
                            {(comentariosPorPub[pub.id] || []).map((comentario) => (
                              <div key={comentario.id} className={`rounded-lg border px-2.5 py-2 ${
                                darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-200 bg-white text-slate-700'
                              }`}>
                                <p className="text-[11px] font-black">{comentario.usuario_nombre}</p>
                                <p className="text-xs break-words">{comentario.comentario}</p>
                                <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{new Date(comentario.created_at).toLocaleString()}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-8 border-t ${darkMode ? 'border-slate-800' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => !leidoVigente && !bloqueoPorPlazo && marcarComoLeido(pub.id, requiereReconfirmacion)}
                        disabled={leidoVigente || bloqueoPorPlazo}
                        className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          leidoVigente || bloqueoPorPlazo
                            ? (darkMode ? 'bg-slate-800 text-slate-500' : 'bg-gray-50 text-slate-300')
                            : 'bg-green-600 text-white shadow-xl hover:bg-green-700 hover:-translate-y-1'
                        }`}
                        title={bloqueoPorPlazo ? 'El plazo de confirmacion ya vencio' : ''}
                      >
                        {etiquetaLectura}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFavorito(pub.id, Boolean(pub.favorito_usuario))}
                        className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border text-xs font-black transition ${
                          pub.favorito_usuario
                            ? 'bg-amber-500 text-white border-amber-500'
                            : darkMode
                              ? 'border-slate-700 bg-slate-900 text-slate-300 hover:border-amber-500 hover:text-amber-300'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:text-amber-700'
                        }`}
                      >
                        <FiStar className="w-4 h-4" />
                        {pub.favorito_usuario ? 'Favorito' : 'Guardar'}
                      </button>
                    </div>

                    {usuario?.rol === 'admin' && editandoId !== pub.id && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => activarEdicion(pub)}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-black transition ${
                            darkMode
                              ? 'border-slate-700 bg-slate-900 text-slate-200 hover:border-green-500 hover:text-green-300'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-green-300 hover:text-green-700'
                          }`}
                        >
                          <FiEdit2 className="w-3.5 h-3.5" />
                          Editar
                        </button>
                        <button
                          onClick={() => eliminarPub(pub.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-black transition ${
                            darkMode
                              ? 'border-red-900 bg-slate-900 text-red-300 hover:bg-red-900/20'
                              : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                          }`}
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </button>
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

      {perfilOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border p-4 sm:p-5 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-base font-black ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Mi perfil</h3>
              <button
                type="button"
                onClick={() => setPerfilOpen(false)}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center ${darkMode ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-slate-200 bg-white text-slate-500'}`}
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <p className={`text-[11px] font-black uppercase tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Nombre</p>
                <div className={`px-3 py-2 rounded-lg border text-sm ${darkMode ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                  {miPerfil?.nombre_completo || usuario?.nombre_completo}
                </div>
              </div>
              <div>
                <p className={`text-[11px] font-black uppercase tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Correo</p>
                <input
                  type="email"
                  value={perfilForm.email}
                  onChange={(e) => setPerfilForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="correo@empresa.com"
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-700'}`}
                />
              </div>
              <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${darkMode ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                <input
                  type="checkbox"
                  checked={Boolean(perfilForm.notificar_email)}
                  onChange={(e) => setPerfilForm((prev) => ({ ...prev, notificar_email: e.target.checked }))}
                />
                Recibir notificaciones por correo
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPerfilOpen(false)}
                className={`px-3 py-2 rounded-lg border text-xs font-black ${darkMode ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoPerfil}
                onClick={guardarPerfil}
                className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-black"
              >
                {guardandoPerfil ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
