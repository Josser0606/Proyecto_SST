const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { v2: cloudinary } = require('cloudinary');
const db = require('./db');
const iniciarTareas = require('./tareas');

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const allowVercelPreview = process.env.ALLOW_VERCEL_PREVIEW === 'true';
const useCloudinary = Boolean(
  process.env.CLOUDINARY_URL ||
  (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
);
const cloudinaryFolder = process.env.CLOUDINARY_FOLDER || 'saciar';

if (useCloudinary) {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ secure: true });
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });
  }
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (allowVercelPreview) {
      try {
        const { hostname } = new URL(origin);
        if (hostname.endsWith('.vercel.app')) return callback(null, true);
      } catch {
        // ignore malformed origins
      }
    }
    return callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname)}`;
    cb(null, safeName);
  }
});
const upload = multer({ storage });

const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const isCloudinaryUrl = (url) => typeof url === 'string' && url.includes('res.cloudinary.com');

const getCloudinaryResourceType = (url) => {
  if (url.includes('/raw/upload/')) return 'raw';
  if (url.includes('/video/upload/')) return 'video';
  return 'image';
};

const getCloudinaryPublicId = (url) => {
  try {
    const { pathname } = new URL(url);
    const match = pathname.match(/\/(?:image|raw|video)\/upload\/(?:v\d+\/)?(.+)$/);
    if (!match || !match[1]) return null;
    const lastDot = match[1].lastIndexOf('.');
    return lastDot > -1 ? match[1].slice(0, lastDot) : match[1];
  } catch {
    return null;
  }
};

const deleteFileSafe = async (fileUrl) => {
  if (!fileUrl || typeof fileUrl !== 'string') return;

  if (fileUrl.startsWith('/uploads/')) {
    const fullPath = path.join(__dirname, fileUrl.replace('/uploads/', 'uploads/'));
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch {
        // ignore unlink errors
      }
    }
    return;
  }

  if (useCloudinary && isCloudinaryUrl(fileUrl)) {
    const publicId = getCloudinaryPublicId(fileUrl);
    if (!publicId) return;
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: getCloudinaryResourceType(fileUrl) });
    } catch {
      // ignore cloudinary delete errors
    }
  }
};

const uploadStoredFile = async (file, tipo) => {
  if (!file) return null;
  if (!useCloudinary) {
    return { url: `/uploads/${file.filename}` };
  }

  const resource_type = tipo === 'archivo' ? 'raw' : 'image';
  const uploaded = await cloudinary.uploader.upload(file.path, {
    folder: cloudinaryFolder,
    resource_type
  });

  if (file.path && fs.existsSync(file.path)) {
    try {
      fs.unlinkSync(file.path);
    } catch {
      // ignore local cleanup errors
    }
  }

  return { url: uploaded.secure_url };
};

const initSchema = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS publicacion_recursos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      publicacion_id INT NOT NULL,
      tipo ENUM('archivo','link','imagen') NOT NULL,
      nombre VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (publicacion_id) REFERENCES publicaciones(id) ON DELETE CASCADE
    )
  `);
  try {
    await db.query("ALTER TABLE publicacion_recursos MODIFY COLUMN tipo ENUM('archivo','link','imagen') NOT NULL");
  } catch (error) {
    if (error.code !== 'ER_BAD_FIELD_ERROR') throw error;
  }

  try {
    await db.query('ALTER TABLE publicaciones ADD COLUMN eliminada TINYINT(1) NOT NULL DEFAULT 0');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }
};

const getPublicacionesWithRecursos = async (usuarioId) => {
  const [publicaciones] = await db.query(
    `SELECT p.*,
    (SELECT COUNT(*) FROM registro_lecturas rl WHERE rl.publicacion_id = p.id AND rl.usuario_id = ?) AS leido
    FROM publicaciones p
    WHERE COALESCE(p.eliminada, 0) = 0
    ORDER BY p.fecha_publicacion DESC`,
    [usuarioId || 0]
  );

  if (publicaciones.length === 0) return [];
  const ids = publicaciones.map((p) => p.id);
  const [recursos] = await db.query(
    `SELECT id, publicacion_id, tipo, nombre, url
     FROM publicacion_recursos
     WHERE publicacion_id IN (?)
     ORDER BY id ASC`,
    [ids]
  );

  const recursosMap = new Map();
  recursos.forEach((r) => {
    if (!recursosMap.has(r.publicacion_id)) recursosMap.set(r.publicacion_id, []);
    recursosMap.get(r.publicacion_id).push(r);
  });

  return publicaciones.map((p) => ({
    ...p,
    recursos: recursosMap.get(p.id) || []
  }));
};

