const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { v2: cloudinary } = require('cloudinary');
const nodemailer = require('nodemailer');
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
const cloudinaryAuthMode = process.env.CLOUDINARY_URL
  ? 'url'
  : (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
    ? 'keys'
    : 'none';
const emailNotificationsEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'false';
const smtpConfigured = Boolean(
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS &&
  process.env.SMTP_FROM_EMAIL
);
const smtpSecure = process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465;
const emailQueueBatchSize = Math.min(Math.max(Number(process.env.EMAIL_QUEUE_BATCH_SIZE || 15), 1), 100);
const emailMaxAttempts = Math.min(Math.max(Number(process.env.EMAIL_MAX_ATTEMPTS || 5), 1), 20);
const emailRetryMinutes = Math.min(Math.max(Number(process.env.EMAIL_RETRY_MINUTES || 10), 1), 1440);
const emailQueuePollMs = Math.max(Number(process.env.EMAIL_QUEUE_POLL_MS || 45000), 10000);
const emailFromName = process.env.SMTP_FROM_NAME || 'Fundacion Saciar';
const appFrontendUrl = process.env.APP_FRONTEND_URL || allowedOrigins.find((o) => o.startsWith('https://')) || allowedOrigins[0] || '';
const emailFromAddress = process.env.SMTP_FROM_EMAIL || '';

const emailTransporter = smtpConfigured
  ? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: smtpSecure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  })
  : null;

let emailProcessorRunning = false;
let emailQueueTimer = null;

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

console.log(`Cloudinary enabled: ${useCloudinary} (auth: ${cloudinaryAuthMode}, folder: ${cloudinaryFolder})`);

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

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

const sanitizeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const toMySqlDatetime = (date) => {
  const pad = (v) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const getRetryDate = (attemptNumber) => {
  const delayMinutes = Math.min(emailRetryMinutes * Math.pow(2, Math.max(attemptNumber - 1, 0)), 24 * 60);
  return new Date(Date.now() + delayMinutes * 60 * 1000);
};

const buildPublicationEmail = ({ titulo, categoria, contenido, autorNombre }) => {
  const tituloSeguro = sanitizeHtml(titulo);
  const categoriaSegura = sanitizeHtml(categoria);
  const autorSeguro = sanitizeHtml(autorNombre || 'Administracion SACIAR');
  const previewRaw = String(contenido || '').replace(/\s+/g, ' ').trim();
  const previewText = previewRaw.length > 220 ? `${previewRaw.slice(0, 220)}...` : previewRaw;
  const previewHtml = sanitizeHtml(previewText || 'Hay un nuevo comunicado disponible para lectura.');
  const dashboardUrl = appFrontendUrl ? `${appFrontendUrl.replace(/\/+$/, '')}/dashboard` : '';
  const subject = `Nuevo comunicado: ${String(titulo || 'Informacion SACIAR').trim()}`;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:18px;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
        <div style="background:#16a34a;color:#ffffff;padding:14px 18px;">
          <p style="margin:0;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;">Fundacion SACIAR</p>
          <h2 style="margin:6px 0 0;font-size:20px;line-height:1.2;">Nuevo comunicado publicado</h2>
        </div>
        <div style="padding:18px;color:#0f172a;">
          <p style="margin:0 0 8px;font-size:14px;"><strong>Titulo:</strong> ${tituloSeguro}</p>
          <p style="margin:0 0 8px;font-size:14px;"><strong>Area:</strong> ${categoriaSegura}</p>
          <p style="margin:0 0 8px;font-size:14px;"><strong>Publicado por:</strong> ${autorSeguro}</p>
          <p style="margin:12px 0 0;font-size:13px;color:#475569;">${previewHtml}</p>
          ${dashboardUrl ? `<p style="margin:16px 0 0;"><a href="${sanitizeHtml(dashboardUrl)}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:700;font-size:13px;">Abrir tablero</a></p>` : ''}
        </div>
      </div>
    </div>
  `;

  const text = [
    'Fundacion SACIAR',
    'Nuevo comunicado publicado',
    `Titulo: ${String(titulo || '').trim()}`,
    `Area: ${String(categoria || '').trim()}`,
    `Publicado por: ${String(autorNombre || 'Administracion SACIAR').trim()}`,
    '',
    previewText || 'Hay un nuevo comunicado disponible para lectura.',
    dashboardUrl ? `\nAbrir tablero: ${dashboardUrl}` : ''
  ].join('\n');

  return { subject, html, text };
};

const processEmailQueue = async () => {
  if (!emailNotificationsEnabled || !emailTransporter || emailProcessorRunning) return;
  emailProcessorRunning = true;

  try {
    const [rows] = await db.query(
      `SELECT id, destinatario_email, asunto, cuerpo_html, cuerpo_texto, intentos
       FROM email_queue
       WHERE status IN ('pending','failed')
         AND intentos < ?
         AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
       ORDER BY created_at ASC
       LIMIT ?`,
      [emailMaxAttempts, emailQueueBatchSize]
    );

    for (const row of rows) {
      const [lockResult] = await db.query(
        `UPDATE email_queue
         SET status = 'processing', locked_at = NOW(), updated_at = NOW()
         WHERE id = ? AND status IN ('pending','failed')`,
        [row.id]
      );
      if (!lockResult.affectedRows) continue;

      try {
        await emailTransporter.sendMail({
          from: `"${emailFromName}" <${emailFromAddress}>`,
          to: row.destinatario_email,
          subject: row.asunto,
          html: row.cuerpo_html,
          text: row.cuerpo_texto || undefined
        });

        await db.query(
          `UPDATE email_queue
           SET status = 'sent', sent_at = NOW(), locked_at = NULL, updated_at = NOW()
           WHERE id = ?`,
          [row.id]
        );
      } catch (error) {
        const nextAttemptNumber = Number(row.intentos || 0) + 1;
        const cleanError = String(error?.message || 'Error desconocido').slice(0, 1000);

        if (nextAttemptNumber >= emailMaxAttempts) {
          await db.query(
            `UPDATE email_queue
             SET status = 'dead', intentos = ?, last_error = ?, locked_at = NULL, updated_at = NOW()
             WHERE id = ?`,
            [nextAttemptNumber, cleanError, row.id]
          );
        } else {
          await db.query(
            `UPDATE email_queue
             SET status = 'failed', intentos = ?, last_error = ?, next_attempt_at = ?, locked_at = NULL, updated_at = NOW()
             WHERE id = ?`,
            [nextAttemptNumber, cleanError, toMySqlDatetime(getRetryDate(nextAttemptNumber)), row.id]
          );
        }
      }
    }
  } catch (error) {
    console.error('Error procesando cola de emails:', error.message);
  } finally {
    emailProcessorRunning = false;
  }
};

const enqueuePublicationEmails = async ({ publicacionId, titulo, categoria, contenido, autorNombre }) => {
  if (!emailNotificationsEnabled) return 0;

  const [usuarios] = await db.query(
    `SELECT id, email
     FROM usuarios
     WHERE email IS NOT NULL
       AND TRIM(email) <> ''
       AND COALESCE(notificar_email, 1) = 1`
  );
  if (!usuarios.length) return 0;

  const unique = new Set();
  const destinatarios = usuarios
    .map((u) => ({ id: u.id, email: normalizeEmail(u.email) }))
    .filter((u) => isValidEmail(u.email) && !unique.has(u.email) && unique.add(u.email));

  if (!destinatarios.length) return 0;

  const emailContent = buildPublicationEmail({ titulo, categoria, contenido, autorNombre });
  const values = destinatarios.map((u) => [
    publicacionId,
    u.id,
    u.email,
    emailContent.subject,
    emailContent.html,
    emailContent.text,
    'pending',
    0,
    toMySqlDatetime(new Date())
  ]);

  await db.query(
    `INSERT INTO email_queue (
      publicacion_id, usuario_id, destinatario_email, asunto, cuerpo_html, cuerpo_texto, status, intentos, next_attempt_at
    ) VALUES ?`,
    [values]
  );

  return values.length;
};

const startEmailQueueWorker = async () => {
  if (!emailNotificationsEnabled) {
    console.log('Email queue desactivada por EMAIL_NOTIFICATIONS_ENABLED=false');
    return;
  }
  if (!emailTransporter) {
    console.log('Email queue activa sin SMTP configurado. Se encolara pero no enviara hasta configurar SMTP.');
    return;
  }

  try {
    await emailTransporter.verify();
    console.log('SMTP verificado correctamente.');
  } catch (error) {
    console.error('No se pudo verificar SMTP:', error.message);
  }

  await processEmailQueue();
  emailQueueTimer = setInterval(() => {
    void processEmailQueue();
  }, emailQueuePollMs);
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

  if (tipo === 'archivo') {
    return { url: uploaded.secure_url };
  }

  // Entrega imagen en formato compatible segun navegador (evita fallos con HEIC/HEIF en desktop).
  const optimizedImageUrl = cloudinary.url(uploaded.public_id, {
    secure: true,
    resource_type: 'image',
    fetch_format: 'auto',
    quality: 'auto'
  });

  return { url: optimizedImageUrl || uploaded.secure_url };
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

  try {
    await db.query('ALTER TABLE usuarios ADD COLUMN email VARCHAR(255) NULL');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }

  try {
    await db.query('ALTER TABLE usuarios ADD COLUMN notificar_email TINYINT(1) NOT NULL DEFAULT 1');
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME') throw error;
  }

  try {
    await db.query('CREATE UNIQUE INDEX uq_usuarios_email ON usuarios(email)');
  } catch (error) {
    if (!['ER_DUP_KEYNAME', 'ER_DUP_ENTRY'].includes(error.code)) throw error;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS email_queue (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      publicacion_id INT NULL,
      usuario_id INT NULL,
      destinatario_email VARCHAR(255) NOT NULL,
      asunto VARCHAR(255) NOT NULL,
      cuerpo_html MEDIUMTEXT NOT NULL,
      cuerpo_texto MEDIUMTEXT NULL,
      status ENUM('pending','processing','sent','failed','dead') NOT NULL DEFAULT 'pending',
      intentos INT NOT NULL DEFAULT 0,
      next_attempt_at DATETIME NULL,
      last_error TEXT NULL,
      locked_at DATETIME NULL,
      sent_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  try {
    await db.query('CREATE INDEX idx_email_queue_status_next ON email_queue(status, next_attempt_at)');
  } catch (error) {
    if (error.code !== 'ER_DUP_KEYNAME') throw error;
  }

  try {
    await db.query('CREATE INDEX idx_email_queue_pub ON email_queue(publicacion_id)');
  } catch (error) {
    if (error.code !== 'ER_DUP_KEYNAME') throw error;
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
    const areaNormalizada = normalizeText(area);
    const nombreNormalizado = normalizeText(nombre);
    const [usuarios] = await db.query(
      `SELECT id, nombre_completo, area, rol, password
       FROM usuarios`
    );

    const candidatos = usuarios.filter((u) => normalizeText(u.nombre_completo) === nombreNormalizado);
    let user = candidatos.find((u) => normalizeText(u.area) === areaNormalizada);
    if (!user && candidatos.length === 1) {
      // Si el nombre es unico, aceptar aunque el area tenga diferencias de formato/tildes.
      user = candidatos[0];
    }
    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'Usuario no autorizado. Solicita al administrador agregar tu registro.'
      });
    }

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
    const [rows] = await db.query(`
      SELECT id, nombre_completo, area, rol, email, COALESCE(notificar_email, 1) AS notificar_email
      FROM usuarios
      ORDER BY nombre_completo ASC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/usuarios', async (req, res) => {
  const { nombre_completo, area, rol = 'empleado', password = null, email = null, notificar_email = true } = req.body;
  if (!nombre_completo || !area) {
    return res.status(400).json({ success: false, message: 'Nombre y area son obligatorios' });
  }
  if (!['admin', 'empleado'].includes(rol)) {
    return res.status(400).json({ success: false, message: 'Rol invalido' });
  }
  if (rol === 'admin' && !password) {
    return res.status(400).json({ success: false, message: 'El admin requiere contrasena' });
  }
  const emailNormalizado = normalizeEmail(email);
  if (emailNormalizado && !isValidEmail(emailNormalizado)) {
    return res.status(400).json({ success: false, message: 'Correo electronico invalido' });
  }

  try {
    const [existente] = await db.query(
      `SELECT id, nombre_completo FROM usuarios`
    );
    const nombreNormalizado = normalizeText(nombre_completo);
    const duplicadoNombre = existente.find((u) => normalizeText(u.nombre_completo) === nombreNormalizado);
    if (duplicadoNombre) {
      return res.status(409).json({ success: false, message: 'Ya existe un usuario con ese nombre completo' });
    }
    if (emailNormalizado) {
      const [correoExistente] = await db.query(
        'SELECT id FROM usuarios WHERE LOWER(TRIM(email)) = ?',
        [emailNormalizado]
      );
      if (correoExistente.length > 0) {
        return res.status(409).json({ success: false, message: 'Ese correo ya esta asignado a otro usuario' });
      }
    }

    const [result] = await db.query(
      'INSERT INTO usuarios (nombre_completo, area, rol, password, email, notificar_email) VALUES (?, ?, ?, ?, ?, ?)',
      [
        String(nombre_completo).trim(),
        String(area).trim(),
        rol,
        rol === 'admin' ? String(password) : null,
        emailNormalizado || null,
        notificar_email ? 1 : 0
      ]
    );
    res.status(201).json({
      success: true,
      usuario: {
        id: result.insertId,
        nombre_completo: String(nombre_completo).trim(),
        area: String(area).trim(),
        rol,
        email: emailNormalizado || null,
        notificar_email: notificar_email ? 1 : 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre_completo, area, rol, password, email = null, notificar_email = true } = req.body;
  if (!nombre_completo || !area || !rol) {
    return res.status(400).json({ success: false, message: 'Nombre, area y rol son obligatorios' });
  }
  const emailNormalizado = normalizeEmail(email);
  if (emailNormalizado && !isValidEmail(emailNormalizado)) {
    return res.status(400).json({ success: false, message: 'Correo electronico invalido' });
  }

  try {
    const [duplicados] = await db.query(
      `SELECT id, nombre_completo FROM usuarios WHERE id <> ?`,
      [id]
    );
    const nombreNormalizado = normalizeText(nombre_completo);
    const duplicadoNombre = duplicados.find((u) => normalizeText(u.nombre_completo) === nombreNormalizado);
    if (duplicadoNombre) {
      return res.status(409).json({ success: false, message: 'Ya existe otro usuario con ese nombre completo' });
    }
    if (emailNormalizado) {
      const [correoDuplicado] = await db.query(
        'SELECT id FROM usuarios WHERE LOWER(TRIM(email)) = ? AND id <> ?',
        [emailNormalizado, id]
      );
      if (correoDuplicado.length > 0) {
        return res.status(409).json({ success: false, message: 'Ese correo ya esta asignado a otro usuario' });
      }
    }

    if (rol === 'admin') {
      if (password) {
        await db.query(
          'UPDATE usuarios SET nombre_completo = ?, area = ?, rol = ?, password = ?, email = ?, notificar_email = ? WHERE id = ?',
          [String(nombre_completo).trim(), String(area).trim(), rol, String(password), emailNormalizado || null, notificar_email ? 1 : 0, id]
        );
      } else {
        await db.query(
          'UPDATE usuarios SET nombre_completo = ?, area = ?, rol = ?, email = ?, notificar_email = ? WHERE id = ?',
          [String(nombre_completo).trim(), String(area).trim(), rol, emailNormalizado || null, notificar_email ? 1 : 0, id]
        );
      }
    } else {
      await db.query(
        'UPDATE usuarios SET nombre_completo = ?, area = ?, rol = ?, password = NULL, email = ?, notificar_email = ? WHERE id = ?',
        [String(nombre_completo).trim(), String(area).trim(), rol, emailNormalizado || null, notificar_email ? 1 : 0, id]
      );
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

    let autorNombre = 'Administracion SACIAR';
    if (id_autor) {
      const [autorRows] = await db.query('SELECT nombre_completo FROM usuarios WHERE id = ? LIMIT 1', [id_autor]);
      if (autorRows[0]?.nombre_completo) autorNombre = autorRows[0].nombre_completo;
    }

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

    const encolados = await enqueuePublicationEmails({
      publicacionId,
      titulo,
      categoria,
      contenido,
      autorNombre
    });
    if (encolados > 0) void processEmailQueue();

    res.json({ success: true, id: publicacionId, notificaciones_encoladas: encolados });
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
  await startEmailQueueWorker();
});

process.on('SIGTERM', () => {
  if (emailQueueTimer) clearInterval(emailQueueTimer);
});
