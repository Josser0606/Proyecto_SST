import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiBarChart2, FiCheckCircle, FiEye, FiFile, FiFileText, FiHeart, FiImage, FiLink2, FiMapPin, FiMonitor, FiPaperclip, FiRefreshCw, FiThumbsUp, FiType, FiUpload, FiX, FiZap } from 'react-icons/fi';
import logoSaciar from '../assets/logo_saciar.png';
import { apiUrl } from '../config/api';

const CATEGORIAS = [
  'SST y GH',
  'Calidad',
  'Mercadeo Social',
  'Logistica y Transporte',
  'Programas y Proyectos',
  'Relaciones Institucionales',
  'Financiero y Contable',
  'Direccion'
];

const TITULOS_BASE = [
  'Comunicado para todo el personal',
  'Actualizacion de procesos internos',
  'Novedades del area administrativa',
  'Recordatorio de cumplimiento y seguridad',
  'Informacion importante de la fundacion',
  'Cronograma de actividades semanales',
  'Lineamientos para la jornada de trabajo',
  'Aviso general para colaboradores',
  'Capacitacion y seguimiento operativo',
  'Actualizacion de politicas internas'
];

const normalizeText = (value = '') =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const toTitleCase = (value = '') =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const hashSeed = (value = '') => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
};

const pickStableRandom = (items, count, seedText) => {
  const arr = [...items];
  let seed = hashSeed(seedText || 'saciar');
  for (let i = arr.length - 1; i > 0; i -= 1) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = seed % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
};

