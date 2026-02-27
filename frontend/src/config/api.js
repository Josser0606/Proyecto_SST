const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_BASE_URL = rawApiUrl.replace(/\/+$/, '');

export const apiUrl = (path = '') => {
  if (!path) return API_BASE_URL;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

export const assetUrl = (path = '') => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) {
    // Fuerza entrega web compatible para imagenes de Cloudinary (incluye HEIC/HEIF -> jpg/webp segun navegador).
    if (path.includes('res.cloudinary.com') && path.includes('/image/upload/')) {
      if (path.includes('/image/upload/f_auto') || path.includes('/image/upload/q_auto')) {
        return path;
      }
      return path.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
    }
    return path;
  }
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

export { API_BASE_URL };
