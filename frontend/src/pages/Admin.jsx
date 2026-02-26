import { useEffect, useState } from 'react';
import axios from 'axios';
import { apiUrl } from '../config/api';

function Admin() {
  const [publicaciones, setPublicaciones] = useState([]);
  const [reporte, setReporte] = useState([]);
  const [seleccionada, setSeleccionada] = useState(null);

  useEffect(() => {
    cargarPublicaciones();
  }, []);

  const cargarPublicaciones = async () => {
    const res = await axios.get(apiUrl('/api/publicaciones'));
    setPublicaciones(res.data);
  };

  const verReporte = async (pub) => {
    setSeleccionada(pub);
    const res = await axios.get(apiUrl(`/api/reporte-vistas/${pub.id}`));
    setReporte(res.data);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Panel de Control SST & GH 🛠️</h1>
      <div style={{ display: 'flex', gap: '40px' }}>
        
        {/* Lado Izquierdo: Lista de Noticias */}
        <div style={{ flex: 1 }}>
          <h3>Publicaciones Realizadas</h3>
          {publicaciones.map(pub => (
            <div key={pub.id} 
                 onClick={() => verReporte(pub)}
                 style={{ padding: '10px', border: '1px solid #ccc', marginBottom: '5px', cursor: 'pointer', backgroundColor: seleccionada?.id === pub.id ? '#e3f2fd' : 'white' }}>
              <strong>{pub.titulo}</strong> <br />
              <small>{pub.categoria} - {new Date(pub.fecha_publicacion).toLocaleDateString()}</small>
            </div>
          ))}
        </div>

        {/* Lado Derecho: Reporte de Vistas */}
        <div style={{ flex: 1, borderLeft: '1px solid #eee', paddingLeft: '20px' }}>
          <h3>Reporte de Visualización</h3>
          {seleccionada ? (
            <>
              <p>Viendo reporte de: <b>{seleccionada.titulo}</b></p>
              <table border="1" width="100%" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f4f4f4' }}>
                    <th>Usuario (Email)</th>
                    <th>Fecha de Lectura</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.length > 0 ? reporte.map((v, i) => (
                    <tr key={i}>
                      <td style={{ padding: '8px' }}>{v.email}</td>
                      <td style={{ padding: '8px' }}>{new Date(v.fecha_visualizacion).toLocaleString()}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="2" style={{ textAlign: 'center', padding: '10px' }}>Nadie ha visto esta publicación aún.</td></tr>
                  )}
                </tbody>
              </table>
            </>
          ) : (
            <p>Selecciona una publicación para ver quién la leyó.</p>
          )}
        </div>

      </div>
    </div>
  );
}

export default Admin;
