# Deploy: Vercel (Frontend) + Render (Backend) + TiDB

## 1) Deploy Backend en Render
1. Crea un nuevo **Web Service** en Render apuntando a `backend`.
2. Configura:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. Variables de entorno (Render):
   - `PORT=3000`
   - `DB_HOST`
   - `DB_PORT=4000`
   - `DB_USER`
   - `DB_PASSWORD`
   - `DB_NAME`
   - `FRONTEND_URLS=https://tu-app.vercel.app,http://localhost:5173`
   - `ALLOW_VERCEL_PREVIEW=true`
4. Despliega y guarda tu URL de Render, por ejemplo:
   - `https://tu-backend.onrender.com`

## 2) Deploy Frontend en Vercel
1. Crea proyecto en Vercel apuntando a `frontend`.
2. Configura:
   - **Framework**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Variable de entorno (Vercel):
   - `VITE_API_URL=https://tu-backend.onrender.com`
4. Despliega.

## 3) Permitir el dominio de Vercel en backend
1. Toma el dominio final de Vercel (ejemplo `https://tu-app.vercel.app`).
2. En Render actualiza `FRONTEND_URLS` para incluir ese dominio.
3. Redeploy del backend.

## 4) Verificación rápida
1. Abre la app en Vercel.
2. Prueba login, listado de comunicados, carga de empleados y auditoría.
3. Verifica que archivos e imágenes abren desde la URL del backend en Render.

## Notas importantes
- Render Free puede “dormir” el backend (primer request tarda más).
- El sistema de archivos de Render es efímero: los archivos en `/uploads` no son persistentes entre deploys/reinicios.
  - Si necesitas persistencia real de archivos, conviene mover uploads a S3/Cloudflare R2/Supabase Storage.
