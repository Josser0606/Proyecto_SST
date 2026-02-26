import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
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

function AdminPanel() {
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [categoria, setCategoria] = useState('SST y GH');
  const [imagenesInputs, setImagenesInputs] = useState([null]);
  const [archivosInputs, setArchivosInputs] = useState([null]);
  const [links, setLinks] = useState(['']);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario'));
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
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <button onClick={() => navigate('/admin')} className="w-10 h-10 rounded-xl border border-green-300 bg-gradient-to-r from-green-600 to-green-700 text-white hover:brightness-105 transition shadow-sm flex items-center justify-center" title="Crear nuevo">
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
            </div>
          )}
        </aside>

      <main className={`flex-1 p-4 sm:p-6 md:p-10 w-full ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-72'}`}>
        <div className="max-w-6xl mx-auto">
        <div className="lg:hidden grid grid-cols-3 gap-2 mb-4">
          <button onClick={() => navigate('/admin')} className="px-2 py-2.5 rounded-xl bg-green-600 text-white text-[11px] font-black">
            Crear
          </button>
          <button onClick={() => navigate('/registro-personal')} className={`px-2 py-2.5 rounded-xl text-[11px] font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
            Empleados
          </button>
          <button onClick={() => navigate('/reportes')} className={`px-2 py-2.5 rounded-xl text-[11px] font-black border ${darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-gray-200 bg-white text-slate-700 hover:bg-green-50 hover:text-green-800'}`}>
            Auditoria
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

          <div className="p-4 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Titulo del comunicado</label>
                <input type="text" placeholder="Informacion Saciar" required className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-gray-50 border-gray-100'}`} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Area responsable</label>
                <select className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-gray-50 border-gray-100'}`} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                  {CATEGORIAS.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>

            <div className={`rounded-2xl border p-4 space-y-3 ${darkMode ? 'border-slate-700 bg-slate-800/60' : 'border-gray-200 bg-slate-50/60'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                <p className={`text-sm font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Imagenes del comunicado</p>
                <p className="text-xs text-slate-500">Puedes seleccionar una o varias imagenes. La primera sera la portada.</p>
                </div>
                <button type="button" onClick={addImagenInput} className="text-xs font-bold text-green-700">+ Agregar imagen</button>
              </div>
              {imagenesInputs.map((img, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImagenAt(idx, e.target.files?.[0])}
                    className={`flex-1 px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-gray-200'}`}
                  />
                  {imagenesInputs.length > 1 && (
                    <button type="button" onClick={() => removeImagenInput(idx)} className="px-3 rounded-xl border border-red-200 text-red-600">X</button>
                  )}
                </div>
              ))}
              <p className={`text-xs font-bold ${imagenesInputs.filter(Boolean).length > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                {imagenesInputs.filter(Boolean).length > 0 ? `${imagenesInputs.filter(Boolean).length} imagen(es) agregada(s)` : 'No hay imagenes agregadas'}
              </p>
              {imagenesInputs.filter(Boolean).length > 0 && (
                <ul className={`text-xs rounded-lg p-3 space-y-1 border max-h-28 overflow-auto ${darkMode ? 'text-slate-300 bg-slate-900 border-slate-700' : 'text-slate-600 bg-white border-gray-200'}`}>
                  {imagenesInputs.filter(Boolean).map((f, i) => <li key={`${f.name}-${i}`}>{i === 0 ? `Portada: ${f.name}` : f.name}</li>)}
                </ul>
              )}
            </div>

            <div className={`rounded-2xl border p-4 space-y-3 ${darkMode ? 'border-slate-700 bg-slate-800/60' : 'border-gray-200 bg-slate-50/60'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                <p className={`text-sm font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Archivos adjuntos</p>
                <p className="text-xs text-slate-500">Adjunta documentos de apoyo (PDF, Word, Excel).</p>
                </div>
                <button type="button" onClick={addArchivoInput} className="text-xs font-bold text-green-700">+ Agregar archivo</button>
              </div>
              {archivosInputs.map((file, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => setArchivoAt(idx, e.target.files?.[0])}
                    className={`flex-1 px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-gray-200'}`}
                  />
                  {archivosInputs.length > 1 && (
                    <button type="button" onClick={() => removeArchivoInput(idx)} className="px-3 rounded-xl border border-red-200 text-red-600">X</button>
                  )}
                </div>
              ))}
              <p className={`text-xs font-bold ${archivosInputs.filter(Boolean).length > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                {archivosInputs.filter(Boolean).length > 0 ? `${archivosInputs.filter(Boolean).length} archivo(s) agregado(s)` : 'No hay archivos agregados'}
              </p>
              {archivosInputs.filter(Boolean).length > 0 && (
                <ul className={`text-xs rounded-lg p-3 space-y-1 border max-h-28 overflow-auto ${darkMode ? 'text-slate-300 bg-slate-900 border-slate-700' : 'text-slate-600 bg-white border-gray-200'}`}>
                  {archivosInputs.filter(Boolean).map((f, i) => <li key={`${f.name}-${i}`}>{f.name}</li>)}
                </ul>
              )}
            </div>

            <div className={`rounded-2xl border p-4 space-y-2 ${darkMode ? 'border-slate-700 bg-slate-800/60' : 'border-gray-200 bg-slate-50/60'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className={`text-sm font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Links externos</p>
                  <p className="text-xs text-slate-500">Agrega enlaces para ampliar informacion.</p>
                </div>
                <button type="button" onClick={addLink} className="text-xs font-bold text-green-700">+ Agregar link</button>
              </div>
              {links.map((link, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2">
                  <input type="url" placeholder="https://..." value={link} onChange={(e) => setLinkAt(idx, e.target.value)} className={`flex-1 px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-gray-200'}`} />
                  {links.length > 1 && <button type="button" onClick={() => removeLink(idx)} className="px-3 rounded-xl border border-red-200 text-red-600">X</button>}
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cuerpo del mensaje</label>
              <textarea placeholder="Información sobre evento..." required rows="6" className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-gray-50 border-gray-100'}`} value={contenido} onChange={(e) => setContenido(e.target.value)}></textarea>
            </div>

            <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t ${darkMode ? 'border-slate-800' : 'border-gray-50'}`}>
              <p className="text-[11px] text-slate-400 font-medium">Revisa que todo este correcto antes de publicar.</p>
              <button type="submit" disabled={loading} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-8 py-2.5 rounded-lg font-bold uppercase tracking-widest text-[11px]">
                {loading ? 'Guardando...' : 'Publicar'}
              </button>
            </div>
          </div>
        </form>
        </div>
      </main>
      </div>
    </div>
  );
}

export default AdminPanel;
