import { useCallback, useEffect } from 'react';

function useUnsavedChangesPrompt(enabled, message = 'Tienes cambios sin guardar. ¿Seguro que deseas salir sin guardar?') {
  useEffect(() => {
    if (!enabled) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled]);

  const confirmIfNeeded = useCallback(() => {
    if (!enabled) return true;
    return window.confirm(message);
  }, [enabled, message]);

  return { confirmIfNeeded };
}

export default useUnsavedChangesPrompt;
