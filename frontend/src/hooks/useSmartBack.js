import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const PREV_ROUTE_KEY = 'app_prev_route';
const CURRENT_ROUTE_KEY = 'app_current_route';

function isValidRoute(path) {
  return typeof path === 'string' && path.startsWith('/') && path !== '/';
}

export function rememberRoute(pathname) {
  try {
    if (!isValidRoute(pathname)) return;
    const current = sessionStorage.getItem(CURRENT_ROUTE_KEY);
    if (isValidRoute(current) && current !== pathname) {
      sessionStorage.setItem(PREV_ROUTE_KEY, current);
    }
    sessionStorage.setItem(CURRENT_ROUTE_KEY, pathname);
  } catch {
    // no-op
  }
}

export default function useSmartBack(defaultFallback = '/dashboard') {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    const canGoBack = typeof window !== 'undefined' && window.history.length > 1;
    if (canGoBack) {
      navigate(-1);
      return;
    }

    let previous = null;
    try {
      previous = sessionStorage.getItem(PREV_ROUTE_KEY);
    } catch {
      previous = null;
    }

    const fallback = isValidRoute(previous) && previous !== location.pathname
      ? previous
      : defaultFallback;
    navigate(fallback, { replace: true });
  }, [defaultFallback, location.pathname, navigate]);
}