app.get('/', (req, res) => {
  res.send('Servidor SACIAR activo');
});

app.post('/api/login', async (req, res) => {
  const { nombre, area, password } = req.body;
  if (!nombre || !area) {
    return res.status(400).json({ success: false, message: 'Nombre y area son obligatorios' });
  }

  try {
    const [usuarios] = await db.query(
      `SELECT id, nombre_completo, area, rol, password
       FROM usuarios
       WHERE LOWER(TRIM(nombre_completo)) = ? AND LOWER(TRIM(area)) = ?`,
      [String(nombre).trim().toLowerCase(), String(area).trim().toLowerCase()]
    );

    if (usuarios.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Usuario no autorizado. Solicita al administrador agregar tu registro.'
      });
    }

    const user = usuarios[0];
    if (user.rol === 'admin') {
      if (!password) return res.status(401).json({ success: false, message: 'REQUIRES_PASSWORD' });
      if (String(user.password || '') !== String(password)) {
        return res.status(403).json({ success: false, message: 'Contrasena de administrador incorrecta' });
      }
    }

    return res.json({
      success: true,
      usuario: { id: user.id, nombre_completo: user.nombre_completo, area: user.area, rol: user.rol }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/usuarios', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, nombre_completo, area, rol FROM usuarios ORDER BY nombre_completo ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/usuarios', async (req, res) => {
  const { nombre_completo, area, rol = 'empleado', password = null } = req.body;
  if (!nombre_completo || !area) {
    return res.status(400).json({ success: false, message: 'Nombre y area son obligatorios' });
  }
  if (!['admin', 'empleado'].includes(rol)) {
    return res.status(400).json({ success: false, message: 'Rol invalido' });
  }
  if (rol === 'admin' && !password) {
    return res.status(400).json({ success: false, message: 'El admin requiere contrasena' });
  }

  try {
    const [existente] = await db.query(
      `SELECT id FROM usuarios WHERE LOWER(TRIM(nombre_completo)) = ? AND LOWER(TRIM(area)) = ?`,
      [String(nombre_completo).trim().toLowerCase(), String(area).trim().toLowerCase()]
    );
    if (existente.length > 0) {
      return res.status(409).json({ success: false, message: 'Ya existe un usuario con ese nombre y area' });
    }

    const [result] = await db.query(
      'INSERT INTO usuarios (nombre_completo, area, rol, password) VALUES (?, ?, ?, ?)',
      [String(nombre_completo).trim(), String(area).trim(), rol, rol === 'admin' ? String(password) : null]
    );
    res.status(201).json({
      success: true,
      usuario: { id: result.insertId, nombre_completo: String(nombre_completo).trim(), area: String(area).trim(), rol }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre_completo, area, rol, password } = req.body;
  if (!nombre_completo || !area || !rol) {
    return res.status(400).json({ success: false, message: 'Nombre, area y rol son obligatorios' });
  }

  try {
    const [duplicados] = await db.query(
      `SELECT id FROM usuarios WHERE LOWER(TRIM(nombre_completo)) = ? AND LOWER(TRIM(area)) = ? AND id <> ?`,
      [String(nombre_completo).trim().toLowerCase(), String(area).trim().toLowerCase(), id]
    );
    if (duplicados.length > 0) {
      return res.status(409).json({ success: false, message: 'Ya existe otro usuario con ese nombre y area' });
    }

    if (rol === 'admin') {
      if (password) {
        await db.query('UPDATE usuarios SET nombre_completo = ?, area = ?, rol = ?, password = ? WHERE id = ?', [String(nombre_completo).trim(), String(area).trim(), rol, String(password), id]);
      } else {
        await db.query('UPDATE usuarios SET nombre_completo = ?, area = ?, rol = ? WHERE id = ?', [String(nombre_completo).trim(), String(area).trim(), rol, id]);
      }
    } else {
      await db.query('UPDATE usuarios SET nombre_completo = ?, area = ?, rol = ?, password = NULL WHERE id = ?', [String(nombre_completo).trim(), String(area).trim(), rol, id]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('UPDATE publicaciones SET autor_id = NULL WHERE autor_id = ?', [id]);
    await db.query('DELETE FROM registro_lecturas WHERE usuario_id = ?', [id]);
    await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/publicaciones', async (req, res) => {
  try {
    const rows = await getPublicacionesWithRecursos(req.query.usuario_id || 0);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/publicaciones', upload.fields([{ name: 'imagen', maxCount: 1 }, { name: 'imagenes', maxCount: 15 }, { name: 'archivos', maxCount: 15 }]), async (req, res) => {
  const { titulo, contenido, categoria, autor_id } = req.body;
  const imagen = req.files?.imagen?.[0];
  const imagenesNuevas = req.files?.imagenes || [];
  const archivos = req.files?.archivos || [];
  const links = parseJsonArray(req.body.links);
  const id_autor = autor_id && autor_id !== 'undefined' ? autor_id : null;
  let imagen_url = null;
  let imagenesParaRecursos = [];

  try {
    if (imagen) {
      const subido = await uploadStoredFile(imagen, 'imagen');
      imagen_url = subido?.url || null;
      imagenesParaRecursos = imagenesNuevas;
    } else if (imagenesNuevas.length > 0) {
      const subido = await uploadStoredFile(imagenesNuevas[0], 'imagen');
      imagen_url = subido?.url || null;
      imagenesParaRecursos = imagenesNuevas.slice(1);
    }

    const [result] = await db.query(
      'INSERT INTO publicaciones (titulo, contenido, categoria, autor_id, imagen_url) VALUES (?, ?, ?, ?, ?)',
      [titulo, contenido, categoria, id_autor, imagen_url]
    );
    const publicacionId = result.insertId;

    for (const archivo of archivos) {
      const subido = await uploadStoredFile(archivo, 'archivo');
      await db.query(
        'INSERT INTO publicacion_recursos (publicacion_id, tipo, nombre, url) VALUES (?, ?, ?, ?)',
        [publicacionId, 'archivo', archivo.originalname, subido?.url]
      );
    }

    for (const imagenExtra of imagenesParaRecursos) {
      const subido = await uploadStoredFile(imagenExtra, 'imagen');
      await db.query(
        'INSERT INTO publicacion_recursos (publicacion_id, tipo, nombre, url) VALUES (?, ?, ?, ?)',
        [publicacionId, 'imagen', imagenExtra.originalname, subido?.url]
      );
    }

    for (const link of links) {
      const clean = String(link || '').trim();
      if (!clean) continue;
      await db.query(
        'INSERT INTO publicacion_recursos (publicacion_id, tipo, nombre, url) VALUES (?, ?, ?, ?)',
        [publicacionId, 'link', clean, clean]
      );
    }

    res.json({ success: true, id: publicacionId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/publicaciones/:id', upload.fields([{ name: 'imagen', maxCount: 1 }, { name: 'imagenes', maxCount: 15 }, { name: 'archivos', maxCount: 15 }]), async (req, res) => {
  const { id } = req.params;
  const { titulo, contenido, categoria } = req.body;
  const imagenNueva = req.files?.imagen?.[0];
  const imagenesNuevas = req.files?.imagenes || [];
  const archivosNuevos = req.files?.archivos || [];
  const linksNuevos = parseJsonArray(req.body.links_nuevos);
  const recursosExistentes = parseJsonArray(req.body.recursos_existentes).map((v) => Number(v)).filter((v) => Number.isInteger(v));

  try {
    const [pubRows] = await db.query('SELECT imagen_url FROM publicaciones WHERE id = ?', [id]);
    if (pubRows.length === 0) return res.status(404).json({ success: false, message: 'Publicacion no encontrada' });

    let imagenPrincipalActual = pubRows[0].imagen_url;
    let imagenesParaRecursos = imagenesNuevas;

    if (imagenNueva) {
      if (pubRows[0].imagen_url) await deleteFileSafe(pubRows[0].imagen_url);
      const subido = await uploadStoredFile(imagenNueva, 'imagen');
      imagenPrincipalActual = subido?.url || null;
      await db.query('UPDATE publicaciones SET titulo = ?, contenido = ?, categoria = ?, imagen_url = ? WHERE id = ?', [titulo, contenido, categoria, imagenPrincipalActual, id]);
    } else {
      await db.query('UPDATE publicaciones SET titulo = ?, contenido = ?, categoria = ? WHERE id = ?', [titulo, contenido, categoria, id]);
      if (!imagenPrincipalActual && imagenesNuevas.length > 0) {
        const subido = await uploadStoredFile(imagenesNuevas[0], 'imagen');
        imagenPrincipalActual = subido?.url || null;
        await db.query('UPDATE publicaciones SET imagen_url = ? WHERE id = ?', [imagenPrincipalActual, id]);
        imagenesParaRecursos = imagenesNuevas.slice(1);
      }
    }

    const [recursosActuales] = await db.query('SELECT id, tipo, url FROM publicacion_recursos WHERE publicacion_id = ?', [id]);
    const eliminar = recursosActuales.filter((r) => !recursosExistentes.includes(r.id));
    for (const r of eliminar) {
      if (r.tipo === 'archivo' || r.tipo === 'imagen') await deleteFileSafe(r.url);
      await db.query('DELETE FROM publicacion_recursos WHERE id = ?', [r.id]);
    }

    for (const archivo of archivosNuevos) {
      const subido = await uploadStoredFile(archivo, 'archivo');
      await db.query(
        'INSERT INTO publicacion_recursos (publicacion_id, tipo, nombre, url) VALUES (?, ?, ?, ?)',
        [id, 'archivo', archivo.originalname, subido?.url]
      );
    }

    for (const imagenExtra of imagenesParaRecursos) {
      const subido = await uploadStoredFile(imagenExtra, 'imagen');
      await db.query(
        'INSERT INTO publicacion_recursos (publicacion_id, tipo, nombre, url) VALUES (?, ?, ?, ?)',
        [id, 'imagen', imagenExtra.originalname, subido?.url]
      );
    }

    for (const link of linksNuevos) {
      const clean = String(link || '').trim();
      if (!clean) continue;
      await db.query(
        'INSERT INTO publicacion_recursos (publicacion_id, tipo, nombre, url) VALUES (?, ?, ?, ?)',
        [id, 'link', clean, clean]
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/publicaciones/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [pubRows] = await db.query('SELECT imagen_url FROM publicaciones WHERE id = ?', [id]);
    const [recursos] = await db.query('SELECT tipo, url FROM publicacion_recursos WHERE publicacion_id = ?', [id]);
    for (const r of recursos) {
      if (r.tipo === 'archivo' || r.tipo === 'imagen') await deleteFileSafe(r.url);
    }
    if (pubRows[0]?.imagen_url) await deleteFileSafe(pubRows[0].imagen_url);

    await db.query('DELETE FROM publicacion_recursos WHERE publicacion_id = ?', [id]);
    await db.query('UPDATE publicaciones SET eliminada = 1, imagen_url = NULL WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/registrar-vista', async (req, res) => {
  const { usuario_id, publicacion_id } = req.body;
  try {
    await db.query('INSERT IGNORE INTO registro_lecturas (usuario_id, publicacion_id) VALUES (?, ?)', [usuario_id, publicacion_id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        r.id, 
        u.nombre_completo AS empleado, 
        u.area, 
        CASE 
          WHEN COALESCE(p.eliminada, 0) = 1 THEN CONCAT(p.titulo, ' (eliminado)')
          ELSE p.titulo
        END AS publicacion, 
        r.fecha_lectura,
        DATE_SUB(r.fecha_lectura, INTERVAL 5 HOUR) AS fecha_lectura_local
      FROM registro_lecturas r
      INNER JOIN usuarios u ON r.usuario_id = u.id
      LEFT JOIN publicaciones p ON r.publicacion_id = p.id
      ORDER BY r.fecha_lectura DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/reportes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM registro_lecturas WHERE id = ?', [id]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const [totalPubs] = await db.query('SELECT COUNT(*) AS total FROM publicaciones');
    const [totalLecturas] = await db.query('SELECT COUNT(*) AS total FROM registro_lecturas');
    res.json({ publicaciones: totalPubs[0].total, lecturas: totalLecturas[0].total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, async () => {
  await initSchema();
  console.log(`Servidor SACIAR en puerto ${PORT}`);
  iniciarTareas();
});
