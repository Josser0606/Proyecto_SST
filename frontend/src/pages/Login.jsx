import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast'; 
import logoSaciar from '../assets/logo_saciar.png'; 
import { apiUrl } from '../config/api';

function Login() {
  const [nombre, setNombre] = useState('');
  const [area, setArea] = useState('SST y GH');
  const [password, setPassword] = useState('');
  const [pedirPass, setPedirPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false); // Estado para el modal
  const navigate = useNavigate();

  useEffect(() => {
    toast.dismiss();
  }, []);

  // Función que se dispara al dar clic en el botón del formulario
  const handlePreLogin = (e) => {
    e.preventDefault();
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) return toast.error("Por favor escribe tu nombre");

    // Si es un usuario normal (no admin detectado), mostramos el modal bonito
    if (!pedirPass) {
      setMostrarConfirmacion(true);
    } else {
      // Si ya estamos pidiendo password, ejecutamos el login directo
      handleLogin();
    }
  };

  const handleLogin = async () => {
    setMostrarConfirmacion(false); // Cerramos el modal si estaba abierto
    setLoading(true);
    const nombreLimpio = nombre.trim();

    try {
      const response = await axios.post(apiUrl('/api/login'), {
        nombre: nombreLimpio,
        area,
        password 
      });

      if (response.data.success) {
        localStorage.setItem('usuario', JSON.stringify(response.data.usuario));
        toast.success('¡Ingreso exitoso!');
        navigate('/dashboard');
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        setPedirPass(true);
        if (password !== "") {
          toast.error("Contraseña de administrador incorrecta");
          setPassword(""); 
        } else {
          toast.info("Usuario administrador: ingresa tu clave");
        }
      } else if (error.response && error.response.status === 403) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Error de conexión con el servidor');
      }
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-6 sm:py-8 relative">
      {/* MODAL DE CONFIRMACIÓN PERSONALIZADO */}
      {mostrarConfirmacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 max-w-sm w-full shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300">
            <div className="text-center">
              <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👤</span>
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-2">Verifica tus datos</h2>
              <p className="text-gray-500 text-sm mb-6">Asegúrate de que tu nombre y área coincidan con tu registro anterior.</p>
              
              <div className="bg-gray-50 rounded-2xl p-5 text-left mb-6 border border-gray-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Nombre</p>
                <p className="font-bold text-slate-700 mb-3 break-words">{nombre.trim()}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Área</p>
                <p className="font-bold text-blue-600">{area}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => setMostrarConfirmacion(false)}
                  className="flex-1 py-4 font-bold text-gray-400 hover:text-gray-600 transition-colors text-xs uppercase tracking-widest"
                >
                  Corregir
                </button>
                <button 
                  onClick={handleLogin}
                  className="flex-1 bg-green-600 py-4 rounded-2xl font-black text-white text-xs uppercase tracking-widest shadow-lg shadow-green-200 hover:bg-green-700 transition-all"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* CONTENIDO PRINCIPAL DEL LOGIN */}
      <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16 lg:gap-24 max-w-5xl w-full justify-center">
        
        {/* LADO IZQUIERDO: LOGO */}
        <div className="flex-shrink-0 animate-in fade-in zoom-in duration-700">
          <img
            src={logoSaciar}
            alt="Logo Saciar"
            onClick={() => navigate('/dashboard')}
            className="h-28 sm:h-36 md:h-44 w-auto object-contain cursor-pointer"
            title="Ir al dashboard"
          />
        </div>

        {/* LADO DERECHO: FORMULARIO */}
        <div className="bg-white p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-md border border-gray-100">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800">Bienvenido</h1>
            <p className="text-gray-400 text-xs mt-2 font-bold uppercase tracking-widest">Sistema de Gestión SST & GH</p>
          </div>

          <form onSubmit={handlePreLogin} className="space-y-5">
            
            {/* Campo Nombre */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Nombre Completo</label>
              <input 
                required
                type="text" 
                placeholder="Ej: Juan Andres Hernandez Velez"
                className={`w-full px-5 sm:px-6 py-4 border-none rounded-2xl focus:ring-2 focus:ring-green-500 outline-none transition-all font-bold text-slate-700 ${pedirPass ? 'bg-gray-100 text-gray-400' : 'bg-gray-50'}`}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={pedirPass}
              />
            </div>

            {/* Selección de Área o Password */}
            {!pedirPass ? (
              <div className="animate-in fade-in duration-500">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 ml-1">Área</label>
                <select 
                  className="w-full px-5 sm:px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-green-500 outline-none font-bold text-slate-700 appearance-none"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                >
                  <option value="SST y GH">SST y GH</option>
                  <option value="Aseguramineto de Calidad">Aseguramineto de Calidad</option>
                  <option value="Mercadeo Social">Mercadeo Social</option>
                  <option value="Programas y Proyectos">Programas y Proyectos</option>
                  <option value="Relaciones Institucionales">Relaciones Institucionales</option>
                  <option value="Logística y Transporte">Logística y Transporte</option>
                  <option value="Financiero y Contable">Financiero y Contable</option>
                  <option value="Dirección">Dirección</option>
                </select>
              </div>
            ) : (
              <div className="animate-in slide-in-from-top-4 duration-400">
                <label className="block text-[10px] font-black uppercase tracking-widest text-red-600 mb-2 ml-1">Contraseña Requerida</label>
                <input 
                  type="password" 
                  placeholder="••••••••"
                  autoFocus
                  className="w-full px-5 sm:px-6 py-4 border-2 border-red-100 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none bg-red-50 font-bold text-slate-800"
                   value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-[10px] text-red-500 mt-2 ml-1 uppercase font-bold tracking-[0.15em]">Perfil de Administrador</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className={`w-full text-white font-black uppercase tracking-widest text-xs py-5 rounded-2xl transition-all duration-300 shadow-xl ${pedirPass ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-green-600 hover:bg-green-700 shadow-green-200'} hover:-translate-y-1`}
            >
              {loading ? 'Verificando...' : (pedirPass ? 'Confirmar Identidad' : 'Ingresar')}
            </button>

            {pedirPass && (
              <button 
                type="button" 
                onClick={() => { setPedirPass(false); setPassword(''); }}
                className="w-full text-gray-400 text-[10px] font-bold uppercase tracking-widest hover:text-green-600 transition-colors"
              >
                ← Cambiar usuario
              </button>
            )}
          </form>

          <p className="text-center text-[10px] text-gray-300 mt-8 font-medium">
            * Su acceso es monitoreado por el departamento de seguridad.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