function AdminPanel() {
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [categoria, setCategoria] = useState('SST y GH');
  const [imagenesInputs, setImagenesInputs] = useState([null]);
  const [archivosInputs, setArchivosInputs] = useState([null]);
  const [links, setLinks] = useState(['']);
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImageUrls, setPreviewImageUrls] = useState([]);
  const [draggingImagenes, setDraggingImagenes] = useState(false);
  const [draggingArchivos, setDraggingArchivos] = useState(false);
  const [tituloSeed, setTituloSeed] = useState(0);
  const [refreshingTitulos, setRefreshingTitulos] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario'));
  const tieneCambiosSinGuardar = useMemo(() => {
    return Boolean(
      titulo.trim() ||
      contenido.trim() ||
      categoria !== 'SST y GH' ||
      imagenesInputs.some(Boolean) ||
      archivosInputs.some(Boolean) ||
      links.some((link) => link.trim())
    );
  }, [titulo, contenido, categoria, imagenesInputs, archivosInputs, links]);
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

  const setLinkAt = (idx, value) => {
    setLinks((prev) => prev.map((l, i) => (i === idx ? value : l)));
  };

  const addLink = () => {
    setLinks((prev) => [...prev, '']);
    toast('Campo de link agregado');
  };
  const removeLink = (idx) => {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
    toast('Campo de link eliminado');
  };
  const addImagenInput = () => {
    setImagenesInputs((prev) => [...prev, null]);
    toast('Campo de imagen agregado');
  };
  const addArchivoInput = () => {
    setArchivosInputs((prev) => [...prev, null]);
    toast('Campo de archivo agregado');
  };
  const removeImagenInput = (idx) => {
    setImagenesInputs((prev) => prev.filter((_, i) => i !== idx));
    toast('Campo de imagen eliminado');
  };
  const removeArchivoInput = (idx) => {
    setArchivosInputs((prev) => prev.filter((_, i) => i !== idx));
    toast('Campo de archivo eliminado');
  };
  const setImagenAt = (idx, file) => setImagenesInputs((prev) => prev.map((f, i) => (i === idx ? (file || null) : f)));
  const setArchivoAt = (idx, file) => setArchivosInputs((prev) => prev.map((f, i) => (i === idx ? (file || null) : f)));
  const imagenesSeleccionadas = imagenesInputs.filter(Boolean).length;
  const archivosSeleccionados = archivosInputs.filter(Boolean).length;
  const linksActivos = links.map((l) => l.trim()).filter(Boolean).length;
  const imagenesSeleccionadasList = useMemo(() => imagenesInputs.filter(Boolean), [imagenesInputs]);
  const archivosSeleccionadosList = useMemo(() => archivosInputs.filter(Boolean), [archivosInputs]);
  const linksPreview = useMemo(() => links.map((l) => l.trim()).filter(Boolean), [links]);
  const caracteresContenido = contenido.trim().length;
  const tituloSugerencias = useMemo(() => {
    const value = titulo.trim();
    const normalized = normalizeText(value);
    const randomBase = pickStableRandom(TITULOS_BASE, 4, `${value}-${categoria}-${tituloSeed}`);

    if (!value) return randomBase;

    const parts = value.split(/\s+/).filter((w) => w.length >= 3);
    const textMain = toTitleCase(value);
    const keyword = toTitleCase(parts.slice(0, 4).join(' '));

    const context = [
      `${textMain} - ${categoria}`,
      `Comunicado: ${textMain}`,
      `Actualizacion: ${textMain}`,
      `Lineamientos sobre ${keyword || textMain}`,
      `Informacion importante: ${textMain}`
    ];

    const relatedBase = TITULOS_BASE.filter((item) => normalizeText(item).includes(normalized));
    const mixed = [...context, ...relatedBase, ...randomBase];
    return [...new Set(mixed)].filter(Boolean).slice(0, 6);
  }, [titulo, categoria, tituloSeed]);
  const mostrarSugerenciasTitulo = titulo.trim().length < 8;
  const getDisplayName = (fileName) => {
    if (!fileName) return 'Ningun archivo seleccionado';
    return fileName.length > 42 ? `${fileName.slice(0, 39)}...` : fileName;
  };
  const getFileExtension = (fileName = '') => fileName.split('.').pop()?.toUpperCase() || '';
  const formatFileSize = (bytes = 0) => {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };
  const getDocTypeMeta = (fileName = '') => {
    const ext = getFileExtension(fileName);
    if (ext === 'PDF') return { label: 'PDF', className: 'bg-red-50 text-red-700 border-red-200', Icon: FiFileText };
    if (ext === 'DOC' || ext === 'DOCX') return { label: 'WORD', className: 'bg-blue-50 text-blue-700 border-blue-200', Icon: FiFileText };
    if (ext === 'XLS' || ext === 'XLSX') return { label: 'EXCEL', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: FiBarChart2 };
    if (ext === 'PPT' || ext === 'PPTX') return { label: 'PPT', className: 'bg-orange-50 text-orange-700 border-orange-200', Icon: FiMonitor };
    return { label: ext || 'FILE', className: 'bg-slate-50 text-slate-700 border-slate-200', Icon: FiFile };
  };
  const handleDragOver = (e) => {
    e.preventDefault();
  };
  const mergeDroppedFilesInInputs = (prev, files) => {
    const next = [...prev];
    files.forEach((file) => {
      const emptyIdx = next.findIndex((f) => !f);
      if (emptyIdx >= 0) next[emptyIdx] = file;
      else next.push(file);
    });
    return next.length > 0 ? next : [null];
  };
  const handleDropImagenes = (e) => {
    e.preventDefault();
    setDraggingImagenes(false);
    const dropped = Array.from(e.dataTransfer?.files || []);
    const valid = dropped.filter((f) => f.type.startsWith('image/'));
    if (valid.length === 0) {
      toast.error('Solo se permiten imagenes en este bloque');
      return;
    }
    setImagenesInputs((prev) => mergeDroppedFilesInInputs(prev, valid));
    toast.success(`${valid.length} imagen(es) agregada(s)`);
  };
  const handleDropArchivos = (e) => {
    e.preventDefault();
    setDraggingArchivos(false);
    const dropped = Array.from(e.dataTransfer?.files || []);
    const validExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
    const valid = dropped.filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      return validExtensions.includes(ext);
    });
    if (valid.length === 0) {
      toast.error('Solo PDF, Word, Excel o PowerPoint en este bloque');
      return;
    }
    setArchivosInputs((prev) => mergeDroppedFilesInInputs(prev, valid));
    toast.success(`${valid.length} archivo(s) agregado(s)`);
  };
  const refreshTituloSuggestions = () => {
    setRefreshingTitulos(true);
    setTituloSeed((prev) => prev + 1);
    setTimeout(() => setRefreshingTitulos(false), 380);
  };

  useEffect(() => {
    if (!tieneCambiosSinGuardar || loading) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [tieneCambiosSinGuardar, loading]);

  useEffect(() => {
    if (!previewOpen) {
      setPreviewImageUrls([]);
      return undefined;
    }
    const urls = imagenesSeleccionadasList.map((file) => URL.createObjectURL(file));
    setPreviewImageUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [previewOpen, imagenesSeleccionadasList]);

  useEffect(() => {
    if (!previewOpen) return undefined;
    const onEsc = (event) => {
      if (event.key === 'Escape') setPreviewOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [previewOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append('titulo', titulo);
    formData.append('contenido', contenido);
    formData.append('categoria', categoria);
    formData.append('autor_id', usuario?.id);
    const imagenes = imagenesInputs.filter(Boolean);
    const archivos = archivosInputs.filter(Boolean);
    imagenes.forEach((file) => formData.append('imagenes', file));
    archivos.forEach((file) => formData.append('archivos', file));
    formData.append('links', JSON.stringify(links.map((l) => l.trim()).filter(Boolean)));

    try {
      await axios.post(apiUrl('/api/publicaciones'), formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Comunicado publicado con exito');
      navigate('/dashboard');
    } catch {
      toast.error('Error al publicar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans overflow-x-hidden transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-gray-50 text-slate-900'}`}>
      <nav className={`border-b px-3 sm:px-6 py-2.5 flex justify-between items-center fixed top-0 left-0 right-0 z-50 transition-colors ${darkMode ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-gray-100'}`}>
        <div className="flex items-center gap-4">
          <img
            src={logoSaciar}
            alt="Logo"
            onClick={() => navigate('/dashboard')}
            className="h-11 sm:h-14 w-auto object-contain cursor-pointer"
            title="Ir al dashboard"
          />
          <div className={`h-5 w-[1px] hidden sm:block ${darkMode ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">Editor de Contenido</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={toggleDarkMode} className={`p-2.5 rounded-xl transition-all ${darkMode ? 'bg-slate-800 text-yellow-400' : 'bg-gray-100 text-slate-500 hover:bg-gray-200'}`}>
            {darkMode ? 'Light' : 'Dark'}
          </button>
          <button onClick={() => navigate('/dashboard')} className="group flex items-center gap-2 text-slate-500 hover:text-green-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
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
                  className="w-full text-left px-3 py-2.5 rounded-xl border border-green-300 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold text-sm hover:brightness-105 transition-all flex items-center gap-2 shadow-sm"
                >
                  <span className="w-5 h-5 rounded-md bg-white/25 flex items-center justify-center">
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
              <button onClick={() => navigate('/admin')} className="w-10 h-10 rounded-xl border border-green-500 bg-green-600 text-white hover:bg-green-700 transition shadow-sm flex items-center justify-center" title="Crear nuevo">
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
              <button onClick={() => navigate('/reportes')} className={`w-10 h-10 rounded-xl border transition flex items-center justify-center ${
                darkMode ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'
              }`} title="Auditoria">
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

      <main className={`flex-1 p-4 sm:p-6 md:p-10 w-full ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-72'}`}>
        <div className="max-w-6xl mx-auto">
        <div className="lg:hidden grid grid-cols-5 gap-2 mb-4">
          <button onClick={() => navigate('/dashboard')} className={`px-2 py-2.5 rounded-xl text-[11px] font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
            Inicio
          </button>
          <button onClick={() => navigate('/admin')} className="px-2 py-2.5 rounded-xl bg-green-600 text-white text-[11px] font-black">
            Crear
          </button>
          <button onClick={() => navigate('/registro-personal')} className={`px-2 py-2.5 rounded-xl text-[11px] font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
            Empleados
          </button>
          <button onClick={() => navigate('/reportes')} className={`px-2 py-2.5 rounded-xl text-[11px] font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
            Auditoria
          </button>
          <button onClick={() => navigate('/reportes-panel')} className={`px-2 py-2.5 rounded-xl text-[11px] font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
            Panel
          </button>
        </div>
        <section
          className={`rounded-[2rem] border p-6 md:p-8 text-white shadow-xl mb-6 ${
            darkMode
              ? 'border-green-900 bg-gradient-to-r from-green-700 to-green-800'
              : 'border-green-200 bg-gradient-to-r from-green-600 to-green-700'
          }`}
        >
          <div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-green-100 font-bold mb-2">Editor de contenido</p>
              <h1 className="text-2xl md:text-4xl font-black text-white">Nuevo comunicado</h1>
              <p className="text-green-50 text-sm mt-2">Completa los bloques del formulario para publicar la informacion.</p>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className={`rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
          <div className={`p-4 sm:p-6 border-b ${darkMode ? 'border-slate-800' : 'border-slate-200/60'}`}>
            <h2 className={`text-lg font-black ${darkMode ? 'text-white' : 'text-slate-800'}`}>Informacion del comunicado</h2>
            <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Diligencia titulo, area, recursos y contenido antes de publicar.</p>
          </div>

          <div className="p-4 sm:p-8 space-y-6 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-6 lg:auto-rows-auto">
            <div className={`rounded-2xl border p-4 lg:col-span-12 ${darkMode ? 'border-slate-700 bg-slate-900/70' : 'border-gray-200 bg-slate-50/70'}`}>
              <div className="grid grid-cols-3 gap-3">
                <div className={`rounded-xl border px-3 py-2 ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Imagenes</p>
                    <FiImage className={`${darkMode ? 'text-slate-300' : 'text-slate-500'}`} />
                  </div>
                  <p className={`text-xl font-black ${darkMode ? 'text-green-300' : 'text-green-700'}`}>{imagenesSeleccionadas}</p>
                </div>
                <div className={`rounded-xl border px-3 py-2 ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Archivos</p>
                    <FiPaperclip className={`${darkMode ? 'text-slate-300' : 'text-slate-500'}`} />
                  </div>
                  <p className={`text-xl font-black ${darkMode ? 'text-green-300' : 'text-green-700'}`}>{archivosSeleccionados}</p>
                </div>
                <div className={`rounded-xl border px-3 py-2 ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Links</p>
                    <FiLink2 className={`${darkMode ? 'text-slate-300' : 'text-slate-500'}`} />
                  </div>
                  <p className={`text-xl font-black ${darkMode ? 'text-green-300' : 'text-green-700'}`}>{linksActivos}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-12 gap-4 lg:col-span-7 lg:row-start-2 lg:self-start">
              <div className="md:col-span-3 lg:col-span-8 space-y-2">
                <div className="px-1">
                  <p className={`text-sm font-bold flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}><FiType className="text-green-600" />Titulo del comunicado</p>
                  <p className="text-xs text-slate-500">Usa un titulo claro para identificar rapidamente el comunicado.</p>
                </div>
                <div className={`h-px ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                <div className={`rounded-2xl border p-3 space-y-2.5 ${darkMode ? 'border-slate-700 bg-slate-800/60' : 'border-gray-200 bg-slate-50/60'}`}>
                  <input type="text" placeholder="Informacion Saciar" required className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'}`} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-out ${
                      mostrarSugerenciasTitulo ? 'max-h-72 opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-1 pointer-events-none'
                    }`}
                    aria-hidden={!mostrarSugerenciasTitulo}
                  >
                    <div className={`rounded-xl border p-2.5 ${darkMode ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className={`text-[10px] uppercase font-black tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Sugerencias de titulo</p>
                        <button
                          type="button"
                          onClick={refreshTituloSuggestions}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-black transition ${
                            darkMode
                              ? 'border-slate-700 bg-slate-800 text-slate-300 hover:border-green-500 hover:text-green-300'
                              : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-green-300 hover:text-green-700'
                          }`}
                          title="Generar nuevas sugerencias"
                        >
                          <FiRefreshCw className={`w-3 h-3 ${refreshingTitulos ? 'animate-spin' : ''}`} />
                          Nuevas
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {tituloSugerencias.map((sugerencia, idx) => (
                          <button
                            key={`${sugerencia}-${idx}`}
                            type="button"
                            onClick={() => setTitulo(sugerencia)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                              darkMode
                                ? 'border-slate-700 bg-slate-800 text-slate-200 hover:border-green-500 hover:text-green-300'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-green-300 hover:text-green-700'
                            }`}
                            title="Usar este titulo"
                          >
                            {sugerencia}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2 lg:col-span-4">
                <div className="px-1">
                  <p className={`text-sm font-bold flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}><FiMapPin className="text-green-600" />Area responsable</p>
                  <p className="text-xs text-slate-500">Selecciona el area a la que pertenece este contenido.</p>
                </div>
                <div className={`h-px ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                <div className={`rounded-2xl border p-3 ${darkMode ? 'border-slate-700 bg-slate-800/60' : 'border-gray-200 bg-slate-50/60'}`}>
                  <select className={`w-full min-h-[58px] px-4 py-3 rounded-xl border text-base ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'}`} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                    {CATEGORIAS.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 lg:row-start-2 lg:self-start space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
                <div>
                  <p className={`text-sm font-bold flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}><FiImage className="text-green-600" />Imagenes del comunicado</p>
                  <p className="text-xs text-slate-500">Puedes seleccionar una o varias imagenes. La primera sera la portada.</p>
                </div>
                <button
                  type="button"
                  onClick={addImagenInput}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black border transition ${
                    darkMode
                      ? 'border-green-800 bg-green-900/40 text-green-200 hover:bg-green-900/60'
                      : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                  }`}
                >
                  <span className="text-sm leading-none">+</span>
                  Agregar imagen
                </button>
              </div>
              <div className={`h-px ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
              <div className={`rounded-2xl border p-4 space-y-3 max-h-[360px] overflow-auto modal-scroll ${darkMode ? 'modal-scroll-dark border-slate-700 bg-slate-800/60' : 'border-gray-200 bg-slate-50/60'}`}>
              <div
                onDragOver={(e) => {
                  handleDragOver(e);
                  if (!draggingImagenes) setDraggingImagenes(true);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setDraggingImagenes(false);
                }}
                onDrop={handleDropImagenes}
                className={`rounded-xl border border-dashed p-3 text-xs font-semibold transition-all ${
                  draggingImagenes
                    ? darkMode
                      ? 'border-green-500 bg-green-900/20 text-green-200'
                      : 'border-green-500 bg-green-50 text-green-700'
                    : darkMode
                      ? 'border-slate-700 bg-slate-900/40 text-slate-400'
                      : 'border-slate-300 bg-white text-slate-500'
                }`}
              >
                Arrastra imagenes aqui para agregarlas mas rapido
              </div>
              {imagenesInputs.map((img, idx) => (
                <div key={idx} className={`field-row-animate flex flex-col gap-2 rounded-xl border p-3 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-sm ${img ? (darkMode ? 'border-emerald-700 bg-emerald-900/20' : 'border-emerald-200 bg-emerald-50/60') : (darkMode ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-white')}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[11px] font-black uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                      Imagen {idx + 1} {idx === 0 ? '(Portada)' : ''}
                    </p>
                    {img && <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}><FiCheckCircle /> Agregada</span>}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label htmlFor={`imagen-input-${idx}`} className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black border cursor-pointer transition whitespace-nowrap ${darkMode ? 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700' : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                      <FiUpload />
                      {img ? 'Cambiar imagen' : 'Seleccionar imagen'}
                    </label>
                    <input
                      id={`imagen-input-${idx}`}
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImagenAt(idx, e.target.files?.[0])}
                      className="hidden"
                    />
                    <div className={`flex-1 px-3 py-2.5 rounded-lg border text-xs font-semibold truncate ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                      {getDisplayName(img?.name)}
                    </div>
                  </div>
                  {imagenesInputs.length > 1 && (
                    <button type="button" onClick={() => removeImagenInput(idx)} className={`self-end inline-flex items-center justify-center w-8 h-8 rounded-lg border transition ${darkMode ? 'border-red-700/70 text-red-300 hover:bg-red-900/30' : 'border-red-200 text-red-600 hover:bg-red-50'}`} title="Eliminar campo de imagen">
                      <FiX />
                    </button>
                  )}
                </div>
              ))}
              <p className={`text-xs font-bold ${imagenesInputs.filter(Boolean).length > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                {imagenesInputs.filter(Boolean).length > 0 ? `${imagenesInputs.filter(Boolean).length} imagen(es) agregada(s)` : 'No hay imagenes agregadas'}
              </p>
              </div>
            </div>

            <div className="lg:col-span-5 lg:row-start-3 lg:self-start space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
                <div>
                  <p className={`text-sm font-bold flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}><FiPaperclip className="text-green-600" />Archivos adjuntos</p>
                  <p className="text-xs text-slate-500">Adjunta documentos de apoyo (PDF, Word, Excel).</p>
                </div>
                <button
                  type="button"
                  onClick={addArchivoInput}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black border transition ${
                    darkMode
                      ? 'border-green-800 bg-green-900/40 text-green-200 hover:bg-green-900/60'
                      : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                  }`}
                >
                  <span className="text-sm leading-none">+</span>
                  Agregar archivo
                </button>
              </div>
              <div className={`h-px ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
              <div className={`rounded-2xl border p-4 space-y-3 max-h-[420px] overflow-auto modal-scroll ${darkMode ? 'modal-scroll-dark border-slate-700 bg-slate-800/60' : 'border-gray-200 bg-slate-50/60'}`}>
              <div
                onDragOver={(e) => {
                  handleDragOver(e);
                  if (!draggingArchivos) setDraggingArchivos(true);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setDraggingArchivos(false);
                }}
                onDrop={handleDropArchivos}
                className={`rounded-xl border border-dashed p-3 text-xs font-semibold transition-all ${
                  draggingArchivos
                    ? darkMode
                      ? 'border-green-500 bg-green-900/20 text-green-200'
                      : 'border-green-500 bg-green-50 text-green-700'
                    : darkMode
                      ? 'border-slate-700 bg-slate-900/40 text-slate-400'
                      : 'border-slate-300 bg-white text-slate-500'
                }`}
              >
                Arrastra archivos aqui (PDF, Word, Excel, PowerPoint)
              </div>
              {archivosInputs.map((file, idx) => (
                <div key={idx} className={`field-row-animate flex flex-col gap-2 rounded-xl border p-3 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-sm ${file ? (darkMode ? 'border-emerald-700 bg-emerald-900/20' : 'border-emerald-200 bg-emerald-50/60') : (darkMode ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-white')}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[11px] font-black uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                      Archivo {idx + 1}
                    </p>
                    {file && <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}><FiCheckCircle /> Agregado</span>}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label htmlFor={`archivo-input-${idx}`} className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black border cursor-pointer transition whitespace-nowrap ${darkMode ? 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700' : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                      <FiUpload />
                      {file ? 'Cambiar archivo' : 'Seleccionar archivo'}
                    </label>
                    <input
                      id={`archivo-input-${idx}`}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      onChange={(e) => setArchivoAt(idx, e.target.files?.[0])}
                      className="hidden"
                    />
                    <div className={`flex-1 px-3 py-2.5 rounded-lg border text-xs font-semibold truncate ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                      {getDisplayName(file?.name)}
                    </div>
                  </div>
                  {archivosInputs.length > 1 && (
                    <button type="button" onClick={() => removeArchivoInput(idx)} className={`self-end inline-flex items-center justify-center w-8 h-8 rounded-lg border transition ${darkMode ? 'border-red-700/70 text-red-300 hover:bg-red-900/30' : 'border-red-200 text-red-600 hover:bg-red-50'}`} title="Eliminar campo de archivo">
                      <FiX />
                    </button>
                  )}
                </div>
              ))}
              <p className={`text-xs font-bold ${archivosInputs.filter(Boolean).length > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                {archivosInputs.filter(Boolean).length > 0 ? `${archivosInputs.filter(Boolean).length} archivo(s) agregado(s)` : 'No hay archivos agregados'}
              </p>
              {archivosInputs.filter(Boolean).length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {archivosInputs.filter(Boolean).map((f, i) => {
                    const typeMeta = getDocTypeMeta(f.name);
                    const TypeIcon = typeMeta.Icon;
                    return (
                      <div key={`${f.name}-${i}`} className={`rounded-lg border px-2.5 py-2 ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`text-xs font-bold truncate ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{getDisplayName(f.name)}</p>
                            <p className={`text-[10px] mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{formatFileSize(f.size)}</p>
                          </div>
                          <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase border rounded px-1.5 py-0.5 ${typeMeta.className}`}>
                            <TypeIcon className="w-3 h-3" />
                            {typeMeta.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            </div>

            <div className="lg:col-span-7 lg:row-start-3 lg:self-start space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
                <div>
                  <p className={`text-sm font-bold flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}><FiLink2 className="text-green-600" />Links externos</p>
                  <p className="text-xs text-slate-500">Agrega enlaces para ampliar informacion.</p>
                </div>
                <button
                  type="button"
                  onClick={addLink}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black border transition ${
                    darkMode
                      ? 'border-green-800 bg-green-900/40 text-green-200 hover:bg-green-900/60'
                      : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                  }`}
                >
                  <span className="text-sm leading-none">+</span>
                  Agregar link
                </button>
              </div>
              <div className={`h-px ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
              <div className={`rounded-2xl border p-4 space-y-2 ${darkMode ? 'border-slate-700 bg-slate-800/60' : 'border-gray-200 bg-slate-50/60'}`}>
              {links.map((link, idx) => (
                <div key={idx} className={`field-row-animate flex flex-col sm:flex-row gap-2 rounded-xl border p-2.5 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-sm ${link?.trim() ? (darkMode ? 'border-emerald-700 bg-emerald-900/15' : 'border-emerald-200 bg-emerald-50/50') : (darkMode ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-white')}`}>
                  <div className={`w-9 h-9 rounded-lg border shrink-0 flex items-center justify-center ${darkMode ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                    <FiLink2 />
                  </div>
                  <input type="url" placeholder="https://..." value={link} onChange={(e) => setLinkAt(idx, e.target.value)} className={`flex-1 px-4 py-2.5 rounded-lg border ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-gray-200'}`} />
                  {links.length > 1 && (
                    <button type="button" onClick={() => removeLink(idx)} className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition ${darkMode ? 'border-red-700/70 text-red-300 hover:bg-red-900/30' : 'border-red-200 text-red-600 hover:bg-red-50'}`} title="Eliminar campo de link">
                      <FiX />
                    </button>
                  )}
                </div>
              ))}
              </div>
            </div>

            <div className="space-y-2 lg:col-span-12 lg:row-start-4 lg:self-start">
              <div className="px-1">
                <p className={`text-sm font-bold flex items-center gap-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}><FiFileText className="text-green-600" />Cuerpo del mensaje</p>
                <p className="text-xs text-slate-500">Redacta el contenido principal del comunicado con claridad.</p>
              </div>
              <div className={`h-px ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
              <div className={`rounded-2xl border p-4 ${darkMode ? 'border-slate-700 bg-slate-800/60' : 'border-gray-200 bg-slate-50/60'}`}>
                <textarea
                  placeholder="Informacion sobre evento..."
                  required
                  rows="8"
                  className={`w-full px-4 py-3 rounded-xl border resize-y ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200'}`}
                  value={contenido}
                  onChange={(e) => setContenido(e.target.value)}
                ></textarea>
                <div className="mt-2 flex items-center justify-end">
                  <span className={`text-[11px] font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {caracteresContenido} caracter(es)
                  </span>
                </div>
              </div>
            </div>

            <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t lg:col-span-12 ${darkMode ? 'border-slate-800' : 'border-gray-50'}`}>
              <p className="text-[11px] text-slate-400 font-medium">Revisa que todo este correcto antes de publicar.</p>
              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[11px] border transition ${
                    darkMode
                      ? 'border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <FiEye className="w-4 h-4" />
                  Vista previa
                </button>
                <button type="submit" disabled={loading} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-8 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[11px]">
                  {loading ? 'Guardando...' : 'Publicar'}
                </button>
              </div>
            </div>
          </div>
        </form>

        {previewOpen && (
          <>
            <div
              className="fixed inset-0 z-[85] bg-slate-900/55 backdrop-blur-[1px]"
              onClick={() => setPreviewOpen(false)}
            ></div>
            <section className={`modal-scroll fixed left-1/2 top-1/2 z-[95] w-[94vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 rounded-[1.2rem] border shadow-2xl p-4 sm:p-6 max-h-[88vh] overflow-y-auto ${
              darkMode ? 'modal-scroll-dark bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-gray-200 text-slate-800'
            }`}>
              <div className={`flex items-center justify-between pb-3 border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                <div>
                  <p className={`text-[10px] uppercase tracking-[0.2em] font-black ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Vista previa</p>
                  <h3 className="text-lg font-black">Asi se vera el comunicado</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition ${
                    darkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-gray-300 text-slate-600 hover:bg-gray-100'
                  }`}
                  title="Cerrar vista previa"
                >
                  <FiX />
                </button>
              </div>

              <article className={`mt-4 rounded-[2.2rem] overflow-hidden border transition-all duration-300 ${darkMode ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-gray-100 shadow-xl shadow-slate-200/50'}`}>
                {previewImageUrls[0] && (
                  <div className={`w-full flex justify-center p-4 sm:p-8 border-b ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-gray-50'}`}>
                    <img src={previewImageUrls[0]} alt="Portada previa" className="max-w-full h-auto max-h-[85vh] rounded-2xl shadow-2xl object-contain" />
                  </div>
                )}
                <div className="p-5 sm:p-8 lg:p-10 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-lg ${
                      darkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-700'
                    }`}>
                      {categoria}
                    </span>
                    <span className="text-[11px] text-slate-400 font-bold">{new Date().toLocaleDateString()}</span>
                  </div>
                  <h4 className="text-2xl font-black break-words [overflow-wrap:anywhere]">{titulo.trim() || 'Titulo del comunicado'}</h4>
                  <p className={`text-base leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere] ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    {contenido.trim() || 'Aqui se mostrara el contenido del comunicado cuando escribas el mensaje.'}
                  </p>

                  {previewImageUrls.length > 1 && (
                    <div className={`mb-2 p-4 rounded-2xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>Galeria de imagenes</p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {previewImageUrls.slice(1).map((url, idx) => (
                          <img key={`${url}-${idx}`} src={url} alt={`Imagen ${idx + 2}`} className="w-full h-36 object-cover rounded-xl border border-slate-200" />
                        ))}
                      </div>
                    </div>
                  )}

                  {(archivosSeleccionadosList.length > 0 || linksPreview.length > 0) && (
                    <div className={`mb-2 p-4 rounded-2xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>Recursos adjuntos</p>
                      <div className="flex flex-wrap gap-2">
                        {archivosSeleccionadosList.map((file, idx) => (
                          <span key={`${file.name}-${idx}`} className={`inline-flex px-3 py-1.5 rounded-xl text-xs font-bold border ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}>
                            Archivo: {getDisplayName(file.name)}
                          </span>
                        ))}
                        {linksPreview.map((link, idx) => (
                          <span key={`${link}-${idx}`} className={`inline-flex px-3 py-1.5 rounded-xl text-xs font-bold border ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}>
                            Link: {link}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={`mb-2 p-4 rounded-2xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>Reacciones</p>
                      <p className={`text-[11px] font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Vista de interacciones</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black border ${
                        darkMode ? 'bg-slate-900 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-200'
                      }`}>
                        <FiThumbsUp className="w-3.5 h-3.5" />
                        Util
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                        }`}>
                          0
                        </span>
                      </span>
                      <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black border ${
                        darkMode ? 'bg-slate-900 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-200'
                      }`}>
                        <FiZap className="w-3.5 h-3.5" />
                        Importante
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                        }`}>
                          0
                        </span>
                      </span>
                      <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black border ${
                        darkMode ? 'bg-slate-900 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-200'
                      }`}>
                        <FiHeart className="w-3.5 h-3.5" />
                        Me gusta
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                        }`}>
                          0
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t ${darkMode ? 'border-slate-800' : 'border-gray-100'}`}>
                    <button
                      type="button"
                      className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        darkMode ? 'bg-slate-800 text-slate-500' : 'bg-gray-50 text-slate-400'
                      }`}
                    >
                      Confirmar lectura
                    </button>
                    <p className={`text-xs font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Vista previa del comunicado completo
                    </p>
                  </div>
                </div>
              </article>
            </section>
          </>
        )}
        </div>
      </main>
      </div>
    </div>
  );
}

export default AdminPanel;
